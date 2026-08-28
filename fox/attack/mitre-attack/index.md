# MITRE ATT&CK v15 — Fox Full Mapping

```
                     ┌─────────────────────────────┐
                     │  INITIAL ACCESS (T1190+)     │
                     │  T1190 T1078 T1133 T1189     │
                     │  T1199                        │
                     └──────────┬──────────────────┘
                                │
                     ┌──────────▼──────────────────┐
                     │  EXECUTION (T1059+)          │
                     │  T1059 T1203 T1204 T1559     │
                     └──────────┬──────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼────────┐ ┌─────▼──────┐ ┌───────▼────────┐
     │ PERSISTENCE      │ │ DEFENSE    │ │ CREDENTIAL      │
     │ T1098 T1136      │ │ EVASION    │ │ ACCESS           │
     │ T1505 T1543      │ │ T1562 T1027│ │ T1003 T1558      │
     │ T1133 T1554      │ │ T1140 T1070│ │ T1555 T1552      │
     └────────┬────────┘ │ T1202 T1553│ │ T1110 T1557      │
              │          │ T1036      │ └────────┬────────┘
              │          └────────────┘          │
              │                                  │
     ┌────────▼──────────────────────────────────▼────────┐
     │              PRIVILEGE ESCALATION                   │
     │  T1068 T1548 T1574 T1055                            │
     └───────────────────────┬────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  DISCOVERY       │
                    │  T1046 T1082     │
                    │  T1083 T1087     │
                    │  T1069 T1018     │
                    │  T1040 T1057     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  LATERAL         │
                    │  MOVEMENT        │
                    │  T1550 T1021     │
                    │  T1570 T1091     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼──────┐ ┌─────▼─────────┐
     │ COLLECTION     │ │ C2        │ │ EXFILTRATION   │
     │ T1114 T1005    │ │ T1071     │ │ T1567 T1041    │
     └───────────────┘ │ T1573     │ │ T1052          │
                        │ T1090     │ └────────────────┘
                        │ T1102     │
                        └───────────┘
```

## Total Techniques Mapped

| Tactic | Technique Count | Fox Skills Mapped |
|--------|----------------|-------------------|
| Initial Access | 4 | 12+ unique skills |
| Execution | 3 | 6+ unique skills |
| Persistence | 5 | 12+ unique skills |
| Privilege Escalation | 4 | 12+ unique skills |
| Defense Evasion | 7 | 15+ unique skills |
| Credential Access | 5 | 12+ unique skills |
| Discovery | 7 | 14+ unique skills |
| Lateral Movement | 3 | 6+ unique skills |
| Collection | 2 | 2+ unique skills |
| Command & Control | 4 | 6+ unique skills |
| Exfiltration | 2 | 3+ unique skills |

**Total: 46 MITRE techniques mapped across 109+ Fox skill references**

### Using This Mapping
- **When planning an operation**: Select techniques from each tactic phase to build your kill chain
- **When reporting**: Reference technique IDs for professional red team documentation
- **When training**: Focus on gaps — which techniques are NOT covered by current skills?

---

*Full MITRE ATT&CK v15 matrix: https://attack.mitre.org/*
