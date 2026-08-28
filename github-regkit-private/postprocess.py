#!/usr/bin/env python3
"""Post-process existing accounts: login, create repo, enable TOTP 2FA.

Reads accounts from accounts/daftar_akun.md (| no | email | password | username |
totp | recovery |), processes each one, and writes the TOTP/recovery back.

Usage:
  python postprocess.py                 # all accounts, home IP, headful
  python postprocess.py --account 1     # only account #1
  python postprocess.py --no-repo       # skip repo creation
  python postprocess.py --no-2fa        # skip 2FA setup
  python postprocess.py --proxy URL     # use a proxy instead of home IP
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import time
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from camoufox.sync_api import Camoufox

from github_register.config import load_config
from github_register.runner import (
    _browser_ctx_options,
    _create_repository,
    _enable_2fa,
    _logged_in,
    _page_text,
    _save_recovery_per_account,
    _try_login,
    silence_playwright_noise,
)

ACCOUNTS_MD = ROOT / "accounts" / "daftar_akun.md"


def load_accounts() -> list[dict]:
    if not ACCOUNTS_MD.is_file():
        raise SystemExit(f"not found: {ACCOUNTS_MD}")
    rows: list[dict] = []
    for line in ACCOUNTS_MD.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6 or not cells[0].isdigit():
            continue
        rows.append({
            "no": int(cells[0]),
            "email": cells[1],
            "password": cells[2],
            "username": cells[3],
            "totp": cells[4],
            "recovery": cells[5],
        })
    return rows


def save_accounts(rows: list[dict]) -> None:
    lines = [
        "# Daftar Akun",
        "",
        "> File ini sensitif — jangan di-commit ke repository.",
        "",
        "| No | Email | Password | Username | TOTP Secret | Recovery Codes |",
        "|----|-------|----------|----------|-------------|----------------|",
    ]
    for r in rows:
        lines.append(
            f"| {r['no']}  | {r['email']} | {r['password']} | {r['username']} "
            f"| {r['totp']} | {r['recovery']} |"
        )
    ACCOUNTS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def account_has_repos(page, username: str) -> bool:
    """True when the profile's Repositories tab shows at least one repo."""
    page.goto(f"https://github.com/{username}?tab=repositories",
              wait_until="domcontentloaded", timeout=60_000)
    try:
        page.wait_for_timeout(2500)
        return page.locator("[itemprop='name codeRepository']").count() > 0
    except Exception:
        return False


def _fill_login_totp(page, secret: str, log) -> bool:
    """Fill the TOTP code when login prompts for 2FA (accounts with 2FA on)."""
    import pyotp

    if not secret or secret in ("-", ""):
        return False
    for sel in ("input[name='otp']", "input#app_totp", "input#otp",
                "input[autocomplete='one-time-code']"):
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.fill(pyotp.TOTP(secret).now(), timeout=5000)
                log("[*] TOTP code filled at login")
                page.wait_for_timeout(600)
                page.keyboard.press("Enter")
                return True
        except Exception:
            continue
    return False


_DEVICE_VERIFY_MARKERS = (
    "verify your device",
    "device verification",
    "confirm it's you",
    "we sent a code",
)


def _looks_like_device_verify(page) -> bool:
    try:
        t = _page_text(page).lower()
    except Exception:
        t = ""
    return any(m in t for m in _DEVICE_VERIFY_MARKERS)


def _fill_code_input(page, code: str) -> bool:
    for sel in ("input[name='otp']", "input#otp", "input[autocomplete='one-time-code']"):
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.fill(code, timeout=5000)
                page.wait_for_timeout(500)
                page.keyboard.press("Enter")
                return True
        except Exception:
            continue
    return False


def _reorder_mailbox(email: str, log) -> str:
    """Re-open the account's Litensi mailbox for a fresh window; returns order id."""
    if not email:
        return ""
    try:
        from github_register.config import load_config as _lc
        from github_register.litensi import LitensiClient

        cfg = _lc(ROOT / "config.json")
        lit = LitensiClient(cfg.litensi_api_id, cfg.litensi_api_key,
                            cfg.litensi_site, cfg.litensi_zone)
        data = lit.reorder(email)
        order_id = str(data.get("order_id") or "")
        log(f"[*] mailbox reordered ahead of login: {email} (order {order_id})")
        return order_id
    except Exception as exc:
        log(f"[!] mailbox reorder failed: {exc}")
        return ""


