import re
import time
import json
import sqlite3
import requests
import pyotp
import urllib.parse
from pathlib import Path
from camoufox.sync_api import Camoufox

BASE_DIR = Path(__file__).resolve().parent
DAFTAR_AKUN_PATH = BASE_DIR / "accounts" / "daftar_akun.md"
TOKENS_JSON_PATH = BASE_DIR / "accounts" / "codebuddy_tokens.json"
SQLITE_DB_PATH = Path(r"C:\Users\fizzu\AppData\Roaming\9router\db\data.sqlite")

PROXY_URL = "http://3.232.134.177:8888"
PROXIES = {
    "http": PROXY_URL,
    "https": PROXY_URL,
}

HEADERS = {
    "User-Agent": "IDE/2.63.2 CodeBuddy/2.63.2",
    "X-Requested-With": "XMLHttpRequest",
    "X-Domain": "www.codebuddy.ai",
    "X-No-Authorization": "true",
    "X-No-User-Id": "true",
    "X-Product": "SaaS",
}

def parse_daftar_akun():
    if not DAFTAR_AKUN_PATH.exists():
        print(f"[!] File not found: {DAFTAR_AKUN_PATH}")
        return []

    lines = DAFTAR_AKUN_PATH.read_text(encoding="utf-8").splitlines()
    accounts = []
    
    for line in lines:
        if not line.strip().startswith("|") or "Email" in line or "---" in line:
            continue
        parts = [p.strip() for p in line.split("|")]
        # Structure: | No | Email | Password | Username | TOTP Secret | Recovery Codes | Codebudy | ...
        if len(parts) >= 8:
            no = parts[1]
            email = parts[2]
            password = parts[3]
            username = parts[4]
            totp_secret = parts[5]
            recovery_codes = parts[6]
            status = parts[7]
            
            if no.isdigit():
                accounts.append({
                    "no": int(no),
                    "email": email,
                    "password": password,
                    "username": username,
                    "totp_secret": totp_secret,
                    "recovery_codes": recovery_codes,
                    "status": status,
                    "raw_line": line,
                })
    return accounts

def update_status_in_md(email, new_status="[OK]"):
    if not DAFTAR_AKUN_PATH.exists():
        return
    content = DAFTAR_AKUN_PATH.read_text(encoding="utf-8")
    lines = content.splitlines()
    new_lines = []
    
    for line in lines:
        if email in line and "|" in line:
            parts = line.split("|")
            if len(parts) >= 8:
                parts[7] = f" {new_status} "
                line = "|".join(parts)
        new_lines.append(line)
    
    DAFTAR_AKUN_PATH.write_text("\n".join(new_lines), encoding="utf-8")

def request_codebuddy_device_code():
    url = "https://www.codebuddy.ai/v2/plugin/auth/state?platform=ide"
    resp = requests.post(url, headers=HEADERS, json={}, proxies=PROXIES, timeout=30)
    resp.raise_for_status()
    res = resp.json()
    if res.get("code") != 0 or not res.get("data", {}).get("state"):
        raise Exception(f"Failed to get device state: {res}")
    return res["data"]["state"], res["data"]["authUrl"]

def poll_codebuddy_token(state, timeout_sec=60):
    url = f"https://www.codebuddy.ai/v2/plugin/auth/token?state={state}"
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            resp = requests.get(url, headers=HEADERS, proxies=PROXIES, timeout=15)
            if resp.ok:
                res = resp.json()
                if res.get("code") == 0 and res.get("data", {}).get("accessToken"):
                    return res["data"]
        except Exception:
            pass
        time.sleep(2)
    return None

