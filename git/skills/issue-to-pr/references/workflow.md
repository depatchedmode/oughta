# Issue-to-PR workflow

The agent follows this graph using the pass conditions in [SKILL.md](../SKILL.md). It is a process specification, not an executable state-machine runtime.

```mermaid
flowchart TD
    ISSUE[Issue and acceptance criteria] --> PLAN[Inspect spec, repository, and relevant skills<br/>Investigate gaps and plan implementation and verification]
    PLAN --> DECISION{Unresolved owner-level decision?}
    DECISION -- Yes --> OWNER[Present evidence, options, and recommendation<br/>Wait for owner decision]
    OWNER --> PLAN
    DECISION -- No --> IMPLEMENT

    subgraph ACCEPTANCE["Gate 1: Acceptance and practices"]
        IMPLEMENT[Implement using repository conventions<br/>and relevant language and domain skills] --> VERIFY[Run meaningful acceptance and regression checks<br/>Record evidence for the evaluated revision]
        VERIFY --> PASS1{All criteria and applicable practices met?}
        PASS1 -- No, repairable --> IMPLEMENT
    end

    PASS1 -- Yes --> REVIEW
    subgraph REVIEW_GATE["Gate 2: Review and verified triage"]
        REVIEW[Fresh review of issue-related change] --> TRIAGE[Independently verify findings<br/>Classify necessity, scope, and value]
        TRIAGE --> ACTION{Necessary fix or worthwhile cheap polish?}
        TRIAGE -. Valid deferral .-> CATALOG[Catalog follow-up candidates<br/>Do not file them]
        ACTION -- Yes --> FIX[Apply fixes<br/>Reset clean-review count]
        ACTION -- No --> CLEAN{Two consecutive substantive clean passes<br/>on unchanged content?}
        CLEAN -- No --> REVIEW
    end

    FIX --> VERIFY
    CLEAN -- Yes --> IMPROVE
    subgraph QUALITY["Gate 3: Simplification and elevation"]
        IMPROVE[Run distinct simplification and elevation passes<br/>using code:elevate on the issue-related change<br/>Preserve exact behavior and outputs] --> VALUE{Worthwhile improvement remains?}
        VALUE -- Yes --> REFACTOR[Apply behavior-preserving improvement<br/>Reset clean-review count]
        VALUE -- No --> PASS3[All three gates passed for final content]
    end

    REFACTOR --> VERIFY
    IMPROVE -. Correctness defect .-> TRIAGE
    PASS3 --> PR[Open or update and verify the PR]
    PR --> CI{Required checks pass<br/>on the PR revision?}
    CI -- Relevant failure --> IMPLEMENT
    CI -- Pending --> WAIT[Wait for required checks]
    WAIT --> CI
    CI -- Yes --> HANDOFF[PR, summary, acceptance evidence,<br/>manual checks, and follow-up candidates]
    CATALOG -. Included at handoff .-> HANDOFF

    IMPLEMENT -. Owner judgment needed .-> OWNER
    TRIAGE -. Owner judgment needed .-> OWNER
    IMPROVE -. Owner judgment needed .-> OWNER
    PLAN -. Required source or guidance inaccessible .-> BLOCKED
    REVIEW -. Required guidance blocked or convergence unresolved .-> BLOCKED
    IMPROVE -. Required guidance blocked or convergence unresolved .-> BLOCKED
    VERIFY -. Required verification blocked .-> BLOCKED[Preserve unfinished status<br/>Report evidence and the specific unblock needed]
    PR -. PR creation blocked .-> BLOCKED
    CI -. Required checks inaccessible .-> BLOCKED
    CI -. Evidenced external failure .-> BLOCKED
    WAIT -. External blocker prevents progress .-> BLOCKED
```

Any task-content edit or material change to requirements, adopted contracts, or owner decisions invalidates affected evidence and resets the clean-review count. This includes later PR/CI fixes. An owner decision returns to the earliest affected gate. A failed or blocked node never silently becomes a pass. Repeated cycles without progress require diagnosis and, when unresolved, an explicit blocker rather than a false completion.
