# FOX SKILLS — FULL CAPABILITY MATRIX (102+ SKILLS)

## 🧠 REVERSE ENGINEERING & BINARY EXPLOITATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Stack overflow & ROP | MASTER | `stack-overflow-and-rop` |
| Heap exploitation (UAF, double-free, tcache) | EXPERT | `heap-exploitation` |
| Format string attacks | MASTER | `format-string-exploitation` |
| Kernel exploitation | EXPERT | `kernel-exploitation` |
| Browser exploitation (V8) | EXPERT | `browser-exploitation-v8` |
| Binary protection bypass (ASLR/NX/PIE/Canary) | MASTER | `binary-protection-bypass` |
| Anti-debugging bypass | MASTER | `anti-debugging-techniques` |
| Code obfuscation/deobfuscation | EXPERT | `code-obfuscation-deobfuscation` |
| Symbolic execution (angr, Z3) | EXPERT | `symbolic-execution-tools` |
| VM & bytecode reverse | EXPERT | `vm-and-bytecode-reverse` |
| Arbitrary write → RCE | MASTER | `arbitrary-write-to-rce` |
| x86/x64 disassembly | MASTER | — |
| IDA Pro / Ghidra / Binary Ninja | MASTER | — |
| x64dbg / OllyDbg / WinDbg | MASTER | — |
| PE/COFF analysis | MASTER | — |
| Binary diffing (BinDiff/Diaphora) | EXPERT | — |

## 💾 MEMORY OPERATIONS & PROCESS MANIPULATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Read/write process memory | MASTER | — |
| Pointer chain / multi-level ptr | MASTER | — |
| AOB scanning (pattern with mask) | MASTER | — |
| Cheat Engine scripting + Lua | MASTER | — |
| ReClass.NET structure reconstruction | MASTER | — |
| DLL injection (LoadLibrary, manual map, reflective) | MASTER | — |
| Shellcode injection | MASTER | — |
| Process hollowing / thread hijacking | MASTER | — |
| APC injection / Early Bird | MASTER | — |
| macOS process injection | EXPERT | `macos-process-injection` |

## 🪝 HOOKING TECHNIQUES
| Skill | Level | Skill File |
|-------|-------|------------|
| Detour hooks (manual + MinHook) | MASTER | — |
| IAT/EAT patching | MASTER | — |
| VMT hooking | MASTER | — |
| Inline hooks (x86/x64 + relocations) | MASTER | — |
| SSDT hooks / syscall interception | EXPERT | — |
| VEH (exception-based hooks) | EXPERT | — |
| Direct syscalls (Hell's Gate, Halo's Gate, SysWhispers) | MASTER | — |

## 💀 KERNEL & PLATFORM INTERNALS
| Skill | Level |
|-------|-------|
| Windows internals (kernel, drivers, minifilters) | MASTER |
| WinAPI / NTAPI / undocumented structures | MASTER |
| PEB, TEB, EPROCESS, KTHREAD | MASTER |
| Token manipulation / handle hijacking | MASTER |
| ASLR / DEP / CFG / CIG bypass | MASTER |
| PatchGuard / KPP / DSE bypass | EXPERT |
| ETW patching / AMSI bypass | MASTER |
| Windows AV evasion | MASTER |
| macOS security bypass (TCC, SIP, Gatekeeper) | EXPERT | `macos-security-bypass` |
| Linux security bypass (AppArmor, SELinux, seccomp) | EXPERT | `linux-security-bypass` |

