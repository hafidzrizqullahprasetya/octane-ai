import sys
import io
import time
import requests
import json
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_ID = "3454"
API_KEY = "zb3frnIJevoBNQQWiTEFp7ExqofD5vRr"
SITE = "twitter.com"
ZONE = "outlook.com"

def get_twitter_email():
    print(f"[*] Memesan email Outlook untuk Twitter/X dari Litensi...")
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
    print(f"[EMAIL OUTLOOK UNTUK TWITTER/X] -> {email}")
    print("="*60)
    print("[*] Silakan paste email di atas ke halaman daftar Twitter/X.")
    print("[*] Script sedang standby menunggu kode OTP Twitter/X masuk...\n")
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
                
                # Check for 6 or 8 digit code in Twitter emails
                code_match = re.search(r'\b([0-9]{6,8})\b', msg)
                
                if code_match or status == "RECEIVED":
                    code = code_match.group(1) if code_match else "Cek pesan"
                    print("\n" + "🎉"*30)
                    print(f"🔑 KODE VERIFIKASI TWITTER/X: {code}")
                    if msg:
                        print(f"📩 Pesan: {msg[:300]}")
                    print("🎉"*30 + "\n")
                    sys.stdout.flush()

                    requests.post(
                        "https://litensi.id/api/mail/setstatus",
                        data={"api_id": API_ID, "api_key": API_KEY, "order_id": order_id, "status": "SUCCESS"},
                        timeout=10
                    )
                    return email, code
                else:
                    print(f"[*] Menunggu OTP... status: {status}")
                    sys.stdout.flush()
        except Exception as e:
            print(f"[!] Polling error: {e}")
            sys.stdout.flush()

    print("[-] Timeout 5 menit.")
    return None, None

if __name__ == "__main__":
    get_twitter_email()
