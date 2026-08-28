"""Anti-restrict pipeline: Litensi(hotmail) -> GitHub -> CodeBuddy OAuth."""
import sys, time, json, os, hashlib, pyotp, urllib.parse
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent))
from github_register.config import Config, load_config
from github_register.litensi import LitensiClient
from github_register.runner import (
    _browser_ctx_options, _context_and_page, _open_signup, _human_fill,
    _fill_and_create_account, _wait_post_submit, _fill_launch_code,
    _try_login, _create_repository, _save_recovery_per_account,
    SignupError, SignupBlocked, GitHubRateLimited,
    _EMAIL_INPUTS, _PASSWORD_INPUTS, _USERNAME_INPUTS,
    _save_trust_cookie, _restore_trust_cookie,
    ACCOUNTS_DIR, RECOVERY_DIR,
)
from github_register.profiles import generate_password, generate_human_username, extract_github_code
from oauth_codebuddy_batch import (
    request_codebuddy_device_code, poll_codebuddy_token,
    extract_user_info, save_token_to_json, save_connection_to_9router_db,
    PROXY_URL, PROXIES, HEADERS,
)
from camoufox.sync_api import Camoufox

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "accounts" / "daftar_akun.md"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

def create_single_account(config: Config):
    """Create one GitHub account with hotmail.com email, then CodeBuddy OAuth."""
    # Step 1: Order Litensi email
    log("Step 1: Ordering Litensi email (hotmail.com)...")
    lit = LitensiClient(config.litensi_api_id, config.litensi_api_key, 
                        config.litensi_site, config.litensi_zone)
    email, order_id = lit.create_mailbox()
    log(f"  Email: {email}  Order: {order_id}")

    # Step 2: Generate credentials
    password = generate_password()
    username = generate_human_username()
    log(f"  Username: {username}  Password: {password}")

    # Step 3: Register GitHub account
    log("Step 2: Registering GitHub account...")
    opts = _browser_ctx_options(config, log=log)
    
    with Camoufox(**{k: v for k, v in opts.items() if k != "fresh_profile"}) as browser:
        context, page = _context_and_page(browser)
        _restore_trust_cookie(context, log=log)
        
        try:
            _open_signup(page, log)
            _human_fill(page, _EMAIL_INPUTS, email, stop=None)
            _human_fill(page, _PASSWORD_INPUTS, password, stop=None)
            accepted = _fill_and_create_account(page, username, config.max_username_tries, log)
            log(f"  Username accepted: {accepted}")
            
            state = _wait_post_submit(page, context, timeout=config.otp_timeout_sec, log=log)
            log(f"  Post-submit state: {state}")
            
            if state == "verify":
                log("  Waiting for verification code...")
                code = lit.wait_for_code(order_id, email=email, timeout=config.otp_timeout_sec, log=log)
                log(f"  Code: {code}")
                _fill_launch_code(page, code, log)
                time.sleep(3)
                lit.mark_success(order_id)
            
            # Step 4: Login and setup
            log("Step 3: Setting up GitHub account...")
            if not _try_login(page, accepted, password, context, log):
                page.goto("https://github.com/login")
                time.sleep(3)
                page.fill("#login_field", accepted)
                page.fill("#password", password)
                page.click('input[name="commit"]')
                time.sleep(4)
            
            # Create repo
            if config.create_repo:
                log("  Creating repository...")
                page.goto("https://github.com/new", wait_until="domcontentloaded")
                time.sleep(3)
                repo_name = _create_repository(page, accepted, config.repo_name, log)
                log(f"  Repo created: {repo_name}")
            
            # Enable 2FA
            if config.enable_2fa:
                log("  Enabling 2FA...")
                page.goto("https://github.com/settings/security", wait_until="domcontentloaded")
                time.sleep(3)
                
                # Click "Enable two-factor authentication"
                try:
                    enable_btn = page.locator('a[href*="two_factor_authentication/setup"]').first
                    if enable_btn.count() == 0:
                        enable_btn = page.get_by_role("link", name="Enable two-factor authentication").first
                    if enable_btn.count() and enable_btn.is_visible():
                        enable_btn.click()
                        time.sleep(3)
                except:
                    page.goto("https://github.com/settings/two_factor_authentication/setup/intro")
                    time.sleep(3)
                
                # Select authenticator app
                try:
                    page.get_by_role("link", name="Set up using an app").first.click(timeout=5000)
                except:
                    page.locator('a[href*="setup/app"]').first.click(timeout=5000)
                time.sleep(3)
                
                # Extract TOTP secret
                totp_secret = ""
                try:
                    secret_elem = page.locator("input#totp-secret").first
                    totp_secret = secret_elem.get_attribute("value") or ""
                except:
                    pass
                
                if not totp_secret:
                    # Try to find QR code data
                    try:
                        qr = page.locator("img[alt*='QR']").first
                        qr_src = qr.get_attribute("src") or ""
                        if "secret=" in qr_src:
                            totp_secret = qr_src.split("secret=")[1].split("&")[0]
                    except:
                        pass
                
                if not totp_secret:
                    # Try page text
                    body = page.locator("body").inner_text()
                    for line in body.split("\n"):
                        line = line.strip()
                        if len(line) >= 16 and line.isupper():
                            totp_secret = line
                            break
                
                log(f"  TOTP secret: {totp_secret}")
                
                if totp_secret:
                    # Enter TOTP code to verify
                    totp = pyotp.TOTP(totp_secret.replace(" ", ""))
                    code = totp.now()
                    log(f"  TOTP code: {code}")
                    page.locator("#totp-code, input[name='otp']").first.fill(code)
                    time.sleep(1)
                    try:
                        page.get_by_role("button", name="Verify").first.click(timeout=5000)
                    except:
                        page.locator("button[type='submit']").first.click(timeout=5000)
                    time.sleep(3)
                    
                    # Get recovery codes
                    recovery_codes = ""
                    try:
                        recovery_codes = page.locator("div.recovery-code-list, .two-factor-recovery-codes").first.inner_text()
                    except:
                        pass
                    
                    if recovery_codes:
                        log(f"  Recovery codes saved")
                        _save_recovery_per_account(email, recovery_codes, log)
                    
                    # Save recovery codes
                    try:
                        page.get_by_role("button", name="I have saved").first.click(timeout=5000)
                    except:
                        try:
                            page.locator("button:has-text('saved')").first.click(timeout=5000)
                        except:
                            pass
                    time.sleep(2)
                    
                    # Save to daftar_akun.md
                    entry = f"| {email} | {password} | {accepted} | {totp_secret} | {recovery_codes.replace(chr(10), ', ')[:200]} | ❌ | — |\n"
                    with open(OUTPUT, "a", encoding="utf-8") as f:
                        f.write(entry)
                    log(f"  Saved to daftar_akun.md")
                    
                    # Step 5: CodeBuddy OAuth
                    log("Step 4: CodeBuddy OAuth login...")
                    return codebuddy_oauth(email, accepted, totp_secret, password)
                else:
                    log("[!] Could not extract TOTP secret")
                    return False
            
            _save_trust_cookie(context, log=log)
            
        except SignupBlocked as e:
            log(f"[!] Signup blocked: {e}")
            lit.set_status(order_id, "CANCELED")
            return False
        except Exception as e:
            log(f"[!] Error: {e}")
            try:
                lit.set_status(order_id, "CANCELED")
            except:
                pass
            return False


