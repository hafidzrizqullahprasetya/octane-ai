# MITRE ATT&CK — Persistence

## T1098 — Account Manipulation
| Fox Skill | Description |
|-----------|-------------|
| `active-directory-acl-abuse` | Create/modify AD accounts with privileges |
| `active-directory-certificate-services` | ESC9/ESC10 — enroll persistent certs |

## T1136 — Create Account
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Add sudo user / SSH key backdoor |
| `windows-privilege-escalation` | Add local admin / domain user |

## T1505 — Server Software Component
| Fox Skill | Description |
|-----------|-------------|
| `upload-insecure-files` | Webshell persistence on web server |
| `sqli-sql-injection` | Database trigger/stored proc backdoor |
| `ssrf-server-side-request-forgery` | SSRF to register webhooks/callbacks |

## T1543 — Create or Modify System Process
| Fox Skill | Description |
|-----------|-------------|
| `windows-privilege-escalation` | Create service / scheduled task persistence |
| `linux-privilege-escalation` | Cron job / systemd service persistence |

## T1133 — External Remote Services (Persistence)
| Fox Skill | Description |
|-----------|-------------|
| `ssh-key backdoor` (via `linux-privilege-escalation`) | SSH authorized_keys persistence |
| `windows-av-evasion` | WMI event subscription persistence |

## T1554 — Compromise Client Software Binary
| Fox Skill | Description |
|-----------|-------------|
| `code-obfuscation-deobfuscation` | Modify binary to include backdoor |
| `process-hollowing` (via memory ops) | Replace legit process with payload |
| `dll-injection` (via process manipulation) | DLL hijacking/search-order hijacking |

---

*Map to: MITRE ATT&CK v15 — Persistence*
