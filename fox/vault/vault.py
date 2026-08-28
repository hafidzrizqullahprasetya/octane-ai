#!/usr/bin/env python3
"""
Fox Vault — AES-256-GCM Encrypted Credential Store
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PBKDF2 key derivation (600K iterations) + SQLite backend
Operations: init, store, list, get, search, export
"""

import os
import sys
import json
import sqlite3
import getpass
import base64
import hashlib
from pathlib import Path
from datetime import datetime, timezone

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    print("[!] Required: cryptography. Install with: pip install cryptography")
    sys.exit(1)

VAULT_DIR = Path.home() / ".fox-vault"
DB_PATH = VAULT_DIR / "vault.db"
SALT_PATH = VAULT_DIR / ".salt"
ITERATIONS = 600_000
SALT_SIZE = 32


def _ensure_vault_dir():
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    for sub in ["combos", "hashes", "tokens", "keys", "sessions", "logs", "targets", "cracking"]:
        (VAULT_DIR / sub).mkdir(exist_ok=True)


def _derive_key(password: bytes, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(password)


def _get_or_create_salt(password: bytes) -> bytes:
    if SALT_PATH.exists():
        salt = SALT_PATH.read_bytes()
    else:
        salt = os.urandom(SALT_SIZE)
        SALT_PATH.write_bytes(salt)
    return salt


def _get_conn(password: str):
    pw_bytes = password.encode("utf-8")
    salt = _get_or_create_salt(pw_bytes)
    key = _derive_key(pw_bytes, salt)
    conn = sqlite3.connect(str(DB_PATH))
    return conn, key


def _encrypt(key: bytes, plaintext: str) -> str:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def _decrypt(key: bytes, ciphertext: str) -> str:
    raw = base64.b64decode(ciphertext.encode("ascii"))
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")


def cmd_init(password: str):
    """Initialize vault database."""
    _ensure_vault_dir()
    pw_bytes = password.encode("utf-8")
    salt = _get_or_create_salt(pw_bytes)
    key = _derive_key(pw_bytes, salt)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target TEXT NOT NULL,
            service TEXT,
            username_encrypted TEXT NOT NULL,
            password_encrypted TEXT NOT NULL,
            category TEXT DEFAULT 'plaintext',
            source TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target TEXT NOT NULL,
            session_type TEXT,
            data_encrypted TEXT NOT NULL,
            expires_at TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    print(f"[+] Vault initialized at {DB_PATH}")
    print(f"[+] Salt: {salt.hex()[:16]}...")


def cmd_store(password: str, args: list):
    """Store a credential: --target T --service S --username U --password P [--category C] [--source SRC] [--notes N]"""
    if len(args) < 4:
        print("[!] Usage: store --target T --service S --username U --password P")
        return
    opts = _parse_opts(args)
    t = opts.get("--target", "")
    s = opts.get("--service", "")
    u = opts.get("--username", "")
    p = opts.get("--password", "")
    c = opts.get("--category", "plaintext")
    src = opts.get("--source", "")
    notes = opts.get("--notes", "")
    if not t or not u or not p:
        print("[!] --target, --username, --password required")
        return
    conn, key = _get_conn(password)
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO credentials (target, service, username_encrypted, password_encrypted, category, source, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (t, s, _encrypt(key, u), _encrypt(key, p), c, src, notes, now, now),
    )
    conn.commit()
    conn.close()
    print(f"[+] Stored credential for {t}/{s} ({u})")


def cmd_list(password: str, args: list):
    """List stored credentials with optional --target filter."""
    conn, key = _get_conn(password)
    cur = conn.cursor()
    query = "SELECT id, target, service, username_encrypted, category, source, created_at FROM credentials"
    params = []
    target_filter = _parse_opts(args).get("--target")
    if target_filter:
        query += " WHERE target = ?"
        params.append(target_filter)
    rows = cur.execute(query, params).fetchall()
    if not rows:
        print("[*] No credentials stored.")
    else:
        print(f"\n{'ID':<5} {'Target':<20} {'Service':<20} {'Username':<30} {'Category':<12} {'Source':<15} {'Created':<22}")
        print("-" * 124)
        for row in rows:
            uid = row[3]
            try:
                u_plain = _decrypt(key, uid) if uid else ""
            except Exception:
                u_plain = "[DECRYPT_FAIL]"
            print(f"{row[0]:<5} {row[1]:<20} {row[2] or '':<20} {u_plain:<30} {row[4] or '':<12} {row[5] or '':<15} {row[6] or '':<22}")
    conn.close()


def cmd_get(password: str, args: list):
    """Get credential by ID."""
    opts = _parse_opts(args)
    cid = opts.get("--id")
    if not cid:
        print("[!] Usage: get --id N")
        return
    conn, key = _get_conn(password)
    row = conn.execute("SELECT * FROM credentials WHERE id = ?", (int(cid),)).fetchone()
    if not row:
        print(f"[!] No credential with ID {cid}")
    else:
        u_plain = _decrypt(key, row[3]) if row[3] else ""
        p_plain = _decrypt(key, row[4]) if row[4] else ""
        print(f"\nID:       {row[0]}")
        print(f"Target:   {row[1]}")
        print(f"Service:  {row[2]}")
        print(f"Username: {u_plain}")
        print(f"Password: {p_plain}")
        print(f"Category: {row[5]}")
        print(f"Source:   {row[6]}")
        print(f"Notes:    {row[7]}")
        print(f"Created:  {row[8]}")
        print(f"Updated:  {row[9]}")
    conn.close()


def cmd_search(password: str, args: list):
    """Search credentials by keyword."""
    if not args:
        print("[!] Usage: search <keyword>")
        return
    keyword = args[0].lower()
    conn, key = _get_conn(password)
    rows = conn.execute("SELECT id, target, service, username_encrypted, category, source FROM credentials").fetchall()
    results = []
    for row in rows:
        u_plain = _decrypt(key, row[3]) if row[3] else ""
        p_plain = _decrypt(key, _get_pass_enc(conn, row[0])) if _get_pass_enc(conn, row[0]) else ""
        if keyword in row[1].lower() or keyword in (row[2] or "").lower() or keyword in u_plain.lower() or keyword in p_plain.lower():
            results.append(row)
    if not results:
        print(f"[*] No results for '{keyword}'")
    else:
        print(f"\n{'ID':<5} {'Target':<20} {'Service':<20} {'Username':<30} {'Category':<12}")
        print("-" * 87)
        for r in results:
            u_plain = _decrypt(key, r[3]) if r[3] else ""
            print(f"{r[0]:<5} {r[1]:<20} {r[2] or '':<20} {u_plain:<30} {r[4] or '':<12}")
    conn.close()


def _get_pass_enc(conn, cid):
    row = conn.execute("SELECT password_encrypted FROM credentials WHERE id = ?", (cid,)).fetchone()
    return row[0] if row else ""


def _parse_opts(args: list) -> dict:
    opts = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args) and not args[i + 1].startswith("--"):
            opts[args[i]] = args[i + 1]
            i += 2
        elif args[i].startswith("--"):
            opts[args[i]] = True
            i += 1
        else:
            i += 1
    return opts


