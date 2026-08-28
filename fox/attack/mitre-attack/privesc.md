# MITRE ATT&CK — Privilege Escalation

## T1068 — Exploitation for Privilege Escalation
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Linux kernel exploit / SUID / capabilities |
| `windows-privilege-escalation` | Windows kernel exploit / Token / Potato |
| `kernel-exploitation` | Kernel-level exploit for ring0 |
| `browser-exploitation-v8` | Sandbox escape → system-level code exec |

## T1548 — Abuse Elevation Control Mechanism
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Sudo misconfig / doas / pkexec |
| `windows-privilege-escalation` | UAC bypass / AlwaysInstallElevated |
| `401-403-bypass-techniques` | Bypass auth controls to access admin |

## T1574 — Hijack Execution Flow
| Fox Skill | Description |
|-----------|-------------|
| `windows-privilege-escalation` | DLL hijacking / search order hijacking |
| `linux-privilege-escalation` | LD_PRELOAD / PATH hijacking |
| `container-escape-techniques` | Escape container → namespace abuse |

## T1055 — Process Injection
| Fox Skill | Description |
|-----------|-------------|
| Process Manipulation (DLL injection) | Inject into elevated process |
| Process hollowing / thread hijacking | Run code in context of higher-priv process |
| APC injection / Early Bird | Async procedure call to elevate |
| `macos-process-injection` | Injection on macOS via DYLIB/XPC |

---

*Map to: MITRE ATT&CK v15 — Privilege Escalation*
