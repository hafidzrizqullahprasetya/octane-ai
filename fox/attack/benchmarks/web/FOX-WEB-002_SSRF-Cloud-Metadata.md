# FOX-WEB-002: SSRF — Cloud Metadata Access

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-WEB-002 |
| **Domain** | Web Security |
| **MITRE** | T1190 (Initial Access) |
| **Difficulty** | Medium |
| **Prerequisites** | URL with `url`, `path`, `file`, `redirect`, `proxy`, or `load` parameter |

## Methodology
1. **Detection**: Submit internal IP (`http://127.0.0.1:80`), observe response content
2. **Local file access**: `file:///etc/passwd`, `file:///etc/hosts`
3. **Cloud metadata**:
   - AWS: `http://169.254.169.254/latest/meta-data/`
   - AWS IMDSv2: First `PUT http://169.254.169.254/latest/api/token` with header `X-aws-ec2-metadata-token-ttl-seconds: 21600`, then use token
   - GCP: `http://metadata.google.internal/computeMetadata/v1/` with `Metadata-Flavor: Google`
   - Azure: `http://169.254.169.254/metadata/instance?api-version=2021-02-01` with `Metadata: true`
   - Alibaba: `http://100.100.100.200/latest/meta-data/`
   - DigitalOcean: `http://169.254.169.254/metadata/v1.json`
   - OpenStack: `http://169.254.169.254/openstack/`
4. **Internal services**: Try common internal ports (22, 80, 443, 3306, 6379, 9200, 27017, 5000, 8080, 8443)
5. **Blind SSRF**: Use collaborator/interactsh to detect OOB
6. **Bypass**: URL encoding, alternative IP notation (decimal/hex/octal), DNS rebinding

## Keywords
`ssrf-server-side-request-forgery`, `cloud metadata`, `169.254.169.254`, `AWS`, `GCP`, `Azure`, `IMDSv2`, `internal service`, `blind SSRF`, `OOB detection`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| SSRF detection confirmed | 20 |
| File read (`file://` or internal HTTP) | 20 |
| Cloud metadata accessed (any provider) | 25 |
| Internal service probe (3+ ports) | 15 |
| Blind SSRF attempt (OOB) | 10 |
| Bypass technique attempted | 10 |
| **Total** | **100** |
