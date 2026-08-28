# MITRE ATT&CK — Initial Access

## T1190 — Exploit Public-Facing Application
| Fox Skill | Description |
|-----------|-------------|
| `sqli-sql-injection` | SQL injection on public endpoints |
| `cmdi-command-injection` | Command injection via web params |
| `upload-insecure-files` | File upload RCE on public forms |
| `path-traversal-lfi` | LFI to read configs/creds |
| `ssrf-server-side-request-forgery` | SSRF to internal services |
| `deserialization-insecure` | Deserialization RCE on public APIs |
| `xxe-xml-external-entity` | XXE to read files/SSRF |
| `request-smuggling` | HTTP smuggling to bypass front-end |

## T1078 — Valid Accounts
| Fox Skill | Description |
|-----------|-------------|
| `authbypass-authentication-flaws` | Auth bypass using default/weak creds |
| `type-juggling` | PHP type juggling auth bypass |
| `jwt-oauth-token-attacks` | JWT alg none / key confusion |

## T1133 — External Remote Services
| Fox Skill | Description |
|-----------|-------------|
| `unauthorized-access-common-services` | Exploiting exposed RDP/SSH/VPN |
| `subdomain-takeover` | Takeover dangling DNS → access |

## T1189 — Drive-by Compromise
| Fox Skill | Description |
|-----------|-------------|
| `xss-cross-site-scripting` | XSS to hijack user sessions |
| `dangling-markup-injection` | HTML injection without JS |
| `open-redirect` | Redirect users to malicious sites |

## T1199 — Trusted Relationship
| Fox Skill | Description |
|-----------|-------------|
| `dependency-confusion` | Supply chain via package confusion |
| `email-header-injection` | Email spoofing from trusted domains |
| `llm-prompt-injection` | Indirect prompt injection via trusted data sources |

---

*Map to: MITRE ATT&CK v15 — Initial Access*