def _poll_mailbox_for_code(page, email: str, order_id: str, log, timeout: int = 150) -> None:
    """Poll a (pre-warmed) mailbox for the device code and submit it."""
    if not email or not order_id:
        return
    try:
        from github_register.config import load_config as _lc
        from github_register.litensi import LitensiClient
        from github_register.profiles import extract_github_code

        cfg = _lc(ROOT / "config.json")
        lit = LitensiClient(cfg.litensi_api_id, cfg.litensi_api_key,
                            cfg.litensi_site, cfg.litensi_zone)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                d = lit.get_status(order_id)
                text = "\n".join(x for x in (d.get("message", ""),
                                             d.get("full_message", "")) if x)
                code = extract_github_code(text)
                if code:
                    log(f"[*] device code received: {code}")
                    if _fill_code_input(page, code):
                        log("[*] device code submitted")
                    return
            except Exception as exc:
                log(f"[i] device code poll error: {exc}")
            page.wait_for_timeout(5000)
        log("[!] device code not received in time — fill it manually in the window if shown")
    except Exception as exc:
        log(f"[!] device verify helper failed: {exc}")


def process_account(page, context, rec: dict, cfg, log) -> None:
    email, pw, username = rec["email"], rec["password"], rec["username"]
    log(f"--- account #{rec['no']} {username} ({email}) ---")

    page.goto("https://github.com/login", wait_until="domcontentloaded", timeout=60_000)
    # Accounts without 2FA hit device verification on a fresh device. GitHub emails
    # the 6-digit code the instant login is submitted, so pre-warm the mailbox NOW
    # (before submitting) or the code is lost with the expired signup window.
    lit_order = ""
    if rec["totp"] in ("", "-"):
        lit_order = _reorder_mailbox(email, log)
    if not _try_login(page, username, pw, context, log):
        if rec["totp"] not in ("", "-"):
            _fill_login_totp(page, rec["totp"], log)
        if not _logged_in(context) and _looks_like_device_verify(page):
            _poll_mailbox_for_code(page, email, lit_order, log)
        deadline = time.monotonic() + 45
        while not _logged_in(context) and time.monotonic() < deadline:
            log("[i] login not confirmed — waiting (manual verification?)")
            page.wait_for_timeout(5000)
    if not _logged_in(context):
        log(f"[!] account #{rec['no']}: login FAILED — verify the open window, "
            f"then rerun (postprocess.py is idempotent)")
        return

    if cfg.create_repo:
        try:
            if account_has_repos(page, username):
                log("[*] repo already exists — skip")
            else:
                name = _create_repository(page, username, cfg.repo_name, log)
                log(f"[*] repo created: {name}")
        except Exception as exc:
            log(f"[!] repo step failed: {exc}")

    if cfg.enable_2fa and rec["totp"] in ("", "-"):
        try:
            secret, recovery = _enable_2fa(page, log)
            rec["totp"] = secret
            if recovery:
                _save_recovery_per_account(email, recovery, log)
                rec["recovery"] = "saved"
            log(f"[*] 2FA enabled for {username} — secret saved")
        except Exception as exc:
            log(f"[!] 2FA step failed: {exc}")
    elif cfg.enable_2fa:
        log("[*] TOTP already recorded — skip")


def main() -> int:
    silence_playwright_noise()
    ap = argparse.ArgumentParser(prog="github-regkit-postprocess")
    ap.add_argument("--account", type=int, default=None, help="only process this account no")
    ap.add_argument("--count", type=int, default=None, help="process only the first N accounts")
    ap.add_argument("--no-repo", action="store_true", help="skip repository creation")
    ap.add_argument("--no-2fa", action="store_true", help="skip 2FA setup")
    ap.add_argument("--proxy", default="", help="proxy url override (default: home IP)")
    args = ap.parse_args()

    cfg = load_config(ROOT / "config.json")
    if args.no_repo:
        cfg.create_repo = False
    if args.no_2fa:
        cfg.enable_2fa = False
    cfg.proxy = args.proxy  # empty = home IP (proven to pass DataDome)

    rows = load_accounts()
    if args.account:
        rows = [r for r in rows if r["no"] == args.account]
    elif args.count:
        rows = rows[: args.count]
    if not rows:
        print("[!] no accounts to process")
        return 1

    log = lambda msg: print(f"[{__import__('time').strftime('%H:%M:%S')}] {msg}")
    # ONE persistent browser profile for the whole run. GitHub trusts a device
    # after the first verification, so accounts 2..N log in without re-verifying.
    # _clean_github_session_cookies drops GitHub cookies between accounts so we
    # never slide into the previous account.
    cfg.fresh_profile = False
    cfg.browser_profile_dir = ".postprocess-profile"
    from github_register.runner import _clean_github_session_cookies, _context_and_page

    try:
        opts = _browser_ctx_options(cfg, log=log)
        with Camoufox(**opts) as browser:
            context, page = _context_and_page(browser)
            for rec in rows:
                try:
                    process_account(page, context, rec, cfg, log)
                except KeyboardInterrupt:
                    raise
                except Exception as exc:
                    log(f"[!] account #{rec['no']} failed: {exc}")
                save_accounts(rows)
                _clean_github_session_cookies(context, log)
    finally:
        pass
    print("[*] done — accounts updated in accounts/daftar_akun.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