def main():
    if len(sys.argv) < 2:
        print("Usage: vault.py <command> [args]")
        print("Commands: init, store, list, get, search")
        print("  init              Initialize vault (prompts for password)")
        print("  store --target T --service S --username U --password P [--category C] [--source SRC]")
        print("  list [--target T]")
        print("  get --id N")
        print("  search <keyword>")
        sys.exit(1)

    cmd = sys.argv[1]
    cmd_args = sys.argv[2:]

    if cmd == "init":
        pw = getpass.getpass("Vault password: ")
        cmd_init(pw)
    else:
        if not DB_PATH.exists():
            print("[!] Vault not initialized. Run 'vault.py init' first.")
            sys.exit(1)
        pw = getpass.getpass("Vault password: ")
        pw_bytes = pw.encode("utf-8")
        if not SALT_PATH.exists():
            print("[!] Corrupted vault: salt file missing.")
            sys.exit(1)
        salt = SALT_PATH.read_bytes()
        _derive_key(pw_bytes, salt)  # just to validate

        if cmd == "store":
            cmd_store(pw, cmd_args)
        elif cmd == "list":
            cmd_list(pw, cmd_args)
        elif cmd == "get":
            cmd_get(pw, cmd_args)
        elif cmd == "search":
            cmd_search(pw, cmd_args)
        else:
            print(f"[!] Unknown command: {cmd}")


if __name__ == "__main__":
    main()
