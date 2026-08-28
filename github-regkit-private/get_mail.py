import sys
import io
import time
import requests
import json
import re
from github_register.profiles import extract_github_code

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_ID = "3454"
API_KEY = "zb3frnIJevoBNQQWiTEFp7ExqofD5vRr"
SITE = "github.com"
ZONE = "outlook.com"

def get_outlook_email():
    print(f"[*] Ordering 1 email from Litensi (Zone: {ZONE}, Site: {SITE})...")
    r = requests.post(
        "https://litensi.id/api/mail/order",
        data={
            "api_id": API_ID,
            "api_key": API_KEY,
            "site": SITE,
            "zone": ZONE
        },
        timeout=30
    )
    res = r.json()
    if not res.get("success"):
        print(f"[-] Gagal order email: {res}")
        return

    data = res["data"]
    email = data["email"]
    order_id = str(data["order_id"])

    print("\n" + "="*60)
    print(f"[EMAIL OUTLOOK KAMU] -> {email}")
    print(f"[ORDER ID] -> {order_id}")
    print("="*60)
    print("[*] Silakan copy email di atas dan paste ke GitHub kamu.")
    print("[*] Script sedang standby menunggu email masuk...\n")
    sys.stdout.flush()

    started = time.time()
    while time.time() - started < 300:
        time.sleep(4)
        try:
            status_res = requests.post(
                "https://litensi.id/api/mail/getstatus",
                data={
                    "api_id": API_ID,
                    "api_key": API_KEY,
                    "order_id": order_id
                },
                timeout=20
            ).json()

            if status_res.get("success"):
                d = status_res.get("data", {})
                status = str(d.get("status", ""))
                msg = d.get("message", "") or d.get("full_message", "")
                
                # Check for verification link in GitHub emails
                link_match = re.search(r'(https://github\.com/users/[^\s"\'<>]+/emails/[^\s"\'<>]+/confirm_verification/[^\s"\'<>]+)', msg)
                if not link_match:
                    link_match = re.search(r'(https://github\.com/confirm_email/[^\s"\'<>]+)', msg)
                if not link_match:
                    link_match = re.search(r'(https://github\.com/[^\s"\'<>]*confirm[^\s"\'<>]+)', msg)

                # Check for OTP code
                code = extract_github_code(msg)

                if link_match or code or status == "RECEIVED":
                    print("\n" + "🎉"*30)
                    if code:
                        print(f"🔑 KODE OTP GITHUB: {code}")
                    if link_match:
                        print(f"🔗 LINK VERIFIKASI GITHUB: {link_match.group(1)}")
                    if not code and not link_match:
                        print(f"📩 ISI PESAN LENGKAP:\n{msg[:500]}")
                    print("🎉"*30 + "\n")
                    sys.stdout.flush()

                    requests.post(
                        "https://litensi.id/api/mail/setstatus",
                        data={"api_id": API_ID, "api_key": API_KEY, "order_id": order_id, "status": "SUCCESS"},
                        timeout=10
                    )
                    return email, code or (link_match.group(1) if link_match else None)
                else:
                    print(f"[*] Menunggu pesan... status: {status}")
                    sys.stdout.flush()
        except Exception as e:
            print(f"[!] Polling error: {e}")
            sys.stdout.flush()

    print("[-] Timeout 5 menit.")
    return None, None

if __name__ == "__main__":
    get_outlook_email()