def extract_user_info(access_token):
    try:
        parts = access_token.split(".")
        if len(parts) >= 2:
            import base64
            padded = parts[1] + "=" * (-len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
            email = payload.get("email") or payload.get("preferred_username")
            name = payload.get("name") or payload.get("preferred_username") or email
            return email, name
    except Exception:
        pass
    return None, None

def save_token_to_json(token_data, account):
    tokens = []
    if TOKENS_JSON_PATH.exists():
        try:
            tokens = json.loads(TOKENS_JSON_PATH.read_text(encoding="utf-8"))
        except Exception:
            tokens = []
    
    email, name = extract_user_info(token_data["accessToken"])
    record = {
        "no": account["no"],
        "account_email": account["email"],
        "account_username": account["username"],
        "codebuddy_email": email,
        "codebuddy_name": name,
        "accessToken": token_data["accessToken"],
        "refreshToken": token_data.get("refreshToken", ""),
        "expiresIn": token_data.get("expiresIn", 86400),
        "timestamp": int(time.time()),
    }
    
    tokens = [t for t in tokens if t.get("account_email") != account["email"]]
    tokens.append(record)
    TOKENS_JSON_PATH.write_text(json.dumps(tokens, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[+] Saved token to {TOKENS_JSON_PATH}")

def save_connection_to_9router_db(token_data, account):
    if not SQLITE_DB_PATH.exists():
        print(f"[-] 9Router SQLite DB not found at {SQLITE_DB_PATH}, skipping direct DB insert.")
        return

    email, name = extract_user_info(token_data["accessToken"])
    conn_data = {
        "accessToken": token_data["accessToken"],
        "refreshToken": token_data.get("refreshToken", ""),
        "expiresIn": token_data.get("expiresIn", 86400),
        "email": email or account["email"],
        "displayName": name or account["username"],
        "providerSpecificData": {}
    }

    try:
        db = sqlite3.connect(str(SQLITE_DB_PATH))
        cur = db.cursor()
        
        cur.execute("SELECT id FROM providerConnections WHERE provider = 'codebuddy-intl' AND data LIKE ?", (f'%{email}%',))
        row = cur.fetchone()
        
        now = int(time.time() * 1000)
        data_str = json.dumps(conn_data)
        
        if row:
            conn_id = row[0]
            cur.execute("UPDATE providerConnections SET data = ?, status = 'active', updatedAt = ? WHERE id = ?", (data_str, now, conn_id))
            print(f"[+] Updated 9Router connection in DB (ID: {conn_id})")
        else:
            import uuid
            new_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO providerConnections (id, provider, status, priority, data, createdAt, updatedAt)
                VALUES (?, 'codebuddy-intl', 'active', 0, ?, ?, ?)
            """, (new_id, data_str, now, now))
            print(f"[+] Inserted new 9Router connection into DB (ID: {new_id}, Email: {email})")
            
        db.commit()
        db.close()
    except Exception as e:
        print(f"[-] DB insert error: {e}")

def login_codebuddy_oauth(account, headless=True):
    print(f"\n=======================================================")
    print(f"[*] Processing Account #{account['no']}: {account['email']} ({account['username']})")
    print(f"=======================================================")

    state, auth_url = request_codebuddy_device_code()
    print(f"[*] Generated CodeBuddy state: {state}")

    redirect_started = f"https://www.codebuddy.ai/started?platform=ide&state={state}"
    redirect_select = f"https://www.codebuddy.ai/login/select?redirect_uri={urllib.parse.quote(redirect_started, safe='')}"
    direct_keycloak_url = (
        f"https://www.codebuddy.ai/auth/realms/copilot/protocol/openid-connect/auth"
        f"?client_id=console&response_type=code"
        f"&redirect_uri={urllib.parse.quote(redirect_select, safe='')}"
        f"&v=2210&product=codebuddy"
    )

    with Camoufox(
        headless=headless,
        proxy={"server": PROXY_URL},
        geoip=True,
    ) as browser:
        page = browser.new_page()
        page.set_default_timeout(35000)

        print("[*] Navigating to Keycloak auth page...")
        page.goto(direct_keycloak_url, wait_until="domcontentloaded")
        time.sleep(4)

        print("[*] Current page URL:", page.url)

        gh_href = None
        for a in page.locator("a").all():
            h = a.get_attribute("href") or ""
            if "broker/github/login" in h:
                gh_href = h
                break

        if not gh_href:
            print("[!] Could not find GitHub broker link on Keycloak page, dumping page...")
            with open("debug_keycloak_dump.html", "w", encoding="utf-8") as f:
                f.write(page.content())
            page.screenshot(path="debug_keycloak_fail.png")
            print("[!] Saved debug_keycloak_dump.html and debug_keycloak_fail.png")
            return False

        print(f"[+] Found GitHub broker link: {gh_href[:80]}...")
        page.goto(gh_href, wait_until="domcontentloaded")
        time.sleep(4)
        print("[*] URL after GitHub redirect:", page.url)

        if "github.com/login" in page.url or page.locator("#login_field").is_visible():
            print("[*] On GitHub login page. Entering credentials...")
            page.fill("#login_field", account["username"])
            time.sleep(0.5)
            page.fill("#password", account["password"])
            time.sleep(0.5)
            page.click('input[name="commit"]')
            print("[+] Submitted GitHub credentials")
            time.sleep(4)
            print("[*] URL after credentials submit:", page.url)

        if "two-factor" in page.url or page.locator("#app_totp").is_visible() or page.locator('input[name="app_totp"]').is_visible():
            print("[*] 2FA Prompt detected! Generating TOTP code...")
            totp = pyotp.TOTP(account["totp_secret"].replace(" ", ""))
            otp_code = totp.now()
            print(f"[+] Generated OTP: {otp_code}")

            totp_input = page.locator("#app_totp, input[name='app_totp'], input[name='otp']").first
            totp_input.fill(otp_code)
            time.sleep(1)
            
            try:
                submit_btn = page.locator('button[type="submit"]:has-text("Verify"), input[type="submit"]').first
                if submit_btn.is_visible():
                    submit_btn.click(timeout=5000)
                    print("[+] Submitted TOTP code")
            except Exception:
                pass
            time.sleep(4)
            print("[*] URL after 2FA:", page.url)

        if "github.com/login/oauth/authorize" in page.url:
            print("[*] OAuth Authorization page detected. Authorizing CodeBuddy...")
            try:
                auth_btn = page.get_by_role("button", name="Authorize").first
                if auth_btn.is_visible():
                    auth_btn.click()
                    print("[+] Clicked Authorize button")
            except Exception as e:
                print(f"[-] Authorize click by role failed: {e}, trying fallback...")
                auth_btn = page.locator('button[name="authorize"], #js-oauth-authorize-btn, button:has-text("Authorize")').first
                if auth_btn.is_visible():
                    auth_btn.click()
                    print("[+] Clicked Authorize via fallback selector")
                else:
                    print("[!] Trying JS form submit...")
                    page.evaluate("() => { const f = document.querySelector('form[action*=\"oauth/authorize\"]'); if (f) f.submit(); }")
            time.sleep(5)
            print("[*] URL after authorization:", page.url)

        # Handle Keycloak first-broker-login (account linking page)
        if "first-broker-login" in page.url:
            print("[*] Keycloak first-broker-login page detected. Dumping page for debug...")
            with open("debug_first_broker.html", "w", encoding="utf-8") as f:
                f.write(page.content())
            page.screenshot(path="debug_first_broker.png")
            print("[+] Saved debug_first_broker.html and debug_first_broker.png")
            
            # Try to find and fill required fields, then submit
            try:
                inputs = page.locator("input:visible").all()
                for inp in inputs:
                    name = inp.get_attribute("name") or ""
                    id_attr = inp.get_attribute("id") or ""
                    input_type = inp.get_attribute("type") or "text"
                    val = inp.get_attribute("value") or ""
                    print(f"  [input] name={name} id={id_attr} type={input_type} value={val}")
                    if input_type == "submit":
                        inp.click(timeout=3000)
                        print(f"[+] Clicked submit input: {name}")
                        break
                
                if "first-broker-login" in page.url:
                    submit_btn = page.locator('input[type="submit"], button[type="submit"]').first
                    if submit_btn.is_visible():
                        submit_btn.click(timeout=5000)
                        print("[+] Submitted first-broker-login form")
            except Exception as e:
                print(f"[-] first-broker-login submit error: {e}")
                page.evaluate("() => { const f = document.querySelector('form'); if (f) f.submit(); }")
            time.sleep(4)
            print("[*] URL after first-broker-login:", page.url)

        for _ in range(15):
            if "codebuddy.ai/started" in page.url or ("codebuddy.ai" in page.url and "login" not in page.url):
                print(f"[+] Successfully reached CodeBuddy callback: {page.url}")
                break
            time.sleep(1)

    print("[*] Polling CodeBuddy token with state...")
    token_data = poll_codebuddy_token(state, timeout_sec=45)
    
    if token_data and token_data.get("accessToken"):
        email, name = extract_user_info(token_data["accessToken"])
        print(f"[SUCCESS] Token acquired for: {email} ({name})")
        save_token_to_json(token_data, account)
        save_connection_to_9router_db(token_data, account)
        update_status_in_md(account["email"], "✅")
        return True
    else:
        print(f"[FAILED] Failed to acquire token for {account['email']}")
        return False

def main():
    accounts = parse_daftar_akun()
    print(f"[*] Found {len(accounts)} accounts in {DAFTAR_AKUN_PATH}")
    
    pending = [a for a in accounts if "✅" not in a["status"] and "OK" not in a["status"]]
    print(f"[*] Pending accounts to authorize: {len(pending)}")

    success_count = 0
    for idx, acc in enumerate(pending, 1):
        try:
            ok = login_codebuddy_oauth(acc, headless=True)
            if ok:
                success_count += 1
            time.sleep(3)
        except Exception as e:
            print(f"[!] Error on account #{acc['no']}: {e}")
            time.sleep(5)

    print(f"\n=======================================================")
    print(f"[FINISHED] {success_count}/{len(pending)} Accounts Authorized Successfully!")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
