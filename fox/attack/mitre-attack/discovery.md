# MITRE ATT&CK — Discovery

## T1046 — Network Service Discovery
| Fox Skill | Description |
|-----------|-------------|
| `recon-and-methodology` | Port scan / service enum / version detection |
| `network-protocol-attacks` | ARP sweep / ICMP sweep / subnet enum |
| `ssrf-server-side-request-forgery` | SSRF → internal network service discovery |

## T1082 — System Information Discovery
| Fox Skill | Description |
|-----------|-------------|
| `linux-privilege-escalation` | Kernel version / OS / running services |
| `windows-privilege-escalation` | Systeminfo / hostname / patch level |
| `recon-and-methodology` | HTTP headers → server/tech fingerprint |

## T1083 — File and Directory Discovery
| Fox Skill | Description |
|-----------|-------------|
| `path-traversal-lfi` | LFI to enumerate filesystem |
| `insecure-source-code-management` | Directory listing / .git exposure |

## T1087 — Account Discovery
| Fox Skill | Description |
|-----------|-------------|
| `active-directory-acl-abuse` | BloodHound — map AD users/groups |
| `linux-privilege-escalation` | /etc/passwd / id / whoami |
| `sqli-sql-injection` | Extract user tables from DB |

## T1069 — Permission Groups Discovery
| Fox Skill | Description |
|-----------|-------------|
| `active-directory-acl-abuse` | Enumerate group memberships |
| `active-directory-kerberos-attacks` | Find kerberoastable accounts |

## T1018 — Remote System Discovery
| Fox Skill | Description |
|-----------|-------------|
| `windows-lateral-movement` | net view / AD enumeration / ping sweep |
| `linux-lateral-movement` | SSH config / known_hosts analysis |
| `recon-and-methodology` | Subdomain enum → find related systems |

## T1040 — Network Share Discovery
| Fox Skill | Description |
|-----------|-------------|
| `windows-lateral-movement` | SMB share enumeration |
| `active-directory-acl-abuse` | File share permissions misconfigs |

## T1057 — Process Discovery
| Fox Skill | Description |
|-----------|-------------|
| Memory operations | Read process list from remote hosts |
| `linux-privilege-escalation` | ps aux / top analysis |
| `windows-privilege-escalation` | Tasklist / Get-Process |

---

*Map to: MITRE ATT&CK v15 — Discovery*
