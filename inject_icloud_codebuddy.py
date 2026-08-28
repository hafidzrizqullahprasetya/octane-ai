import sqlite3
import json
import uuid
import base64
import requests
from datetime import datetime, timezone

db_path = "C:/Users/fizzu/AppData/Roaming/9router/db/data.sqlite"
db = sqlite3.connect(db_path)
cur = db.cursor()

tokens = [
    "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJXVzhVVkZuS0lNSnl3cFdQWjBEWTZxeE9LQ2dpcVVjNXN3RHBkVjM1UUV3In0.eyJleHAiOjE4MTkzMDU0NzUsImlhdCI6MTc4Nzc2OTQ5MywiYXV0aF90aW1lIjoxNzg3NzY5NDc1LCJqdGkiOiI0NDM0OGNlZi1lMDRkLTQ5ZDEtYTJmNS1hYWE3MzJhMGIwNjIiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIwNDA4MmE2ZC04MzE4LTQ5MjItOWExNy1iNjZiZGFkYjNkMzgiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiM2NhNDRkNzMtNWMxNi00NzE4LWJmMjYtMmIwMjlkYTBjNjRjIiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkpvcmRhbiBMZWUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0YXJpLW1heDIyOTAiLCJnaXZlbl9uYW1lIjoiSm9yZGFuIiwiZmFtaWx5X25hbWUiOiJMZWUiLCJlbWFpbCI6InBvdGZ1bHMud2hpcmxzLTZvQGljbG91ZC5jb20ifQ.EF6LbN5uEqN-04mjZMIoj5OkqGvFTIIymcV3Ha6rhFitb9ggK7DgJwhG7as4AB5ITD7-ky33o2rioFOudksRDAIp6n8lgQGtfTkYHg7IKk6u7CEnUevFicVlHVI82b79paH761JIqagkMxIxKQCZxOMy3yF9DhjiCMETBTkq_Ax_nH_pzWjoNZio5f0lO4BxfZGahBw0m4Tl2-OQCnTUq7cc1wrqJkGWI2eaOdsJbNB-98gL3cnCfk_GqNT7cIEAPb9WgJxIpbJxJq9SNEb6SCa43eS5Jqa1fERGSr4nnkmAdejTNHOtzxuDydNYiuQ9LOgPxu--i_dMi1vrD16KlQ",
    "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJXVzhVVkZuS0lNSnl3cFdQWjBEWTZxeE9LQ2dpcVVjNXN3RHBkVjM1UUV3In0.eyJleHAiOjE4MTkzMDYyODEsImlhdCI6MTc4Nzc3MDI5OSwiYXV0aF90aW1lIjoxNzg3NzcwMjgxLCJqdGkiOiJlMDI4OTgzYy03NzgyLTQzYmQtYTE2MC04MDMxMTQ2OWE2OTQiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIyMTcwMmVlMi05MDQwLTRjYTQtOTYzMC1jYjFlY2M2ZDY2YWIiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiMTA1ZjhiMjUtMDQzMC00NDAyLTkwNDYtMTUxODc5N2Y5NGI4IiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkphbWllIENydXoiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJoYWxpbS1tYXgxMDIxIiwiZ2l2ZW5fbmFtZSI6IkphbWllIiwiZmFtaWx5X25hbWUiOiJDcnV6IiwiZW1haWwiOiJmbGVkZ2VkLmNhcmFtZWxfNmVAaWNsb3VkLmNvbSJ9.m1Qx1NAVY52IV3xA9MeTMWZapjkC8HaNmFAd5WXsLc8sppSmzm7KCokt1m2_m9VqKoqUE_U-lRvXDApIlqK1JmfKWOYSAZASLVXOMh7-a6bEridiztG_uaGkfqzTMmCxtTAEfztENEcFN9DmlMw25Anq39bUjaJSQJQmZ0afBnt1g2YHKYI5vII92HMgiEtLVLvk7UaSGoyHLX1q6Hwr7kNmbaScbSyEFwCEoyFCjL2ml5EzCIMI0VfLCSQypDXcPAUzU23O4QHe9MTsbP3tDufud1IZApyZFuo1offLYqQZ8jFHyHLvA9eH5HbuyQ06FgdWXSi13EneweRJ8XFz-A"
]

