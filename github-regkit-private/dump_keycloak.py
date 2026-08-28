import time
import requests
import urllib.parse
import pyotp
from camoufox.sync_api import Camoufox
from oauth_codebuddy_batch import parse_daftar_akun

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

acc = parse_daftar_akun()[3] # irfan-simanjuntak
url = "https://www.codebuddy.ai/v2/plugin/auth/state?platform=ide"
r = requests.post(url, headers=HEADERS, json={}, proxies=PROXIES)
state = r.json()["data"]["state"]
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
            
    print("[*] Going to GitHub...")
    p.goto(gh_href)
    time.sleep(3)
    
    if "github.com/login" in p.url or p.locator("#login_field").is_visible():
        p.fill("#login_field", acc["username"])
        p.fill("#password", acc["password"])
        p.click('input[name="commit"]')
        time.sleep(4)
        
    if "two-factor" in p.url or p.locator("#app_totp").is_visible():
        totp = pyotp.TOTP(acc["totp_secret"].replace(" ", "")).now()
        p.locator("#app_totp, input[name='app_totp']").first.fill(totp)
        time.sleep(5)
        
    print("[*] URL after 2FA:", p.url)
    if "oauth/authorize" in p.url or p.get_by_role("button", name="Authorize").is_visible():
        try:
            p.get_by_role("button", name="Authorize").first.click()
            time.sleep(5)
        except Exception as e:
            print("Auth click:", e)
            
    print("[*] URL reached after auth:", p.url)
    print("[*] Title:", p.title())
    
    time.sleep(3)
    with open("keycloak_page_dump.html", "w", encoding="utf-8") as f:
        f.write(p.content())
    p.screenshot(path="keycloak_dump.png")
    print("[+] Saved keycloak_page_dump.html and keycloak_dump.png")
