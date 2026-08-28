import sys
import io
import time
import json
import sqlite3
import uuid
import urllib.parse
import requests
from pathlib import Path
from datetime import datetime, timezone
from camoufox.sync_api import Camoufox

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

# List of accounts purchased
ACCOUNTS = [
    {"email": "AurelZelineWulandari@gmaoiil.com", "password": "qwertyui"},
    {"email": "ElvinaDirgaMelawati@gmaoiil.com", "password": "qwertyui"},
    {"email": "ZafranBintangMaheswara@gmaoiil.com", "password": "qwertyui"},
    {"email": "FarelKiranaAdikara@gmaoiil.com", "password": "qwertyui"},
    {"email": "TamaHabibiFadhlan@gmaoiil.com", "password": "qwertyui"},
    {"email": "ArmanKiranaMulyadi@gmaoiil.com", "password": "qwertyui"},
    {"email": "ElvinaVaniaCakranegara@gmaoiil.com", "password": "qwertyui"},
    {"email": "KiranaNaylaMelawati@gmaoiil.com", "password": "qwertyui"},
    {"email": "BaskaraAksaHermawan@gmaoiil.com", "password": "qwertyui"},
    {"email": "MarshaDirgaWibisono@gmaoiil.com", "password": "qwertyui"},
    {"email": "CallistaNazwaAprillia@gmaoiil.com", "password": "qwertyui"},
    {"email": "KaylaLabibKusumaningrum@gmaoiil.com", "password": "qwertyui"},
]

HEADERS = {
    "User-Agent": "IDE/2.63.2 CodeBuddy/2.63.2",
    "X-Requested-With": "XMLHttpRequest",
    "X-Domain": "www.codebuddy.ai",
    "X-No-Authorization": "true",
    "X-No-User-Id": "true",
    "X-Product": "SaaS",
}

DB_PATH = Path("C:/Users/fizzu/AppData/Roaming/9router/db/data.sqlite")