def parse_jwt(token):
    parts = token.split(".")
    padded = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))

cur.execute("SELECT data FROM providerConnections WHERE provider = 'codebuddy-intl' LIMIT 1")
row = cur.fetchone()
proxy_pool_id = None
proxy_pool_ids = []
if row:
    existing_data = json.loads(row[0])
    proxy_pool_id = existing_data.get('proxyPoolId')
    proxy_pool_ids = existing_data.get('proxyPoolIds', [proxy_pool_id] if proxy_pool_id else [])

now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

for token in tokens:
    payload = parse_jwt(token)
    email = payload.get("email")
    name = payload.get("name") or payload.get("preferred_username") or email
    exp_ts = payload.get("exp")
    exp_iso = datetime.fromtimestamp(exp_ts, timezone.utc).isoformat().replace("+00:00", "Z") if exp_ts else "2027-08-26T18:30:00.000Z"
    
    cur.execute("SELECT id FROM providerConnections WHERE provider = 'codebuddy-intl' AND email = ?", (email,))
    existing = cur.fetchone()
    
    conn_data = {
        "accessToken": token,
        "refreshToken": "",
        "expiresAt": exp_iso,
        "testStatus": "active",
        "expiresIn": 31536000,
        "displayName": name,
        "providerSpecificData": {
            "proxyPoolIds": proxy_pool_ids,
            "proxyRotationStrategy": "none"
        }
    }
    if proxy_pool_id:
        conn_data["proxyPoolId"] = proxy_pool_id
        conn_data["proxyPoolIds"] = proxy_pool_ids
        
    data_json = json.dumps(conn_data)
    
    if existing:
        cur.execute("UPDATE providerConnections SET data = ?, name = ?, isActive = 1, updatedAt = ? WHERE id = ?", (data_json, name, now_iso, existing[0]))
        print(f"[+] Updated connection for {email} ({name})")
    else:
        new_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO providerConnections (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
            VALUES (?, 'codebuddy-intl', 'oauth', ?, ?, 1, 1, ?, ?, ?)
        """, (new_id, name, email, data_json, now_iso, now_iso))
        print(f"[+] Injected new connection for {email} ({name}) [ID: {new_id}]")

db.commit()
print("[*] Database commit successful!")

print("\n[*] Testing live quota & API resource for both accounts...")
for token in tokens:
    payload = parse_jwt(token)
    email = payload.get("email")
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "IDE/2.63.2 CodeBuddy/2.63.2",
        "X-Product": "SaaS",
        "x-requested-with": "XMLHttpRequest",
        "x-codebuddy-request": "1"
    }
    try:
        res = requests.post("https://www.codebuddy.ai/v2/billing/meter/get-user-resource", headers=headers, json={}, timeout=10)
        print(f"\n[Test Quota] {email} -> Status: {res.status_code}")
        if res.ok:
            print("Quota Data:", json.dumps(res.json(), indent=2))
        else:
            print("Response:", res.text)
    except Exception as e:
        print(f"[!] Error testing {email}: {e}")

    # Test small chat completion
    try:
        chat_payload = {
            "model": "glm-5.2",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "ping"}
            ],
            "stream": True
        }
        chat_res = requests.post("https://www.codebuddy.ai/v2/chat/completions", headers=headers, json=chat_payload, timeout=10, stream=True)
        print(f"[Test Chat] {email} -> Status: {chat_res.status_code}")
        if chat_res.ok:
            print("Chat response preview: OK (Stream connected successfully)")
        else:
            print("Chat error:", chat_res.text)
    except Exception as e:
        print(f"[!] Chat error {email}: {e}")
