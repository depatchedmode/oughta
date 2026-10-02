# Make It So workflow

Follow this graph using the pass conditions in [SKILL.md](../SKILL.md). It is a process specification, not an executable state-machine runtime. Every arrow is a control transition; recording findings and follow-up candidates is a side effect, never a route around the gates.

```mermaid
flowchart TD
    START[Issue, resumed run, or changed context] --> SYNC[Reconcile requirements, decisions, deliverable,<br/>tested snapshots, base/head, and evidence]
    SYNC --> NEXT{Earliest unfinished or invalidated stage?}
    NEXT -- Planning --> PLAN[Inspect spec, repository, and relevant skills<br/>Plan implementation and accessible verification]
    NEXT -- Gate 1 --> IMPLEMENT
    NEXT -- Gate 2 --> REVIEW
    NEXT -- Gate 3 --> IMPROVE
    NEXT -- Delivery, all gates current --> PR
    PLAN --> DECISION{Unresolved owner-level decision?}
    DECISION -- Yes --> OWNER[Present evidence, options, and recommendation<br/>Wait for owner decision]
    OWNER -- Answer received --> SYNC
    DECISION -- No --> IMPLEMENT

    subgraph ACCEPTANCE["Gate 1: Acceptance and practices"]
        IMPLEMENT[Implement using repository conventions<br/>and relevant language and domain skills] --> VERIFY[Run meaningful acceptance and regression checks<br/>Record effective tested snapshot and evidence]
        VERIFY --> PASS1{All criteria and applicable practices met<br/>for the intended deliverable?}
        PASS1 -- No, repairable --> IMPLEMENT
    end

    PASS1 -- Essential evidence requires publication --> EARLY[Commit/push and prepare matching verification PR<br/>Use required lifecycle state within existing authority<br/>Obtain current-revision evidence, keeping gates open]
    EARLY --> VERIFY
    PASS1 -- Yes --> REVIEW
    subgraph REVIEW_GATE["Gate 2: Review and verified triage"]
        REVIEW[Fresh review of the full issue-related change<br/>and acceptance evidence] --> TRIAGE[Independently verify and adjudicate findings<br/>Record dispositions and follow-up candidates]
        TRIAGE --> ACTION{Necessary fix or worthwhile polish?}
        ACTION -- Yes --> FIX[Apply fixes<br/>Reset clean-review count]
        ACTION -- No --> CLEAN{Two substantive clean passes<br/>on unchanged content?}
        CLEAN -- No --> REVIEW
    end

    FIX --> VERIFY
    CLEAN -- Yes --> IMPROVE
    subgraph QUALITY["Gate 3: Simplification and elevation"]
        IMPROVE[Run distinct simplification and elevation passes<br/>using code:elevate on the issue-related change<br/>Preserve exact behavior and outputs] --> EDITED{Did either pass change content?}
        EDITED -- No --> PASS3{Both passes completed with no worthwhile change<br/>and Gates 1 and 2 still current?}
    end

    EDITED -- Yes, reset review count --> VERIFY
    PASS3 -- No --> SYNC
    IMPROVE -- Correctness concern, reopen Gate 2 --> REVIEW
    PASS3 -- Yes --> PR[Commit remaining task-owned work<br/>Open/update and verify matching PR]
    PR --> MATCH{Pushed content and relevant base context<br/>match the evaluated deliverable?}
    MATCH -- No --> SYNC
    MATCH -- Yes --> READY[Finalize PR for review within existing authority<br/>Preserve an already-ready PR's state]
    READY --> CI{Required checks, including lifecycle-triggered checks,<br/>pass on the current PR/merge revision?}
    CI -- Relevant failure --> IMPLEMENT
    CI -- Pending --> WAIT[Wait for required checks]
    WAIT --> CI
    CI -- Yes --> FINAL{Final reconciliation confirms current<br/>head/base/lifecycle state, all gates, and required CI?}
    FINAL -- No --> SYNC
    FINAL -- Yes --> HANDOFF[Hand back PR, summary, evidence,<br/>manual checks, and follow-up candidates]

    IMPLEMENT & TRIAGE & IMPROVE -- Owner judgment needed --> OWNER
    SYNC & PLAN -- Required source or guidance inaccessible --> BLOCKED
    REVIEW & IMPROVE -- Required guidance blocked or convergence unresolved --> BLOCKED
    VERIFY & EARLY -- Required verification blocked --> BLOCKED
    PR & READY -- PR publication or lifecycle change blocked --> BLOCKED
    CI -- Required checks inaccessible or evidenced external failure --> BLOCKED
    WAIT -- External blocker prevents progress --> BLOCKED[Preserve unfinished status<br/>Report evidence and the specific unblock needed]
    BLOCKED -- Unblock supplied --> SYNC
```

The run record carries immutable revision identities, criterion/evidence mapping, decisions, review count, findings, and follow-up candidates across transitions. On reconciliation, retain evidence only when it still applies to the actual deliverable; resume the recorded next action when no stage was invalidated.

Any task-content edit or material requirements/contract/owner-decision change resets the clean-review count, invalidates Gate 3, and renews affected Gate 1 evidence before review. Relevant base/context changes have the same effect. This includes edits made during cleanup, by commit hooks, or after CI failures. A cleanup inspection never counts as a Gate 2 review. Missing, failed, or blocked evidence never becomes a pass. Diagnose repeated cycles; if they cannot be resolved autonomously, report the specific blocker with gates incomplete.
