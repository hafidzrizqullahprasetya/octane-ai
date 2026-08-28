import time
import requests
import urllib.parse
import pyotp
from camoufox.sync_api import Camoufox
from oauth_codebuddy_batch import parse_daftar_akun, poll_codebuddy_token, save_token_to_json, save_connection_to_9router_db, update_status_in_md, extract_user_info

PROXY_URL = "http://3.232.134.177:8888"
PROXIES = {"http": PROXY_URL, "https": PROXY_URL}
HEADERS = {
    "User-Agent": "IDE/2.63.2 CodeBuddy/2.63.2",
    "X-Requested-With": "XMLHttpRequest",
    "X-Domain": "www.codebuddy.ai",
    "X-No-Authorization": "true",
    "X-No-User-Id": "true",
    "X-Product": "SaaS",
}

def run():
    acc = parse_daftar_akun()[0]
    url = "https://www.codebuddy.ai/v2/plugin/auth/state?platform=ide"
    r = requests.post(url, headers=HEADERS, json={}, proxies=PROXIES)
    state = r.json()["data"]["state"]
    print(f"[*] State: {state}")

    redirect_started = f"https://www.codebuddy.ai/started?platform=ide&state={state}"
    redirect_select = f"https://www.codebuddy.ai/login/select?redirect_uri={urllib.parse.quote(redirect_started, safe='')}"
    direct_keycloak_url = (
        f"https://www.codebuddy.ai/auth/realms/copilot/protocol/openid-connect/auth"
        f"?client_id=console&response_type=code"
        f"&redirect_uri={urllib.parse.quote(redirect_select, safe='')}"
        f"&v=2210&product=codebuddy"
    )

    with Camoufox(headless=False, geoip=True, proxy={"server": PROXY_URL}) as b:
        p = b.new_page()
        p.goto(direct_keycloak_url)
        time.sleep(3)
        
        gh_href = None
        for a in p.locator("a").all():
            h = a.get_attribute("href") or ""
            if "broker/github/login" in h:
                gh_href = h
                break
        
        print(f"[*] Going to GitHub Broker...")
        p.goto(gh_href)
        time.sleep(4)

        # Login
        if "github.com/login" in p.url or p.locator("#login_field").is_visible():
            print("[*] Entering credentials...")
            p.fill("#login_field", acc["username"])
            p.fill("#password", acc["password"])
            p.click('input[name="commit"]')
            time.sleep(4)

        # 2FA
        if "two-factor" in p.url:
            print("[*] Entering TOTP...")
            totp = pyotp.TOTP(acc["totp_secret"].replace(" ", "")).now()
            p.locator("#app_totp, input[name='app_totp']").first.fill(totp)
            time.sleep(4)

        print(f"[*] Current URL: {p.url}")
        print(f"[*] Page Title: {p.title()}")

        # Inspect elements on authorize page
        print("[*] Inspecting buttons on page:")
        buttons = p.locator("button, input[type='submit']").all()
        for idx, btn in enumerate(buttons):
            try:
                print(f"  [{idx}] text={repr(btn.inner_text().strip())} tag={btn.evaluate('e => e.tagName')} name={btn.get_attribute('name')} value={btn.get_attribute('value')}")
            except Exception:
                pass

        # Try clicking button or clicking via JavaScript
        print("[*] Attempting click on Authorize button...")
        clicked = False
        for btn in buttons:
            try:
                val = btn.get_attribute("value")
                txt = btn.inner_text().lower()
                name = btn.get_attribute("name") or ""
                if val == "1" or "authorize" in txt or ("authorize" in name and val != "0"):
                    print(f"[+] Found Authorize button: {btn.inner_text().strip()}, clicking via JS...")
                    btn.evaluate("e => e.click()")
                    clicked = True
                    break
            except Exception as e:
                print(f"[-] Click error: {e}")

        if not clicked:
            print("[-] Trying direct form submission...")
            p.evaluate("() => { const f = document.querySelector('form[action*=\"oauth/authorize\"], form#login'); if (f) f.submit(); }")

        time.sleep(6)
        print(f"[*] URL after click: {p.url}")

        # Wait for redirect back to codebuddy.ai
        for i in range(15):
            print(f"[*] Waiting callback ({i+1}/15)... URL: {p.url[:80]}...")
            if "codebuddy.ai/started" in p.url or ("codebuddy.ai" in p.url and "login" not in p.url):
                print(f"[+] Successfully reached CodeBuddy callback!")
                break
            time.sleep(2)

    # Poll token
    print("[*] Polling CodeBuddy token...")
    token_data = poll_codebuddy_token(state, timeout_sec=30)
    if token_data and token_data.get("accessToken"):
        email, name = extract_user_info(token_data["accessToken"])
        print(f"\n=======================================================")
        print(f"🎉 SUCCESS! Token acquired for: {email} ({name})")
        print(f"=======================================================")
        save_token_to_json(token_data, acc)
        save_connection_to_9router_db(token_data, acc)
        update_status_in_md(acc["email"], "✅")
    else:
        print(f"[-] Token poll failed for {acc['email']}")

if __name__ == "__main__":
    run()
