# MITRE ATT&CK — Collection, Exfiltration & C2

## Collection

### T1114 — Email Collection
| Fox Skill | Description |
|-----------|-------------|
| `email-header-injection` | Intercept email via SMTP injection |
| `phishing` (via OSINT) | Capture credentials via Evilginx2 |

### T1005 — Data from Local System
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Grab /etc/passwd, /etc/shadow, configs |
| `windows-privilege-escalation` | Grab SAM, LSASS, files |

## Exfiltration

### T1567 — Exfiltration Over Web Service
| Fox Skill | Description |
|-----------|-------------|
| `tunneling-and-pivoting` | Exfil via DNS tunneling / ICMP / HTTP |
| `traffic-analysis-pcap` | Encode data in network protocols |

### T1041 — Exfiltration Over C2 Channel
| Fox Skill | Description |
|-----------|-------------|
| C2 frameworks | Exfil over C2 beacon (Sliver, Havoc, CS) |

### T1052 — Exfiltration Over Physical Medium
| Fox Skill | Description |
|-----------|-------------|
| Physical access tools | USB drop / badge clone extraction |

## Command & Control

### T1071 — Application Layer Protocol
| Fox Skill | Description |
|-----------|-------------|
| `tunneling-and-pivoting` | DNS / HTTP / HTTPS tunnels |
| `reverse-shell-techniques` | Reverse shells over TCP/HTTP/HTTPS |

### T1573 — Encrypted Channel
| Fox Skill | Description |
|-----------|-------------|
| `tunneling-and-pivoting` | SSH tunnel / chisel encrypted |
| `windows-av-evasion` | Encrypted C2 beacon traffic |

### T1090 — Proxy
| Fox Skill | Description |
|-----------|-------------|
| `tunneling-and-pivoting` | SOCKS proxy / chisel SOCKS5 |
| Reverse shell chaining | Multi-hop proxy chaining |

### T1102 — Web Service (C2)
| Fox Skill | Description |
|-----------|-------------|
| C2 via legit services | Slack/Discord/Telegram as C2 channel |
| `web-cache-deception` | Poison cache to store C2 data |

---

*Map to: MITRE ATT&CK v15 — Collection, Exfiltration, C2*
