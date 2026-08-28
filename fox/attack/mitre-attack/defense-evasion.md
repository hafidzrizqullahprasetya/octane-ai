# MITRE ATT&CK — Defense Evasion

## T1562 — Impair Defenses
| Fox Skill | Description |
|-----------|-------------|
| `windows-av-evasion` | AMSI bypass / ETW patching / unhooking |
| `windows-av-evasion` | Kill AV/EDR processes / services |
| `anti-debugging-techniques` | Evade debugger / sandbox detection |
| `linux-security-bypass` | Disable SELinux / AppArmor / auditd |

## T1027 — Obfuscated Files or Information
| Fox Skill | Description |
|-----------|-------------|
| `code-obfuscation-deobfuscation` | Obfuscate payloads / shellcode |
| `windows-av-evasion` | Encrypted/encoded payload staging |
| `steganography-techniques` | Hide data in images/audio/files |
| `waf-bypass-techniques` | Obfuscate SQLi/XSS payloads for WAF bypass |

## T1140 — Deobfuscate/Decode Files or Info
| Fox Skill | Description |
|-----------|-------------|
| `code-obfuscation-deobfuscation` | Unpack protected binaries |
| `steganography-techniques` | Extract hidden data from files |

## T1070 — Indicator Removal on Host
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Clear bash_history / syslog / audit logs |
| `windows-privilege-escalation` | Clear EventLog / Prefetch / recent files |
| `anti-debugging-techniques` | Anti-forensics — timestomp, log tampering |

## T1202 — Indirect Command Execution
| Fox Skill | Description |
|-----------|-------------|
| `windows-av-evasion` | LOLBins (certutil, mshta, regsvr32) |
| `cmdi-command-injection` | Minimal/no-log command execution |

## T1553 — Subvert Trust Controls
| Fox Skill | Description |
|-----------|-------------|
| `active-directory-certificate-services` | Forge certs via CA abuse |
| `windows-av-evasion` | DLL sideloading with legit-signed binaries |

## T1036 — Masquerading
| Fox Skill | Description |
|-----------|-------------|
| `request-smuggling` | Hide malicious requests in legitimate-looking ones |
| `reverse-shell-techniques` | Shell process disguised as svchost/systemd |

---

*Map to: MITRE ATT&CK v15 — Defense Evasion*