def save_to_9router(email, token_data):
    if not DB_PATH.exists():
        print(f"[-] DB not found at {DB_PATH}", flush=True)
        return
    
    db = sqlite3.connect(str(DB_PATH))
    cur = db.cursor()
    
    name = email.split("@")[0]
    try:
        import base64
        parts = token_data["accessToken"].split(".")
        if len(parts) >= 2:
            padded = parts[1] + "=" * (-len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
            name = payload.get("name") or payload.get("given_name") or name
    except Exception:
        pass

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    conn_data = {
        "accessToken": token_data["accessToken"],
        "refreshToken": token_data.get("refreshToken", ""),
        "expiresAt": "2027-08-26T18:30:00.000Z",
        "testStatus": "active",
        "expiresIn": token_data.get("expiresIn", 31536000),
        "displayName": name,
        "providerSpecificData": {
            "proxyRotationStrategy": "none"
        }
    }

    cur.execute("SELECT id FROM providerConnections WHERE provider = 'codebuddy-intl' AND email = ?", (email,))
    existing = cur.fetchone()
    
    if existing:
        cur.execute("UPDATE providerConnections SET data = ?, name = ?, isActive = 1, updatedAt = ? WHERE id = ?", 
                    (json.dumps(conn_data), name, now_iso, existing[0]))
        print(f"[+] Updated 9Router DB: {name} ({email})", flush=True)
    else:
        new_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO providerConnections (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
            VALUES (?, 'codebuddy-intl', 'oauth', ?, ?, 1, 1, ?, ?, ?)
        """, (new_id, name, email, json.dumps(conn_data), now_iso, now_iso))
        print(f"[+] Injected into 9Router DB: {name} ({email}) [ID: {new_id}]", flush=True)
        
    db.commit()

def process_google_account(acc, headless=False):
    email = acc["email"]
    pwd = acc["password"]
    print("\n" + "="*60, flush=True)
    print(f"[*] Processing Google Account: {email}", flush=True)
    print("="*60, flush=True)

    state_url = "https://www.codebuddy.ai/v2/plugin/auth/state?platform=ide"
    r = requests.post(state_url, headers=HEADERS, json={}, timeout=20)
    state = r.json()["data"]["state"]
    print(f"[+] Device State: {state}", flush=True)

    redirect_started = f"https://www.codebuddy.ai/started?platform=ide&state={state}"
    redirect_select = f"https://www.codebuddy.ai/login/select?redirect_uri={urllib.parse.quote(redirect_started, safe='')}"
    google_keycloak_url = (
        f"https://www.codebuddy.ai/auth/realms/copilot/protocol/openid-connect/auth"
        f"?client_id=console&response_type=code"
        f"&redirect_uri={urllib.parse.quote(redirect_select, safe='')}"
        f"&scope=openid%20profile%20offline_access%20email"
        f"&kc_idp_hint=google"
    )

    with Camoufox(headless=headless) as browser:
        page = browser.new_page()
        print("[*] Navigating to Google Login via CodeBuddy...", flush=True)
        page.goto(google_keycloak_url, timeout=45000)
        time.sleep(4)

        # Step 1: Identifier (Email)
        try:
            email_input = page.wait_for_selector('input[type="email"], #identifierId', timeout=15000)
            if email_input:
                print("[*] Typing email...", flush=True)
                email_input.fill(email)
                time.sleep(1)
                page.keyboard.press("Enter")
                time.sleep(4)
        except Exception as e:
            print(f"[!] Email input error: {e}", flush=True)

        # Step 2: Password
        try:
            pwd_input = page.wait_for_selector('input[type="password"], input[name="Passwd"], input[name="password"]', timeout=15000)
            if pwd_input:
                print("[*] Typing password...", flush=True)
                pwd_input.fill(pwd)
                time.sleep(1)
                page.keyboard.press("Enter")
                time.sleep(5)
        except Exception as e:
            print(f"[!] Password input error: {e}", flush=True)

        # Step 3: Handle speedbumps and Keycloak first-broker-login
        for i in range(12):
            curr_url = page.url
            print(f"[*] Flow check ({i+1}/12): {curr_url[:80]}", flush=True)
            if "codebuddy.ai/started" in curr_url or "codebuddy.ai/home" in curr_url:
                print("[+] Reached CodeBuddy target page!", flush=True)
                break
            
            # Check if on Keycloak first-broker-login
            if "first-broker-login" in curr_url:
                page.screenshot(path="keycloak_broker.png")
                try:
                    submit_btn = page.query_selector('input[type="submit"], button[type="submit"], input[value="Submit"], input[value="Kirim"], .btn-primary, #kc-form-buttons input')
                    if submit_btn and submit_btn.is_visible():
                        print("[+] Clicking Keycloak submit button...", flush=True)
                        submit_btn.click()
                        time.sleep(3)
                        continue
                except Exception as e:
                    print(f"[!] Submit click error: {e}", flush=True)

            # Click buttons like "I understand", "Continue", "Next", "Saya mengerti"
            button_clicked = False
            for text in ["I understand", "Saya mengerti", "Mengerti", "I agree", "Saya setuju", "Continue", "Lanjutkan", "Next", "Berikutnya", "Allow", "Izinkan", "Not now", "Jangan sekarang"]:
                try:
                    btn = page.query_selector(f"button:has-text('{text}'), div[role='button']:has-text('{text}'), a:has-text('{text}')")
                    if btn and btn.is_visible():
                        print(f"[+] Clicking consent button: '{text}'", flush=True)
                        btn.click()
                        time.sleep(3)
                        button_clicked = True
                        break
                except Exception:
                    pass
            
            if not button_clicked:
                time.sleep(2)

        page.screenshot(path="google_step_final.png")

        # Step 4: Poll CodeBuddy token
        print("[*] Polling CodeBuddy token with state...", flush=True)
        for attempt in range(25):
            try:
                token_resp = requests.get(f"https://www.codebuddy.ai/v2/plugin/auth/token?state={state}", headers=HEADERS, timeout=10)
                if token_resp.ok:
                    res_json = token_resp.json()
                    if res_json.get("code") == 0 and res_json.get("data", {}).get("accessToken"):
                        token_data = res_json["data"]
                        print(f"🎉🎉🎉 [SUCCESS] Token Acquired & Injected for {email}!", flush=True)
                        save_to_9router(email, token_data)
                        return True
            except Exception:
                pass
            time.sleep(2)

        print(f"[-] Failed to acquire token for {email}", flush=True)
        return False

def run_all():
    print(f"[*] Starting Batch Google OAuth for {len(ACCOUNTS)} accounts...")
    success_count = 0
    fail_count = 0
    for idx, acc in enumerate(ACCOUNTS):
        print(f"\n>>> [Account {idx+1}/{len(ACCOUNTS)}] <<<")
        ok = process_google_account(acc, headless=False)
        if ok:
            success_count += 1
        else:
            fail_count += 1
        time.sleep(2)
        
    print("\n" + "="*60)
    print(f"[*] Batch Complete: {success_count} SUCCESS, {fail_count} FAILED")
    print("="*60)

if __name__ == "__main__":
    run_all()
