# FOX-RECON-001: Full Domain Reconnaissance

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-RECON-001 |
| **Domain** | Reconnaissance |
| **MITRE** | T1046, T1082, T1083 (Multiple Discovery Techniques) |
| **Difficulty** | Easy |
| **Prerequisites** | Target domain name |

## Methodology
1. **Subdomain enumeration** (3 methods minimum):
   ```bash
   subfinder -d <target> -o subdomains.txt
   amass enum -d <target> -o amass_domains.txt
   curl -s "https://crt.sh/?q=%25.${target}&output=json" | jq -r '.[].name_value' >> crtsh_subdomains.txt
   # wayback machine
   curl -s "http://web.archive.org/cdx/search/cdx?url=*.${target}/*&output=text&fl=original&collapse=urlkey"
   ```
2. **Port scanning**:
   ```bash
   masscan -p1-65535 <target> --rate=1000 -oG masscan.gnmap
   nmap -sV -sC -p <open-ports-comma-sep> <target> -oA nmap_scan
   ```
3. **Tech fingerprinting**:
   ```bash
   whatweb -a 3 <target> --log-verbose=whatweb.log
   httpx -l subdomains.txt -tech-detect -o tech_report.txt
   ```
4. **Directory brute force**:
   ```bash
   ffuf -u https://<target>/FUZZ -w /usr/share/wordlists/dirb/common.txt -ac -o ffuf_results.json
   ```
5. **Parameter discovery**:
   ```bash
   katana -u https://<target> -o endpoints.txt
   gau --subs <target> | grep '=' | sort -u > params.txt
   ```
6. **JavaScript analysis**:
   ```bash
   python3 ~/tools/LinkFinder.py -i https://<target> -o cli
   python3 ~/tools/SecretFinder.py -i https://<target> -o cli
   ```

## Keywords
`recon-and-methodology`, `subdomain enumeration`, `subfinder`, `amass`, `crt.sh`, `nmap`, `masscan`, `whatweb`, `ffuf`, `katana`, `gau`, `LinkFinder`, `SecretFinder`, `tech fingerprint`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| Subdomain enumeration (15+ unique) | 20 |
| Port scan (top 1000+) | 15 |
| Service version scan (nmap -sV) | 15 |
| Tech stack identified | 10 |
| Directory brute force (200+ paths) | 15 |
| Parameter discovery (50+ params) | 15 |
| JS analysis (secrets found) | 10 |
| **Total** | **100** |