def codebuddy_oauth(email, username, totp_secret, password):
    """Login to CodeBuddy via GitHub OAuth."""
    state, _ = request_codebuddy_device_code()
    log(f"  State: {state}")
    
    redirect_started = f"https://www.codebuddy.ai/started?platform=ide&state={state}"
    redirect_select = f"https://www.codebuddy.ai/login/select?redirect_uri={urllib.parse.quote(redirect_started, safe='')}"
    keycloak_url = (
        f"https://www.codebuddy.ai/auth/realms/copilot/protocol/openid-connect/auth"
        f"?client_id=console&response_type=code"
        f"&redirect_uri={urllib.parse.quote(redirect_select, safe='')}"
        f"&kc_idp_hint=github"
        f"&v=2210&product=codebuddy"
    )
    
    with Camoufox(headless=True, proxy={"server": PROXY_URL}, geoip=True) as b:
        p = b.new_page()
        p.set_default_timeout(35000)
        p.goto(keycloak_url, wait_until="domcontentloaded")
        time.sleep(4)
        
        if "github.com/login" in p.url:
            p.fill("#login_field", username)
            p.fill("#password", password)
            p.click('input[name="commit"]')
            time.sleep(4)
        
        if "two-factor" in p.url:
            totp = pyotp.TOTP(totp_secret.replace(" ", "")).now()
            p.locator("#app_totp").first.fill(totp)
            time.sleep(5)
        
        if "oauth/authorize" in p.url:
            try:
                p.get_by_role("button", name="Authorize").first.click(timeout=5000)
            except:
                pass
            time.sleep(5)
        
        if "first-broker-login" in p.url:
            body = p.locator("body").inner_text()[:500]
            log(f"  first-broker-login: {body[:200]}")
            if "restricted" in body.lower():
                log("[!] Account still restricted even with hotmail.com")
                return False
        
        for _ in range(15):
            if "started" in p.url or ("codebuddy.ai" in p.url and "login" not in p.url):
                break
            time.sleep(1)
    
    token_data = poll_codebuddy_token(state, timeout_sec=45)
    if token_data and token_data.get("accessToken"):
        cb_email, cb_name = extract_user_info(token_data["accessToken"])
        log(f"[SUCCESS] CodeBuddy: {cb_email} ({cb_name})")
        save_token_to_json(token_data, {"email": email, "username": username, "no": 0})
        save_connection_to_9router_db(token_data, {"email": email, "username": username, "no": 0})
        return True
    else:
        log("[FAILED] CodeBuddy token not acquired")
        return False


if __name__ == "__main__":
    cfg = load_config("config.json")
    cfg.register_count = 1
    success = create_single_account(cfg)
    print(f"\n{'SUCCESS' if success else 'FAILED'}")