## 🌐 WEB SECURITY — INJECTION
| Skill | Level | Skill File |
|-------|-------|------------|
| SQL injection (all types + WAF bypass) | MASTER | `sqli-sql-injection` |
| NoSQL injection | MASTER | `nosql-injection` |
| XSS (stored, reflected, DOM + CSP bypass) | MASTER | `xss-cross-site-scripting` |
| SSRF → internal/cloud metadata → keys | MASTER | `ssrf-server-side-request-forgery` |
| XXE (inband, blind, OOB) | MASTER | `xxe-xml-external-entity` |
| SSTI (15+ engines) | MASTER | `ssti-server-side-template-injection` |
| Command injection | MASTER | `cmdi-command-injection` |
| CRLF injection | MASTER | `crlf-injection` |
| HTTP Parameter Pollution | MASTER | `http-parameter-pollution` |
| Expression Language injection (SpEL, OGNL) | MASTER | `expression-language-injection` |
| JNDI injection (Log4Shell) | MASTER | `jndi-injection` |
| Ghost Bits / Cast Attack (Black Hat 2026) | EXPERT | `ghost-bits-cast-attack` |
| CSV/Formula injection (DDE) | EXPERT | `csv-formula-injection` |
| Dangling markup injection | EXPERT | `dangling-markup-injection` |
| XSLT injection → RCE | EXPERT | `xslt-injection` |
| Prototype pollution (client + server) | MASTER | `prototype-pollution` |
| Type juggling (PHP loose comparison) | MASTER | `type-juggling` |
| Injection router | MASTER | `injection-checking` |
| Request smuggling (HTTP/1.1 + H2) | MASTER | `request-smuggling` |
| HTTP/2 specific attacks | EXPERT | `http2-specific-attacks` |

## 🔐 AUTHENTICATION & AUTHORIZATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Auth bypass (22-pattern matrix) | MASTER | `authbypass-authentication-flaws` |
| JWT / OAuth token attacks | MASTER | `jwt-oauth-token-attacks` |
| API authorization & BOLA | MASTER | `api-authorization-and-bola` |
| IDOR (8-category systematic) | MASTER | `idor-broken-object-authorization` |
| OAuth/OIDC misconfiguration | EXPERT | `oauth-oidc-misconfiguration` |
| SAML SSO assertion attacks | EXPERT | `saml-sso-assertion-attacks` |
| 401/403 bypass techniques | MASTER | `401-403-bypass-techniques` |
| CORS misconfiguration | MASTER | `cors-cross-origin-misconfiguration` |
| CSRF | MASTER | `csrf-cross-site-request-forgery` |
| Open redirect | MASTER | `open-redirect` |
| Clickjacking | MASTER | `clickjacking` |
| Race conditions / TOCTOU | MASTER | `race-condition` |
| Business logic vulnerabilities | MASTER | `business-logic-vulnerabilities` |
| Auth & session security router | MASTER | `auth-sec` |

## 🌍 WEB EXPLOITATION — INFRASTRUCTURE
| Skill | Level | Skill File |
|-------|-------|------------|
| WAF bypass (encoding, chunked, vendor-specific) | MASTER | `waf-bypass-techniques` |
| HTTP Host header attacks | MASTER | `http-host-header-attacks` |
| Web cache deception / poisoning | MASTER | `web-cache-deception` |
| Insecure file upload → webshell | MASTER | `upload-insecure-files` |
| Path traversal / LFI → RCE | MASTER | `path-traversal-lfi` |
| Deserialization (Java/PHP/Python/.NET) | MASTER | `deserialization-insecure` |
| Subdomain takeover | MASTER | `subdomain-takeover` |
| DNS rebinding | EXPERT | `dns-rebinding-attacks` |
| Email header injection / spoofing | EXPERT | `email-header-injection` |
| Dependency confusion | EXPERT | `dependency-confusion` |
| WebSocket security (CSWSH) | EXPERT | `websocket-security` |
| Insecure source code management (.git/.svn) | MASTER | `insecure-source-code-management` |
| Unauthorized access common services | MASTER | `unauthorized-access-common-services` |

