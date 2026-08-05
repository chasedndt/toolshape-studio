# Toolshape Studio — architecture diagrams

**Date:** 2026-08-05
**Status:** ACTIVE

Canonical diagram set. Every diagram is Mermaid so it renders on GitHub and stays diffable. Diagrams marked **(planned)** describe milestones not yet implemented; everything else reflects code in this repository.

---

## 1. System topology — who talks to what

```mermaid
flowchart TB
    subgraph supervision["Supervision — optional"]
        CO["ChaseOS<br/>policy · budgets · schedules · knowledge · workflow archive"]
    end

    subgraph harnesses["Agent harnesses"]
        H1["Claude Code / Codex<br/>co-located"]
        H2["Hermes / OpenClaw<br/>server process on a port"]
        H3["ChaseOS agent<br/>supervised 24/7"]
    end

    subgraph adapters["Adapters — transport only, no domain logic"]
        MCP["MCP server<br/>stdio + streamable HTTP"]
        CLI["CLI<br/>JSON stdin/stdout"]
        SDK["TypeScript SDK<br/>in-process"]
        UI["React editor UI"]
    end

    KER["Semantic kernel<br/>capability allowlist · grants · revisions<br/>idempotency · jobs · verification · provenance"]
    ENG["Domain engine<br/>scene graph · timeline · rational time · validation"]
    ST[("SQLite + content-addressed store<br/>revisions · operations · jobs · artifacts")]

    CO -.constrains.-> H1
    CO -.constrains.-> H2
    CO -.constrains.-> H3

    H1 --> MCP
    H1 --> CLI
    H2 --> MCP
    H3 --> MCP
    H3 --> SDK

    MCP --> KER
    CLI --> SDK
    SDK --> KER
    UI --> KER

    KER --> ENG
    KER --> ST

    classDef planned stroke-dasharray: 5 5
    class MCP planned
```

**Read this diagram for one thing:** every arrow into the kernel carries the same operation envelope. The human UI has no privileged path, and no adapter can reach the store without passing the kernel's checks.

---

## 2. The agent control loop

```mermaid
sequenceDiagram
    participant H as Agent harness
    participant M as MCP adapter
    participant K as Semantic kernel
    participant S as SQLite store

    H->>M: tools/list
    M-->>H: 8 capabilities + JSON Schemas

    H->>M: studio.project.inspect
    M->>K: envelope (read_only)
    K->>S: read snapshot
    S-->>K: project @ revision 7
    K-->>M: project + revision
    M-->>H: state

    Note over H: plan the edit

    H->>M: apply_operations (dry_run: true, expected_revision: 7)
    M->>K: envelope
    K-->>M: semantic diff, no mutation
    M-->>H: preview

    Note over H: diff looks right

    H->>M: apply_operations (dry_run: false, expected_revision: 7)
    M->>K: envelope + idempotency key
    K->>S: atomic commit
    S-->>K: revision 8
    K-->>M: result + undo token
    M-->>H: completed @ revision 8

    Note over H,S: A human edit landing here would make revision 7 stale.<br/>The kernel rejects; the agent must re-inspect and re-plan.<br/>It may never resolve a conflict by overwriting.
```

---

## 3. Operation envelope lifecycle

```mermaid
flowchart TD
    A["Request<br/>human gesture or agent call"] --> B["Adapter builds envelope"]
    B --> C{"Schema valid?"}
    C -->|no| R1["rejected<br/>structured error"]
    C -->|yes| D{"Capability in allowlist?"}
    D -->|no| R1
    D -->|yes| E{"Grant present?"}
    E -->|no| R1
    E -->|yes| F{"Idempotency key seen?"}
    F -->|"yes, same digest"| R2["return original result<br/>no re-execution"]
    F -->|"yes, different digest"| R3["conflict"]
    F -->|no| G{"expected_revision current?"}
    G -->|no| R4["stale_revision<br/>no mutation"]
    G -->|yes| H{"dry_run?"}
    H -->|yes| R5["previewed<br/>semantic diff only"]
    H -->|no| I{"Long-running?"}
    I -->|yes| J["create durable job"] --> R6["accepted_job"]
    I -->|no| K["apply atomically"]
    K --> L["record revision + operation + provenance"]
    L --> M["verify deterministically"]
    M --> R7["completed<br/>+ undo token"]

    style R1 fill:#4a1e1e,color:#fff
    style R3 fill:#4a1e1e,color:#fff
    style R4 fill:#4a3a1e,color:#fff
    style R7 fill:#1e4a2a,color:#fff
```

---

## 4. Trust boundaries

