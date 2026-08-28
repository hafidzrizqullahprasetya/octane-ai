"""Inject CodeBuddy CN account into 9Router DB"""
import sqlite3, json, uuid, datetime

DB = r"C:\Users\fizzu\AppData\Roaming\9router\db\data.sqlite"

TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJteWZFenA3ODNLaV9KQ3g4Vm5jM1hfaXg2alpyYjZDZjVPTWtHWk1QSTNzIn0.eyJleHAiOjE3OTI5OTAxNjYsImlhdCI6MTc4NzgwNjE2NiwiYXV0aF90aW1lIjoxNzg3ODA2MTU5LCJqdGkiOiJkYTYxM2M5ZC1hNmVjLTQwNDYtOTU2NS1mMDI3N2I3ZDZjMzEiLCJpc3MiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuY24vYXV0aC9yZWFsbXMvY29waWxvdCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiI0Yjc2OTVhZS1kZTExLTRiYzgtOWI3ZS0xYzQ3M2ZjMTIzZWQiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiMjQyYjA0ZDItNzc2ZS00ODQ5LWEyNmUtY2E1ODlhMzIxNzcxIiwiYWNyIjoiMCIsImFsbG93ZWQtb3JpZ2lucyI6WyIqIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzIiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6IjU2Njc3NDUxIn0.JCmvJGVMEDdb8B1iHyCULz_wULbV1tWRMLlZNXbbVh4FoahwKpefnuVM-dz7tWiFQWsDhHHW3wfPpZNSgBljzc5lxb4uM3oYNlA4bFAsghG6J4BYmitpDNb972bpoxXUrdjAWiyvkbsEELk7BFcdWRPhELnD9jXDwGt95CGU15oFq1wjU8Xyfzbb2zR4IpaBaLAlfHBUWAfaUSxzkibdomvnA08DX3eFQz6Oh0G4ZfvVnO0uPKvDM6UrB8_PPwmi-pb5EDl1b-6iNfXhiZNClVO6aHfzm4aO_2HX-NUtb5jaZEEyKbaNngS9LG5DCU33cckHaeGvO8C7co_Qd_eDfw"
REFRESH = "eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI2M2I4YzRkNS1jMTJjLTRhMGQtYjk5NC01ZTBjMDY0N2QwMDIifQ.eyJleHAiOjE3OTU1ODIxNjYsImlhdCI6MTc4NzgwNjE2NiwianRpIjoiMTExNmUzNTUtOTNjYi00ZjcxLTkwMWItOGI4NjgyMTMzZjZkIiwiaXNzIjoiaHR0cHM6Ly93d3cuY29kZWJ1ZGR5LmNuL2F1dGgvcmVhbG1zL2NvcGlsb3QiLCJhdWQiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuY24vYXV0aC9yZWFsbXMvY29waWxvdCIsInN1YiI6IjRiNzY5NWFlLWRlMTEtNGJjOC05YjdlLTFjNDczZmMxMjNlZCIsInR5cCI6Ik9mZmxpbmUiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiMjQyYjA0ZDItNzc2ZS00ODQ5LWEyNmUtY2E1ODlhMzIxNzcxIiwic2NvcGUiOiJvcGVuaWQgYWNyIHByb2ZpbGUgYmFzaWMgd2ViLW9yaWdpbnMgcm9sZXMgb2ZmbGluZV9hY2Nlc3MgZW1haWwifQ.IMFRRKCEc1cmSMt1c6TWD1Vd8fYGyq3XkuBMfa4NPs5mQggDxU9q892MWecs0dOBAlicLq_GnrQzhmCXJ21Kiw"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# Check existing codebuddy-cn connections
cur.execute("SELECT id, name FROM providerConnections WHERE provider = 'codebuddy-cn'")
existing = cur.fetchall()
print(f"Existing codebuddy-cn: {len(existing)}")
for e in existing:
    print(f"  {e[0]}: {e[1]}")

# Check for duplicate token
cur.execute("SELECT id, name FROM providerConnections WHERE provider = 'codebuddy-cn' AND json_extract(data, '$.accessToken') = ?", (TOKEN,))
dup = cur.fetchone()
if dup:
    print(f"DUPLICATE: {dup[0]} - {dup[1]}")
    conn.close()
    exit()

# Find max account index
cur.execute("SELECT name FROM providerConnections WHERE provider = 'codebuddy-cn'")
max_idx = 0
for row in cur.fetchall():
    nm = row[0] or ""
    parts = nm.split()
    if len(parts) >= 2 and parts[1].isdigit():
        val = int(parts[1])
        if val > max_idx:
            max_idx = val

next_name = f"Account {max_idx + 1}"
new_id = str(uuid.uuid4())
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

data_json = json.dumps({
    "accessToken": TOKEN,
    "refreshToken": REFRESH,
    "expiresAt": "2026-10-26T04:49:26.000Z",
    "testStatus": "active",
    "consecutiveUseCount": 0,
    "user": {
        "sub": "4b7695ae-de11-4bc8-9b7e-1c473fc123ed",
        "preferred_username": "56677451",
        "phone": "+85256677451"
    }
})

cur.execute("""
    INSERT INTO providerConnections (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
""", (new_id, "codebuddy-cn", "oauth", next_name, "56677451@codebuddy.cn", data_json, now_iso, now_iso))

conn.commit()
conn.close()

print(f"\nINJECTED: {next_name} (codebuddy-cn)")
print(f"ID: {new_id}")
print(f"Phone: +85256677451")
print(f"Expires: 2026-10-26")