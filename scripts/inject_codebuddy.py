import sqlite3
import json
import uuid
import requests
from datetime import datetime, timezone

db_path = "C:/Users/fizzu/AppData/Roaming/9router/db/data.sqlite"
db = sqlite3.connect(db_path)
cur = db.cursor()

accounts_to_inject = [
  {
    "email": "qrxzfh@gacew.com",
    "name": "Mala Rahimah",
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJXVzhVVkZuS0lNSnl3cFdQWjBEWTZxeE9LQ2dpcVVjNXN3RHBkVjM1UUV3In0.eyJleHAiOjE4MTkzMDE4MzQsImlhdCI6MTc4Nzc2NTg0MSwiYXV0aF90aW1lIjoxNzg3NzY1ODM0LCJqdGkiOiI0NWRjODYwZi0zN2Q0LTQ0NDMtODM5NS0xMGQ5ODY4ZDRhMmQiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiI2YjA2YzA2NC02MDUxLTQ5OGQtOGVjZi00YWRiODY4ZTQ1OWQiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiNTNmOTQ4MzYtY2Q0Zi00MmQ0LWEyYzItZThmNjgwY2VhZjMxIiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Ik1hbGEgUmFoaW1haCIsInByZWZlcnJlZF91c2VybmFtZSI6InFyeHpmaEBnYWNldy5jb20iLCJnaXZlbl9uYW1lIjoiTWFsYSIsImZhbWlseV9uYW1lIjoiUmFoaW1haCIsImVtYWlsIjoicXJ4emZoQGdhY2V3LmNvbSJ9.GIozxlbxkne1_uRjrcbk2zLx0Ir2mVIPkWoG16hNRgtbO-Wmj05TjqOo2NF4rBSyuhHNOy79n3S_vPTsk9JsCETL2njjYxGN-IBxErJSMk7vLWaDwcUtJAAvhhbk1kCkiK_wZqBIEosRRzDnwNtoVthQGlE5LTb0Dordhpl3dNxtMizhKiHO1PmzdZuixobnV_CRkNlzW3DiCMCvXndK-EeT2fhzqZpW7kcAzBjzgz_l9HKzdSV49QXLUibXZozd6ycCdB4za3tVNKKV5Md8RR-RcJYtJWUb8K_X0N1a19H9KW3cTCyveh_F7Khpx9TadXILWyvpmZkXxifyRNjKKg",
    "refreshToken": "eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJjMWM0OWU5Yi0wYWU2LTQyMWMtOTVmOS05ODdiMDk4NjljNTUifQ.eyJleHAiOjE4MTkzMDE4MzQsImlhdCI6MTc4Nzc2NTg0MSwianRpIjoiNmQ4MzU0YzEtYjE1Yy00NGU2LTg5NGEtOTVkN2VjNmQ5ZmY5IiwiaXNzIjoiaHR0cHM6Ly93d3cuY29kZWJ1ZGR5LmFpL2F1dGgvcmVhbG1zL2NvcGlsb3QiLCJhdWQiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsInN1YiI6IjZiMDZjMDY0LTYwNTEtNDk4ZC04ZWNmLTRhZGI4NjhlNDU5ZCIsInR5cCI6Ik9mZmxpbmUiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiNTNmOTQ4MzYtY2Q0Zi00MmQ0LWEyYzItZThmNjgwY2VhZjMxIiwic2NvcGUiOiJvcGVuaWQgYWNyIHByb2ZpbGUgYmFzaWMgd2ViLW9yaWdpbnMgcm9sZXMgb2ZmbGluZV9hY2Nlc3MgZW1haWwifQ.hVgXzSJQ2PQZupmdFGdum2wvjrPzzsSNR8aHM-VVV97wAzGokWwl_7KNUApymGVraa-28DxbyrYVezlcVMCrxA",
    "expiresIn": 31535972
  },
  {
    "email": "dfycpc@gacew.com",
    "name": "Raisa Nababan",
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJXVzhVVkZuS0lNSnl3cFdQWjBEWTZxeE9LQ2dpcVVjNXN3RHBkVjM1UUV3In0.eyJleHAiOjE4MTkzMDIzMTIsImlhdCI6MTc4Nzc2NjMxNCwiYXV0aF90aW1lIjoxNzg3NzY2MzEyLCJqdGkiOiIwNmM2NGZkYS1hMDc2LTQ0NmQtYjgxYy03OTgwMzZhZmU3OTQiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiI5YjE2NmEyMS1iZDNmLTQ0YWYtOGYwYS1hNTExMDJjZWJjOWIiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiYWJkZmU0NjYtOGEzMy00ODA1LTk2ZGItYTJlYzc3OTE0Y2QwIiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlJhaXNhIE5hYmFiYW4iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJkZnljcGNAZ2FjZXcuY29tIiwiZ2l2ZW5fbmFtZSI6IlJhaXNhIiwiZmFtaWx5X25hbWUiOiJOYWJhYmFuIiwiZW1haWwiOiJkZnljcGNAZ2FjZXcuY29tIn0.bK74fDMCdsgVNOupyVRlqqx_K_704LcGqVybcIPKhO8w-xC3enMSiEz43vJWNit6jGy32z_FV03SaTFD9jZpe8xhX8Z3YHKp3ot1Muc9Y67E9_qpfCPmGRtAXEFFEEHEHlaYCdNrPmAJSvk6XK-p_s6u0cfvJK1__rlpHiNCszu0oROjXm878ex2e93GFx_L1Mu4g8IoU6dubYEpEc-ZaJ1y4JoBwp0k5_av7MGjhGsoC2aZXmuIcEZaeQU63_zlAQYbITL4HbyfbEJfF8GZBAniyLNqdKJpqzUNo4jnMbp9Pj_iM-cjEMG6gVt7jRCSoiiqicEVPVxogCGYMs-ktA",
    "refreshToken": "eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJjMWM0OWU5Yi0wYWU2LTQyMWMtOTVmOS05ODdiMDk4NjljNTUifQ.eyJleHAiOjE4MTkzMDIzMTIsImlhdCI6MTc4Nzc2NjMxNCwianRpIjoiZmQ0OTMxZTktYmU3Yi00MTlhLWI3OGQtNDRlNmRiMWFjMTFmIiwiaXNzIjoiaHR0cHM6Ly93d3cuY29kZWJ1ZGR5LmFpL2F1dGgvcmVhbG1zL2NvcGlsb3QiLCJhdWQiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuYWkvYXV0aC9yZWFsbXMvY29waWxvdCIsInN1YiI6IjliMTY2YTIxLWJkM2YtNDRhZi04ZjBhLWE1MTEwMmNlYmM5YiIsInR5cCI6Ik9mZmxpbmUiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiYWJkZmU0NjYtOGEzMy00ODA1LTk2ZGItYTJlYzc3OTE0Y2QwIiwic2NvcGUiOiJvcGVuaWQgYWNyIHByb2ZpbGUgYmFzaWMgd2ViLW9yaWdpbnMgcm9sZXMgb2ZmbGluZV9hY2Nlc3MgZW1haWwifQ.TmzJy8g7kRQ1fV_DvZklNHs5AxZHVyMJ5NT3kH-aCXyLE-LMMT2rvnB2h7ZndwiapaF17b2V7xXGbuLdzHE3Kg",
    "expiresIn": 31535969
  }
]