```mermaid
flowchart LR
    subgraph untrusted["UNTRUSTED — data, never authority"]
        U1["Model output"]
        U2["Imported media bytes"]
        U3["Tool descriptions<br/>from other MCP servers"]
        U4["Web pages · documents"]
        U5["Declared filename + MIME"]
    end

    subgraph boundary["ENFORCEMENT — deterministic code"]
        B1["Schema validation"]
        B2["Capability allowlist"]
        B3["Grant check"]
        B4["Revision check"]
        B5["Byte-signature sniff"]
        B6["Quarantine probe + resource budgets"]
    end

    subgraph trusted["TRUSTED"]
        T1["Semantic kernel"]
        T2["Content-addressed store"]
        T3["Media worker<br/>argv array, shell:false"]
    end

    U1 --> B1
    U3 --> B1
    U4 --> B1
    B1 --> B2 --> B3 --> B4 --> T1

    U2 --> B5 --> B6 --> T2
    U5 -.->|"a hint, never authority"| B5

    T1 --> T3
    T3 --> T2
```

**The axiom:** data can influence a proposal but cannot grant authority. A model's text, a document, and another server's tool description all enter through the same validation funnel. There is no instruction anywhere in this system that a model is trusted to obey for safety purposes.

---

## 5. Media ingestion — the quarantine boundary

Implemented in Milestone 6 (`packages/studio-media/src/ingestion.ts`).

```mermaid
flowchart TD
    A["Caller supplies path + declared type"] --> B{"stat: is file, size within budget?"}
    B -->|no| X["MediaIngestionRejectedError<br/>stage: source-validation"]
    B -->|yes| C["read bytes once"]
    C --> D{"safe basename?<br/>no path or control chars"}
    D -->|no| X
    D -->|yes| E{"byte signature matches<br/>declared type?"}
    E -->|no| X
    E -->|yes| F["write to unique ephemeral<br/>quarantine snapshot"]
    F --> G{"resolved path inside<br/>approved work root?"}
    G -->|no| X
    G -->|yes| H["FFprobe the SNAPSHOT<br/>bounded output, timeout"]
    H -->|fails| X2["stage: probe"]
    H --> I{"duration · dimensions · pixels<br/>frame rate · channels · sample rate<br/>within budget?"}
    I -->|no| X3["stage: probe-policy"]
    I -->|yes| J["import into trusted<br/>content-addressed store"]
    J --> K["generate proxy · thumbnail · waveform"]
    K --> L["register asset"]

    X --> Z["delete quarantine"]
    X2 --> Z
    X3 --> Z
    L --> Z

    style X fill:#4a1e1e,color:#fff
    style X2 fill:#4a1e1e,color:#fff
    style X3 fill:#4a1e1e,color:#fff
    style J fill:#1e4a2a,color:#fff
```

**Why probe the snapshot and not the caller's path:** the caller's path is mutable. Probing it and then importing from it is a time-of-check/time-of-use race — an attacker swaps the file between the two reads. The snapshot is immutable for the lifetime of the check. Rejected bytes never reach the trusted store, and quarantine is deleted on **every** outcome including failure.

---

## 6. Durable job lifecycle

Implemented in Milestone 4 (`packages/studio-render/src/durable-jobs.ts`).

```mermaid
stateDiagram-v2
    [*] --> created
    created --> queued
    queued --> running: worker claims atomically
    running --> completed: output probed + artifact registered
    running --> cancel_requested: studio.job.cancel
    cancel_requested --> cancelled: worker observes flag, aborts
    running --> retry_scheduled: transient failure
    retry_scheduled --> queued: backoff elapsed
    running --> failed: bounded retries exhausted
    queued --> cancelled
    running --> queued: process died, recovered on restart
    completed --> [*]
    failed --> [*]
    cancelled --> [*]

    note right of running
        Progress persisted to SQLite as
        fractional value + stage label.
        Agent polls studio.job.get.
    end note

    note right of cancel_requested
        Cancellation is cooperative.
        Request and actual state are
        tracked separately so an agent
        can tell "asked" from "stopped".
    end note
```

---

## 7. Capture → edit → design → export pipeline (planned)