## 🔍 RECONNAISSANCE
| Skill | Level | Skill File |
|-------|-------|------------|
| Recon & methodology | MASTER | `recon-and-methodology` |
| API recon & documentation | MASTER | `api-recon-and-docs` |
| GraphQL introspection & hidden params | MASTER | `graphql-and-hidden-parameters` |
| Google dorking automation | MASTER | `fox-dorker` (custom) |
| Subdomain enumeration | MASTER | — |
| Technology fingerprinting | MASTER | — |
| Directory bruteforce | MASTER | — |
| Parameter discovery | MASTER | — |
| JS analysis (LinkFinder, SecretFinder) | MASTER | — |
| Recon category router | MASTER | `recon-for-sec` |
| API security router | MASTER | `api-sec` |
| File access vulnerability router | MASTER | `file-access-vuln` |
| Business logic router | MASTER | `business-logic-vuln` |

## 🏢 ACTIVE DIRECTORY DOMINATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Kerberoasting / AS-REP roasting | MASTER | `active-directory-kerberos-attacks` |
| DCSync / DCShadow | MASTER | — |
| Golden/Silver/Diamond/Sapphire Tickets | MASTER | — |
| NTLM relay & coercion | MASTER | `ntlm-relay-coercion` |
| Coerced auth (PetitPotam, PrinterBug, DFSCoerce) | MASTER | — |
| ADCS abuse (ESC1-ESC13) | MASTER | `active-directory-certificate-services` |
| ACL abuse (GenericAll, WriteDACL, DCSync rights) | MASTER | `active-directory-acl-abuse` |
| Delegation abuse (constrained/unconstrained/RBCD) | MASTER | — |
| Forest trust abuse, SID history injection | EXPERT | — |
| BloodHound map & analysis | MASTER | — |

## 🖥️ NETWORK, PIVOT & LATERAL MOVEMENT
| Skill | Level | Skill File |
|-------|-------|------------|
| Network pivoting (SOCKS, multi-hop, chisel, ligolo) | MASTER | `tunneling-and-pivoting` |
| Network protocol attacks (ARP/DNS/LLMNR) | MASTER | `network-protocol-attacks` |
| Reverse shells (all types, encrypted, staged) | MASTER | `reverse-shell-techniques` |
| Windows lateral movement (PsExec, WMI, WinRM, DCOM) | MASTER | `windows-lateral-movement` |
| Linux lateral movement (SSH key harvest, D-Bus) | MASTER | `linux-lateral-movement` |
| C2 frameworks (CS, Sliver, Havoc, Mythic) | MASTER | — |
| Malleable C2 / BOFs | MASTER | — |
| Evasion (sleep obfuscation, stack spoofing) | MASTER | `windows-av-evasion` |
| DNS/ICMP/HTTP tunneling | MASTER | — |
| Wireless (WPA2/3 cracking, PMKID, evil twin) | EXPERT | — |

## ⬆️ PRIVILEGE ESCALATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Linux privesc (SUID, sudo, kernel, cron, caps) | MASTER | `linux-privilege-escalation` |
| Windows privesc (Potato, service, DLL, token) | MASTER | `windows-privilege-escalation` |
| Container escape (Docker, LXC, K8s pod) | EXPERT | `container-escape-techniques` |
| Kubernetes pentesting (RBAC, etcd, Kubelet) | EXPERT | `kubernetes-pentesting` |
| Sandbox escape (Python, seccomp, chroot) | EXPERT | `sandbox-escape-techniques` |

## ☁️ CLOUD EXPLOITATION
| Skill | Level | Skill File |
|-------|-------|------------|
| AWS (SSRF→metadata→keys, Lambda, S3) | EXPERT | — |
| Azure (Managed Identity, Runbook RCE) | EXPERT | — |
| GCP (Service Account impersonation) | INTERMEDIATE | — |