cur.execute("SELECT data FROM providerConnections WHERE provider = 'codebuddy-intl' LIMIT 1")
row = cur.fetchone()
proxy_pool_id = None
proxy_pool_ids = []
if row:
    existing_data = json.loads(row[0])
    proxy_pool_id = existing_data.get('proxyPoolId')
    proxy_pool_ids = existing_data.get('proxyPoolIds', [proxy_pool_id] if proxy_pool_id else [])

now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

for acc in accounts_to_inject:
    cur.execute("SELECT id FROM providerConnections WHERE provider = 'codebuddy-intl' AND email = ?", (acc['email'],))
    existing = cur.fetchone()
    
    conn_data = {
        "accessToken": acc["accessToken"],
        "refreshToken": acc["refreshToken"],
        "expiresAt": "2027-08-26T18:30:00.000Z",
        "testStatus": "active",
        "expiresIn": acc["expiresIn"],
        "displayName": acc["name"],
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
        cur.execute("UPDATE providerConnections SET data = ?, name = ?, isActive = 1, updatedAt = ? WHERE id = ?", (data_json, acc['name'], now_iso, existing[0]))
        print(f"[+] Updated connection for {acc['email']}")
    else:
        new_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO providerConnections (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
            VALUES (?, 'codebuddy-intl', 'oauth', ?, ?, 1, 1, ?, ?, ?)
        """, (new_id, acc['name'], acc['email'], data_json, now_iso, now_iso))
        print(f"[+] Injected new connection for {acc['email']} (ID: {new_id})")

db.commit()
print("[*] Database commit successful!")

# Verify quota directly from CodeBuddy API
for acc in accounts_to_inject:
    headers = {
        "Authorization": f"Bearer {acc['accessToken']}",
        "User-Agent": "IDE/2.63.2 CodeBuddy/2.63.2",
        "X-Product": "SaaS",
        "x-requested-with": "XMLHttpRequest",
        "x-codebuddy-request": "1"
    }
    res = requests.post("https://www.codebuddy.ai/v2/billing/meter/get-user-resource", headers=headers, json={}, timeout=10)
    print(f"\n[Test API] {acc['name']} ({acc['email']}) -> Status: {res.status_code}")
    if res.ok:
        print("Quota payload:", res.json())
