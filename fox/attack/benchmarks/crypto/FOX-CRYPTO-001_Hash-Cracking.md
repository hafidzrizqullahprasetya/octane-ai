# FOX-CRYPTO-001: Hash Cracking Pipeline

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-CRYPTO-001 |
| **Domain** | Cryptography |
| **MITRE** | T1110.002 (Brute Force: Hash Cracking) |
| **Difficulty** | Easy |
| **Prerequisites** | Hash dump from any target (SQLi, LDAP, /etc/shadow, DCSync) |

## Methodology
1. **Identify hash type**:
   - MD5: `$1$...` or 32 hex chars
   - SHA-256: `$5$...` or 64 hex chars
   - SHA-512: `$6$...` or 128 hex chars
   - bcrypt: `$2a$...` / `$2b$...` / `$2y$...`
   - NTLM: 32 hex chars, no prefix
   - Kerberos (TGS-REP): hashcat mode 13100
   - NTDS: NTLM hashes from DCSync

2. **Hashcat mode selection**:
   | Hash Type | Mode | Example |
   |-----------|------|---------|
   | MD5 | 0 | `5d41402abc4b2a76b9719d911017c592` |
   | SHA1 | 100 | `a94a8fe5ccb19ba61c4c0873d391e987982fbbd3` |
   | SHA256 | 1400 | `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8` |
   | NTLM | 1000 | `b4b9b02e6f09a9bd760f388b67351e2b` |
   | bcrypt | 3200 | `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` |
   | Kerberos 5 TGS-REP | 13100 | `$krb5tgs$...` |

3. **Cracking with hashcat**:
   ```bash
   # NTLM with rockyou
   hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt --force
   
   # NTLM with rules
   hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule --force
   
   # Kerberos with mask
   hashcat -m 13100 kerb.txt -a 3 ?u?l?l?l?d?d?d?d --force
   
   # bcrypt (slow) with small wordlist
   hashcat -m 3200 bcrypt_hashes.txt small_wordlist.txt --force
   ```

4. **Post-cracking analysis**:
   - Check password patterns → generate custom rules
   - Spray cracked passwords across other services
   - Check for password reuse across users

5. **Common wordlists**:
   - `/usr/share/wordlists/rockyou.txt` (14M passwords)
   - `SecLists/Passwords/` (multiple files)
   - Custom: Generate from target context (company name, location, etc.)

## Keywords
`hashcat`, `hash cracking`, `password cracking`, `NTLM`, `Kerberos`, `bcrypt`, `MD5`, `SHA1`, `SHA256`, `hashcat rules`, `rockyou`, `wordlist attack`, `mask attack`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| Hash type correctly identified | 15 |
| Hashcat mode selected correctly | 15 |
| Basic wordlist attack attempted | 20 |
| Rule-based attack attempted | 20 |
| At least 1 hash cracked | 20 |
| Password pattern analysis | 10 |
| **Total** | **100** |