```mermaid
flowchart LR
    subgraph capture["CAPTURE — Milestone 9"]
        C1["source select"] --> C2["record"]
        C2 --> C3["immutable media"]
        C2 --> C4["cursor track"]
        C2 --> C5["event track<br/>clicks · keys · scroll"]
        C2 --> C6["window track"]
    end

    subgraph derive["DERIVE — deterministic"]
        D1["auto zoom plan<br/>from event track"]
        D2["backdrop + overlay"]
        D3["redaction"]
    end

    subgraph edit["EDIT — Milestone 6 ✓"]
        E1["timeline scene"]
        E2["split · trim · speed"]
        E3["transcript"]
        E4["captions"]
        E5["audio mix"]
    end

    subgraph design["DESIGN"]
        G1["layers · text · shapes"]
        G2["brand kit"]
        G3["platform variants"]
    end

    subgraph out["RENDER — Milestone 4 ✓"]
        R1["durable job"] --> R2["probe-verified artifact"]
    end

    C5 --> D1
    C4 --> D1
    C3 --> E1
    D1 --> E1
    D2 --> E1
    D3 --> E1
    E1 --> E2 --> E3 --> E4 --> E5
    E5 --> G1
    G1 --> G2 --> G3
    G3 --> R1

    style capture stroke-dasharray: 5 5
    style derive stroke-dasharray: 5 5
    style design stroke-dasharray: 5 5
```

**The key structural claim:** the event track flows into the zoom plan as *data*. An agent asking to "emphasise every click in the settings panel" is resolved deterministically against recorded events. Against a flat video the same request would need frame-by-frame vision inference and would be unverifiable.

---

## 8. Super-app information architecture

```mermaid
flowchart TB
    HOME["HOME<br/>projects · recent · agent activity · jobs"]

    HOME --> CAP["CAPTURE<br/>sources · recording · zoom plan · overlay"]
    HOME --> CRE["CREATE<br/>canvas · layers · text · brand"]
    HOME --> EDT["EDIT<br/>timeline · transcript · audio · captions"]
    HOME --> REV["REVIEW<br/>diffs · quality · approvals · history"]
    HOME --> AUT["AUTOMATE<br/>plans · jobs · harness sessions · recipes"]

    CAP -->|"to_scene"| EDT
    EDT -->|"variants"| CRE
    CRE -->|"variants"| REV
    EDT --> REV
    REV -->|"render"| AUT

    PROJ[("One project<br/>one revision history<br/>one operation log")]

    CAP -.-> PROJ
    CRE -.-> PROJ
    EDT -.-> PROJ
    REV -.-> PROJ
    AUT -.-> PROJ
```

Workspaces rearrange **the same objects**. Switching workspace is ephemeral view state — it never advances the project revision (ADR 0009, ADR 0011).

---

## 9. View state vs. canonical state

The boundary that keeps human and agent editing equivalent.

```mermaid
flowchart TB
    subgraph ephemeral["EPHEMERAL VIEW STATE — never persisted, never a revision"]
        V1["workspace · panel selection · visibility"]
        V2["clip selection · playhead · zoom · scroll"]
        V3["active drag · trim preview"]
        V4["transport playing state · ripple preference"]
        V5["resolved preview blob URLs"]
    end

    subgraph canonical["CANONICAL STATE — revisioned, persisted, agent-visible"]
        K1["scene graph · timeline graph"]
        K2["clip start · duration · sourceIn"]
        K3["assets + probe evidence"]
        K4["operation log · provenance"]
    end

    GESTURE["pointer drag on a trim handle"] --> V3
    V3 -->|"pointer UP — exactly one operation"| OP["timeline.clip.trim<br/>typed · validated · revisioned"]
    OP --> canonical

    AGENT["agent calls apply_operations"] --> OP

    style ephemeral fill:#2a2a35,color:#fff
    style canonical fill:#1e3a4a,color:#fff
```

**Why this matters for agent parity:** a drag produces *one* operation at pointer-up, not one per mouse-move. That operation is the identical, identically-validated operation an agent submits. If UI-only state leaked into revisions, the human path and the agent path would diverge — and UI-side clamping could enforce limits an agent-driven client could bypass. Source-range validation lives in the kernel precisely because UI clamping is usability, not a security boundary.

---

## 10. Milestone status

```mermaid
timeline
    title Toolshape Studio delivery
    section Shipped
        M1 Vertical slice : unified project : typed operations : revisions
        M2 Durable render jobs : SQLite jobs : progress : cancellation : recovery
        M3 Media ingest : byte sniffing : content addressing : real probing
        M4 Editor shell : workspaces : panels : view-state boundary
        M5 Preview derivatives : thumbnails : waveforms : content-addressed
        M6 Direct timeline : selection : playhead : trim : media quarantine
    section In progress
        M7 MCP transport : stdio : HTTP : session auth : discovery
        M8 Super-app shell : home : capture workspace : agent activity
    section Planned
        M9 Capture pillar : event tracks : auto zoom : redaction
        M10 Variants : responsive resize : bulk data : localisation
```
