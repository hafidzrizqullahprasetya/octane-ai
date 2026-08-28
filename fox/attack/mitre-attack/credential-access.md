# MITRE ATT&CK — Credential Access

## T1003 — OS Credential Dumping
| Fox Skill | Description |
|-----------|-------------|
| `windows-privilege-escalation` | SAM / LSASS / DPAPI dumping |
| `windows-lateral-movement` | DCSync for domain credentials |
| `memory-forensics-volatility` | Extract creds from memory dumps |

## T1558 — Steal or Forge Kerberos Tickets
| Fox Skill | Description |
|-----------|-------------|
| `active-directory-kerberos-attacks` | Kerberoasting / AS-REP roasting |
| `active-directory-kerberos-attacks` | Golden / Silver / Diamond Ticket |
| `active-directory-kerberos-attacks` | Pass-the-ticket / Overpass-the-hash |

## T1555 — Credentials from Password Stores
| Fox Skill | Description |
|-----------|-------------|
| `android-pentesting-tricks` | Extract creds from Android apps |
| `ios-pentesting-tricks` | Keychain dumping on iOS |
| `path-traversal-lfi` | Read config files with DB creds |

## T1552 — Unsecured Credentials
| Fox Skill | Description |
|-----------|-------------|
| `insecure-source-code-management` | Extract creds from .git/config files |
| `path-traversal-lfi` | Read .env / config files with secrets |
| `recon-and-methodology` | Google dork for leaked credentials |

## T1110 — Brute Force
| Fox Skill | Description |
|-----------|-------------|
| `authbypass-authentication-flaws` | Password spray / brute force login |
| `sqli-sql-injection` | SQLi auth bypass on login forms |

## T1557 — Adversary-in-the-Middle
| Fox Skill | Description |
|-----------|-------------|
| `network-protocol-attacks` | LLMNR/NBT-NS poisoning → capture hashes |
| `ntlm-relay-coercion` | NTLM relay → capture auth tokens |

---

*Map to: MITRE ATT&CK v15 — Credential Access*
