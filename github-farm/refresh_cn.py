"""Refresh CodeBuddy CN token and update DB"""
import http.client, json, sqlite3, datetime, os

DB = r"C:\Users\fizzu\AppData\Roaming\9router\db\data.sqlite"
RT = "eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI2M2I4YzRkNS1jMTJjLTRhMGQtYjk5NC01ZTBjMDY0N2QwMDIifQ.eyJleHAiOjE3OTU1ODIxNjYsImlhdCI6MTc4NzgwNjE2NiwianRpIjoiMTExNmUzNTUtOTNjYi00ZjcxLTkwMWItOGI4NjgyMTMzZjZkIiwiaXNzIjoiaHR0cHM6Ly93d3cuY29kZWJ1ZGR5LmNuL2F1dGgvcmVhbG1zL2NvcGlsb3QiLCJhdWQiOiJodHRwczovL3d3dy5jb2RlYnVkZHkuY24vYXV0aC9yZWFsbXMvY29waWxvdCIsInN1YiI6IjRiNzY5NWFlLWRlMTEtNGJjOC05YjdlLTFjNDczZmMxMjNlZCIsInR5cCI6Ik9mZmxpbmUiLCJhenAiOiJjb25zb2xlIiwic2lkIjoiMjQyYjA0ZDItNzc2ZS00ODQ5LWEyNmUtY2E1ODlhMzIxNzcxIiwic2NvcGUiOiJvcGVuaWQgYWNyIHByb2ZpbGUgYmFzaWMgd2ViLW9yaWdpbnMgcm9sZXMgb2ZmbGluZV9hY2Nlc3MgZW1haWwifQ.IMFRRKCEc1cmSMt1c6TWD1Vd8fYGyq3XkuBMfa4NPs5mQggDxU9q892MWecs0dOBAlicLq_GnrQzhmCXJ21Kiw"

# Step 1: Refresh token via direct HTTP (no proxy)
conn = http.client.HTTPSConnection('copilot.tencent.com', timeout=15)
headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'CLI/2.63.2 CodeBuddy/2.63.2',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Domain': 'copilot.tencent.com',
    'X-Refresh-Token': RT,
    'X-Auth-Refresh-Source': 'plugin',
    'X-Product': 'SaaS',
}
conn.request('POST', '/v2/plugin/auth/token/refresh', '{}', headers)
resp = conn.getresponse()
data = json.loads(resp.read().decode())
conn.close()

if data['code'] != 0:
    print(f'Refresh FAILED: {data}')
    exit(1)

new_at = data['data']['accessToken']
new_rt = data['data'].get('refreshToken', RT)
expires_in = data['data'].get('expiresIn', 5184000)
expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)

print(f'Refresh OK')
print(f'New AT: {new_at[:60]}...')
print(f'New RT: {new_rt[:60]}...')
print(f'Expires: {expires_at.isoformat()}')

# Step 2: Update DB
db = sqlite3.connect(DB)
cur = db.cursor()

cur.execute("SELECT id, data FROM providerConnections WHERE provider = 'codebuddy-cn' LIMIT 1")
row = cur.fetchone()
if not row:
    print('No codebuddy-cn connection!')
    exit(1)

conn_id = row[0]
current = json.loads(row[1])
current['accessToken'] = new_at
current['refreshToken'] = new_rt
current['expiresAt'] = expires_at.isoformat().replace('+00:00', 'Z')
current['testStatus'] = 'active'

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
cur.execute(
    'UPDATE providerConnections SET data = ?, updatedAt = ? WHERE id = ?',
    (json.dumps(current), now_iso, conn_id)
)
db.commit()
db.close()

print(f'\nDB updated: {conn_id}')
print(f'\n--- NEW TOKENS ---')
print(f'Access Token:\n{new_at}')
print(f'\nRefresh Token:\n{new_rt}')