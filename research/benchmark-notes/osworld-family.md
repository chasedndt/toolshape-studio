# OSWorld family and GUI/tool evaluation

## OSWorld

OSWorld introduced a real-computer benchmark with 369 tasks across operating systems, web/desktop applications, file I/O, and multi-application workflows. Its reported human success was 72.36% while the strongest evaluated model reached 12.24%, with GUI grounding and operational knowledge identified as major weaknesses.

### Toolshape lesson

Pixels should not be the normal control plane for software we own. Keep computer use for unsupported/legacy cases and evaluate it explicitly.

## OSWorld-MCP

OSWorld-MCP adds curated MCP tools to computer-use tasks. Its reported results show tools can improve success, but even strong models underuse available tools.

### Toolshape lesson

Merely publishing MCP tools is insufficient. Tool descriptions, discovery, names, examples, state projections, and selection evals are part of Agent Experience.

Measure:

- capability offered;
- capability discovered;
- capability selected;
- unnecessary GUI use;
- correct parameterization;
- final state.

## WindowsWorld

WindowsWorld focuses on multi-application professional workflows. Its reported agents remained below 21% success and struggled with conditional reasoning across several applications.

### Toolshape/ChaseOS lesson

ChaseOS recipes should preserve intermediate state, conditions, verification, and recovery—not merely chain prompts. Cross-app workflow tests need controlled Windows fixtures and sub-goal evidence.

## Internal benchmark tracks

### Semantic-first

Every needed action exists as a Toolshape capability. Goal: near-zero GUI fallback and strong pass^k.

### Mixed

Some actions exist semantically and others require accessibility/UI fallback. Goal: correct path selection and state verification.

### Legacy

No application API is available. Goal: measure grounding/operational knowledge honestly, not hide failure behind a final answer.

## Product metric

Track “semantic path advantage”:

```text
success with Toolshape semantic capabilities
minus
success using accessibility/computer use only
```

Also compare cost, latency, calls, recovery, and collateral damage.
