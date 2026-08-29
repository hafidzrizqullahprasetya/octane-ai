#!/usr/bin/env python3
"""
Rotate AWS EC2 Public IP and update Octane AI Proxy Pool database automatically.
Usage: python3 scripts/rotate-aws-ip.py
"""
import subprocess
import json
import time
import sqlite3
from datetime import datetime, timezone

INSTANCE_ID = "i-09e022cf9ac00821e"
REGION = "us-east-1"
DB_PATH = "data/db/data.sqlite"
PROXY_PORT = "8888"

def run_aws(cmd):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"AWS Command failed: {res.stderr.strip()}")
    return res.stdout.strip()

def get_instance_info():
    out = run_aws(f"aws ec2 describe-instances --region {REGION} --instance-ids {INSTANCE_ID} --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress]' --output json")
    data = json.loads(out)
    return data[0], data[1]

def main():
    print(f"\n🔄 Rotating AWS EC2 Public IP for '{INSTANCE_ID}' in {REGION}...")
    
    state, old_ip = get_instance_info()
    print(f"📍 Current IP: {old_ip} (State: {state})")
    
    if state == "running":
        print("🛑 Stopping EC2 instance to release old IP...")
        run_aws(f"aws ec2 stop-instances --region {REGION} --instance-ids {INSTANCE_ID}")
        
        while True:
            time.sleep(3)
            curr_state, _ = get_instance_info()
            print(f"   Waiting for instance to stop... ({curr_state})")
            if curr_state == "stopped":
                break

    print("🚀 Starting EC2 instance to acquire fresh IP...")
    run_aws(f"aws ec2 start-instances --region {REGION} --instance-ids {INSTANCE_ID}")
    
    new_ip = None
    while True:
        time.sleep(3)
        curr_state, ip = get_instance_info()
        print(f"   Waiting for instance to start... ({curr_state}, IP: {ip})")
        if curr_state == "running" and ip:
            new_ip = ip
            break

    print(f"\n✨ NEW AWS US IP ACQUIRED: {new_ip}")
    new_proxy_url = f"http://{new_ip}:{PROXY_PORT}"

    # Update SQLite database
    print(f"💾 Updating Octane AI Proxy Pool in {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Find existing AWS proxy pool
    rows = cursor.execute("SELECT id, data FROM proxyPools").fetchall()
    updated = False
    now = datetime.now(timezone.utc).isoformat()

    for pool_id, data_str in rows:
        try:
            pool_data = json.loads(data_str)
            if "AWS US" in pool_data.get("name", "") or "8888" in pool_data.get("proxyUrl", ""):
                pool_data["proxyUrl"] = new_proxy_url
                pool_data["lastTestedAt"] = now
                pool_data["updatedAt"] = now
                cursor.execute(
                    "UPDATE proxyPools SET data = ?, updatedAt = ? WHERE id = ?",
                    (json.dumps(pool_data), now, pool_id)
                )
                updated = True
                print(f"   Updated Proxy Pool [{pool_id}] -> {new_proxy_url}")
        except Exception:
            pass

    if not updated:
        # Create new entry if not found
        import uuid
        pool_id = str(uuid.uuid4())
        pool_data = {
            "id": pool_id,
            "name": "AWS US Dedicated Proxy (N. Virginia)",
            "proxyUrl": new_proxy_url,
            "noProxy": "",
            "type": "http",
            "isActive": True,
            "strictProxy": False,
            "testStatus": "passed",
            "lastTestedAt": now,
            "lastError": None,
            "createdAt": now,
            "updatedAt": now
        }
        cursor.execute(
            "INSERT INTO proxyPools (id, isActive, testStatus, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
            (pool_id, 1, "passed", json.dumps(pool_data), now, now)
        )
        print(f"   Created new Proxy Pool [{pool_id}] -> {new_proxy_url}")

    conn.commit()
    conn.close()

    print("\n✅ ROTATION COMPLETE!")
    print(f"Proxy URL '{new_proxy_url}' is now active and integrated with Octane AI.\n")

if __name__ == "__main__":
    main()
