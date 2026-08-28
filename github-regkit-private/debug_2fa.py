import time
import pyotp
from camoufox.sync_api import Camoufox
from oauth_codebuddy_batch import parse_daftar_akun

PROXY_URL = "http://3.232.134.177:8888"
acc = parse_daftar_akun()[0]

print(f"[*] Testing 2FA Login for {acc['username']}...")
with Camoufox(headless=False, geoip=True, proxy={"server": PROXY_URL}) as b:
    p = b.new_page()
    p.goto("https://github.com/login", wait_until="domcontentloaded")
    time.sleep(3)
    p.fill("#login_field", acc["username"])
    p.fill("#password", acc["password"])
    p.click('input[name="commit"]')
    time.sleep(4)
    print(f"[*] URL after login: {p.url}")

    if "two-factor" in p.url:
        totp = pyotp.TOTP(acc["totp_secret"].replace(" ", "")).now()
        print(f"[*] TOTP Code: {totp}")
        
        # Check inputs
        inputs = p.locator("input").all()
        for inp in inputs:
            print(f"  Input: name={inp.get_attribute('name')} id={inp.get_attribute('id')} type={inp.get_attribute('type')}")

        # Fill and submit form
        p.evaluate(f"""() => {{
            const input = document.querySelector('#app_totp') || document.querySelector('input[name="app_totp"]') || document.querySelector('#otp') || document.querySelector('input[name="otp"]');
            if (input) {{
                input.focus();
                input.value = '{totp}';
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                const form = input.closest('form');
                if (form) form.submit();
            }}
        }}""")
        time.sleep(6)
        print(f"[*] URL after JS submit: {p.url}")
        p.screenshot(path="github_2fa_debug.png")
        print("[+] Screenshot saved to github_2fa_debug.png")
