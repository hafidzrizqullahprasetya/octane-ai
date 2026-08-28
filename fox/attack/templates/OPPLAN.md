# Operation Plan (OPPLAN) Template

> Derived from Decepticon operational framework. Maps each phase to MITRE ATT&CK.
> Fill in `[bracketed]` sections for each operation.

---

## 1. Mission Brief

| Field | Value |
|-------|-------|
| **Operation** | `[OP_NAME]` |
| **Objective** | `[COMPROMISE / DATA EXFIL / PERSISTENCE / DESTRUCTION]` |
| **Target** | `[TARGET]` |
| **Classification** | `[LEVEL]` |
| **Ops Lead** | Fox — operator: `[OPERATOR]` |

**Operational Goal:**
```
[2-3 sentences: what we're trying to achieve and why]
```

## 2. Target Overview

| Attribute | Value | Source |
|-----------|-------|--------|
| Network Range | `[CIDR]` | `[SOURCE]` |
| Domain(s) | `[DOMAIN]` | `[SOURCE]` |
| Tech Stack | `[TECH]` | Recon |
| WAF/CDN | `[WAF]` | Recon |
| AD Domain | `[AD_DOMAIN]` | Recon |
| Cloud Provider | `[CLOUD]` | Recon |

## 3. Attack Chain (MITRE ATT&CK Mapped)

### Phase 1: Initial Access
| Technique ID | Vector | Expected Outcome | Fallback |
|-------------|--------|-----------------|----------|
| T1190 | SQLi on `[URL]` | Web shell | SSRF on `[URL]` |
| T1133 | Exposed RDP `[IP]` | Local access | SSH brute `[IP]` |
| T1078 | Default creds `[SERVICE]` | Admin panel | JWT bypass |

### Phase 2: Privilege Escalation
| Technique ID | Vector | Target Privilege | Fallback |
|-------------|--------|-----------------|----------|
| T1068 | Kernel exploit `[CVE]` | root | Sudo misconfig |
| T1068 | SeImpersonate | SYSTEM | UAC bypass |
| T1068 | AD CS abuse | DA | Kerberoast → crack |

### Phase 3: Credential Access
| Technique ID | Target | Method | Storage |
|-------------|--------|--------|---------|
| T1003.003 | LSASS on DC | DCSync | `.fox-vault/hashes/` |
| T1003.001 | /etc/shadow | File read | `.fox-vault/hashes/` |
| T1558.003 | Kerberos tickets | Rubeus dump | `.fox-vault/tokens/` |

### Phase 4: Collection & Exfil
| Objective | Method | Technique ID |
|-----------|--------|-------------|
| DB credentials | SQLi dump | T1005 |
| AD user list | BloodHound | T1087.002 |
| Source code | .git download | T1005 |
| Data exfil | DNS tunnel | T1048.003 |

## 4. Asset Ownership Plan

| Asset | Owner After Ops | Persistence Method | Cleanup |
|-------|-----------------|--------------------|-----|
| Web server | Fox | PHP webshell | Remove after `[X]` days |
| Domain Controller | Fox | Golden Ticket + DSRM | Revoke tickets |
| Cloud account | Fox | IAM backdoor user | Delete keys |
| Mail server | Fox | SMTP relay | Remove relay rule |

## 5. Timeline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| RECON (Phase 1) | `[0-4h]` | None |
| INITIAL ACCESS | `[1-8h]` | Recon complete |
| PRIVESC | `[1-4h]` | Foothold obtained |
| LATERAL MOVEMENT | `[2-8h]` | Domain access |
| DATA EXFIL | `[1-4h]` | All access obtained |
| CLEANUP | `[30m]` | Exfil complete |

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Service disruption | Low | High | Avoid destructive SQL / kernel exploits on prod |
| Account lockout | Medium | Medium | No brute force on domain accounts |
| Detection by SOC | High | Low | Ghost mode — clear logs, timestomp |
| WAF blocking IP | Medium | Medium | Use proxy rotation, origin IP bypass |
| Legal/Policy violation | Low | Critical | Follow ROE — if uncertain, pause |

## 7. Success Criteria

- [ ] Initial access achieved on `[TARGET]`
- [ ] Privilege escalated to `[ROOT / SYSTEM / DA]`
- [ ] Credential access obtained (`[X]` sets)
- [ ] Data exfiltrated (`[X]` MB/GB)
- [ ] Persistence established (`[X]` methods)
- [ ] No detection triggered (stealth op) OR detection acceptable (noisy op)
- [ ] All artifacts cleaned / left intentionally

## 8. OPSEC Measures

- [ ] All traffic routed through proxy chain / VPN
- [ ] C2 traffic encrypted (AES-256 + TLS)
- [ ] Credentials stored at rest encrypted
- [ ] Tools use randomized filenames (no `payload.exe` / `shell.php`)
- [ ] Logs cleared on exit (if order requires)
- [ ] No personal identifiable info in C2 comms (use codenames)

## 9. Approval

```
_________________________        _________________________
[Operator]                       [Date]

_________________________        _________________________
[Authorizer]                     [Date]
```

---

## Change Log

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | `[DATE]` | Initial OPPLAN | `[NAME]` |
