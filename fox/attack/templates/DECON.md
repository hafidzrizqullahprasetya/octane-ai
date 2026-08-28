# Deconfliction Plan (DECON) Template

> Prevents operational conflicts between concurrent Fox agents, other operators, or ongoing defensive activities.
> Fill in `[bracketed]` sections before multi-agent or multi-team operations.

---

## 1. Operational Identifiers

| Field | Value |
|-------|-------|
| **Operation(s)** | `[OP_NAME_1]`, `[OP_NAME_2]` |
| **Coordinator** | `[NAME]` |
| **Agents/Operators** | `[AGENT_1]`, `[AGENT_2]`, `[AGENT_3]` |
| **Contact Channel** | `[SLACK / DISCORD / MATRIX]` |
| **Conflict Window** | `[START]` → `[END]` |

## 2. Asset Allocation

### Primary Targets — FIRST COVER
| Asset | Primary Agent | Backup Agent | Lockout Duration |
|-------|--------------|-------------|-----------------|
| `[TARGET_HOST_1]` | `[AGENT_A]` | `[AGENT_B]` | `[2h]` |
| `[TARGET_HOST_2]` | `[AGENT_B]` | `[AGENT_A]` | `[2h]` |
| `[DOMAIN]` | `[AGENT_C]` | `[AGENT_A]` | `[4h]` |

### Shared Resources
| Resource | Rotation Rule | Access Method |
|----------|--------------|--------------|
| C2 server (1.2.3.4:443) | Agent A: 00-04h, Agent B: 04-08h | Encrypted beacon |
| Proxy pool (residential) | Fair queuing — 5 requests each | Rotating proxy |
| SQL account (reader) | Read-only — no concurrent writes | Single connection |

## 3. Conflict Types & Resolution

| Conflict Type | Example | Resolution |
|--------------|---------|-----------|
| **Target Collision** | Both agents attack same host | Primary agent has priority; backup waits `[X]` minutes |
| **Credential Overwrite** | Both agents add backdoor user | Pre-arranged usernames — Agent A = `[USER_A]`, Agent B = `[USER_B]` |
| **Resource Starvation** | Both need 100% bandwidth | Throttle each to 50%, or time-slice |
| **Detection Cascade** | Agent A triggers alert, ruins stealth for Agent B | Separate C2 channels with distinct behaviors |
| **Persistence Conflict** | Agent A deletes Agent B's webshell | Pre-arranged persistence locations — no cross-cleanup |
| **Network Scan Clash** | Both agents scan same subnet | Stagger scans by `[X]` minutes |

## 4. Deconfliction Zones

```
┌─────────────────────────────────────────────────────┐
│                   FULL NETWORK                         │
│  ┌─────────────────┐    ┌─────────────────┐          │
│  │ AGENT A ZONE     │    │ AGENT B ZONE     │         │
│  │ 10.0.1.0/24      │    │ 10.0.2.0/24      │         │
│  │ Web tier          │    │ DB tier           │         │
│  └─────────────────┘    └─────────────────┘          │
│                    ┌──────────────┐                     │
│                    │ DMZ (shared)  │                     │
│                    │ Load balancer │                     │
│                    │ Only read ops  │                    │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────┘
```

## 5. Escalation Procedure

```
Agent detects conflict?
   │
   ├→ Is it MINOR (rate limit, duplicate scan)?
   │     → Resolve autonomously — back off 60s, retry
   │
   ├→ Is it MODERATE (same target, credential collision)?
   │     → Notify coordinator via channel
   │     → Wait `[X]` seconds for resolution
   │     → If no response, escalate to MAJOR
   │
   └→ Is it MAJOR (data corruption, detection, service outage)?
         → IMMEDIATELY STOP all agents
         → Coordinator makes call
         → Incident report required
```

## 6. Emergency Stop (Kill Switch)

**Trigger Conditions:**
- [ ] Service degradation reported by target/system
- [ ] Unauthorized data access (outside scope)
- [ ] Law enforcement involvement
- [ ] ROE violation detected
- [ ] Client requests stop

**Kill Command:**
```bash
# Emergency stop all Fox agents
echo "EMERGENCY STOP: [REASON]" | tee /dev/tty
touch .fox-vault/EMERGENCY_STOP
# Protocol: All agents cease within 60 seconds
# After stop:
# 1. Back up all collected data
# 2. Remove all persistence
# 3. Clear all logs created by agents
# 4. Document stop reason in .fox-vault/logs/incident-[DATE].md
```

## 7. Cleanup Protocol

### Per-Agent Cleanup
- [ ] Remove files uploaded to target
- [ ] Delete backdoor accounts
- [ ] Revoke SSH keys, webshells
- [ ] Clear command history, logs
- [ ] Revert configuration changes

### Cross-Agent Cleanup
- [ ] Verify no agent left artifacts in another agent's zone
- [ ] Consolidate all extracted data to vault `/archive/`
- [ ] Verify persistence removal across all agents

## 8. Post-Op Deconfliction Report

```
DECON REPORT — [OP_NAME]
Date: [DATE]

Conflicts Encountered:
  1. [Conflict description with timestamp]
     → Resolution: [How it was resolved]
     → Impact: [None / Low / Medium / High]

  2. [Conflict description with timestamp]
     → Resolution: [How it was resolved]
     → Impact: [None / Low / Medium / High]

Successfully Deconflicted: YES / NO
Lessons Learned: [1-2 sentences]
```

---

## Change Log

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 1.0 | `[DATE]` | Initial DECON | `[NAME]` |