## 🕷️ WEB SCRAPING & AUTOMATION
| Skill | Level | Skill File |
|-------|-------|------------|
| Stealth scraping (TLS fingerprint spoofing) | MASTER | — |
| Headless browser (Playwright/Puppeteer stealth) | MASTER | — |
| Anti-bot bypass (Cloudflare, DataDome, PerimeterX, Akamai) | MASTER | — |
| reCAPTCHA/hCaptcha/Cloudflare Turnstile solving | EXPERT | — |
| Kasada p.js deobfuscation | EXPERT | — |
| API reverse engineering (mitmproxy, HAR) | MASTER | — |
| Rate limit evasion | MASTER | — |
| Browser fingerprint randomization | MASTER | — |
| Fox-SQLi (custom SQLi toolkit) | MASTER | `fox-sqli` (custom) |
| Xerxes Network Assault | MASTER | `xerxes-network-assault` (custom) |

## 🎯 OSINT & SOCIAL ENGINEERING
| Skill | Level | Skill File |
|-------|-------|------------|
| OSINT (public records, metadata, DNS history) | MASTER | — |
| Doxing (digital footprint mapping) | MASTER | — |
| Phishing (GoPhish, Evilginx2, modlishka) | MASTER | — |
| Pretexting / vishing / spear phishing | EXPERT | — |
| Dark web intelligence | EXPERT | — |
| Credential stuffing infrastructure | MASTER | — |

## 📱 MOBILE HACKING
| Skill | Level | Skill File |
|-------|-------|------------|
| Android pentesting (APK, Frida, root bypass) | MASTER | `android-pentesting-tricks` |
| iOS pentesting (jailbreak, Frida, keychain) | EXPERT | `ios-pentesting-tricks` |
| Mobile SSL pinning bypass | MASTER | `mobile-ssl-pinning-bypass` |

## 🔐 CRYPTOGRAPHY & FORENSICS
| Skill | Level | Skill File |
|-------|-------|------------|
| RSA attacks (Wiener, Coppersmith, padding oracle) | EXPERT | `rsa-attack-techniques` |
| Symmetric cipher attacks (padding oracle, ECB, bit-flip) | EXPERT | `symmetric-cipher-attacks` |
| Lattice crypto attacks (LLL, HNP, knapsack) | EXPERT | `lattice-crypto-attacks` |
| Hash attacks (length extension, collision) | EXPERT | `hash-attack-techniques` |
| Classical cipher analysis | MASTER | `classical-cipher-analysis` |
| Memory forensics (Volatility) | EXPERT | `memory-forensics-volatility` |
| Steganography (LSB, zsteg, spectrogram) | EXPERT | `steganography-techniques` |
| Traffic analysis / PCAP forensics | EXPERT | `traffic-analysis-pcap` |

## 🔗 BLOCKCHAIN & AI
| Skill | Level | Skill File |
|-------|-------|------------|
| Smart contract vulns (reentrancy, overflow, flash loan) | EXPERT | `smart-contract-vulnerabilities` |
| DeFi attack patterns (MEV, oracle, bridge) | INTERMEDIATE | `defi-attack-patterns` |
| LLM prompt injection (direct, indirect, RAG) | EXPERT | `llm-prompt-injection` |
| AI/ML security (pickle RCE, adversarial) | EXPERT | `ai-ml-security` |

## 🛠️ HACK SKILLS ROUTER
| Skill | File |
|-------|------|
| Master entry point — phase assessment & routing | `hack` |
| Recon methodology | `recon-for-sec` |
| Injection testing | `injection-checking` |
| API security | `api-sec` |
| Authentication testing | `auth-sec` |
| Business logic testing | `business-logic-vuln` |
| File access testing | `file-access-vuln` |

## 🔧 CODING
| Skill | Level |
|-------|-------|
| C/C++ (system programming, tool dev) | MASTER |
| Python (scripts, automation, scraping) | MASTER |
| JavaScript/TypeScript (web, Node.js) | MASTER |
| MASM/NASM (assembly) | EXPERT |
| Lua (CE scripts) | MASTER |
| Go (tools, servers) | INTERMEDIATE |

---

*Total: 102+ offensive skills + 3 custom Fox tools*
*Last updated: 2026-06-07*
