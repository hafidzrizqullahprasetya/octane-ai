# Rules of Engagement (ROE) Template

> Use this template to define scope, boundaries, and authorization for every operation.
> Fill in `[bracketed]` sections before starting any engagement.

---

## 1. Operational Metadata

| Field | Value |
|-------|-------|
| **Operation Name** | `[OP_NAME]` |
| **Client/Target** | `[TARGET]` |
| **Date(s)** | `[START]` → `[END]` |
| **Authorized By** | `[AUTHORITY]` |
| **Fox Operator** | `[OPERATOR]` |
| **Classification** | `[CONFIDENTIAL / SECRET / TOP SECRET]` |

## 2. Scope

### In-Scope Assets
```
- [IP Range / CIDR]
- [Domain(s)]
- [Application(s)]
- [API endpoints]
- [Cloud accounts]
```

### Explicitly Out-of-Scope
```
- [Production DB servers — read replica only]
- [Customer PII — mask/anon on extraction]
- [Third-party hosted services]
- [Partner networks]
- [Legacy systems]
```

## 3. Constraints

### Timing
- [ ] 24/7 testing authorized
- [ ] Testing only during: `[HH:MM]` → `[HH:MM]` in `[TZ]`
- [ ] No testing on: `[dates/holidays]`
- [ ] Rate limit: `[X]` requests/second to production services

### Impact Limits
- [ ] No denial of service (DoS) — any vector
- [ ] DoS allowed only on: `[target/system]`
- [ ] No destructive SQL (DROP / TRUNCATE / DELETE)
- [ ] No password changes (lockout risk)
- [ ] No account lockout testing
- [ ] No social engineering (phishing/vishing)
- [ ] Phishing allowed on: `[target group]`
- [ ] Physical testing (tailgating/badge clone) requires 48h notice

### Data Handling
- [ ] No storage of PII beyond engagement duration
- [ ] Encrypt all extracted data at rest (AES-256)
- [ ] Data retention period: `[X]` days after engagement
- [ ] Use `.fox-vault/` with encryption for all credentials
- [ ] Report format: `targets/<target>-report.md`

## 4. Communication

### Reporting Cadence
- **Daily sync**: `[TIME]` via `[CHANNEL]`
- **Critical finding**: Notify within `[X]` hours
- **Compromise proof**: Screenshot or log required for every owned asset
- **Final report**: Due `[X]` days after engagement end

### Escalation Contacts
| Priority | Contact | Method |
|----------|---------|--------|
| Critical (service down) | `[NAME]` | `[PHONE]` |
| PII exposure | `[NAME]` | `[PHONE]` |
| Technical blocker | `[NAME]` | `[SLACK]` |

## 5. Authorization

### Signature

```
_________________________        _________________________
[Client Representative]         [Date]

_________________________        _________________________
[Fox Operator]                  [Date]
```

### Special Authorizations
- [ ] Active Directory credential dumping (DCSync) authorized
- [ ] Web shell persistence authorized for `[X]` days
- [ ] SSH key persistence authorized
- [ ] SQLi data extraction authorized — all databases
- [ ] Lateral movement authorized — all internal hosts
- [ ] Physical access tools authorized

---

## Change Log

| Version | Date | Change | Authorizer |
|---------|------|--------|-----------|
| 1.0 | `[DATE]` | Initial ROE | `[NAME]` |
