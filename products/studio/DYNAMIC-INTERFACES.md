# Dynamic task-specific interfaces

## Purpose

Chat alone is inefficient for comparing, constraining, and approving structured creative work. Studio lets a harness request temporary, task-specific review surfaces while the application retains control over rendering and execution.

## Trust boundary

A harness sends a declarative `TaskView` object. Studio validates it against an allowlisted component schema.

Allowed component families:

```text
heading/explanation
read-only evidence
form fields with bounded schema
object reference picker
variant comparison grid
timeline/span review
semantic diff list
quality finding list
cost/provider card
approval card
progress/job card
pairwise preference control
```

Not allowed:

- arbitrary JavaScript;
- arbitrary HTML with application privileges;
- unrestricted network requests;
- hidden form fields/actions;
- custom code execution;
- direct database access;
- secret value display.

## Example: transcript cut review

The harness requests:

```text
video preview
transcript with proposed removed spans
waveform context
estimated duration before/after
low-confidence alignment warnings
accept/reject per span
apply batch button bound to exact operation digest
```

The returned interactions create typed decisions; they do not directly mutate the timeline.

## Example: design direction review

```text
four rendered variants
brief-fidelity summary
style evidence
hard-rule status
object/layer count
font/licence warnings
select, reject, merge attributes, or open in editor
```

## Example: paid generation

```text
provider comparison
prompt/inputs after secret/privacy redaction
output rights/retention
cost range and maximum
number of candidates
exact approval
```

## Lifecycle

```text
harness proposes TaskView
→ Studio validates trust/schema/data access
→ Studio renders native components
→ user interacts
→ Studio emits DecisionEvent objects
→ harness re-plans or submits an operation
→ normal policy/preview/execute/verify path
```

## Persistence

Task views are ephemeral by default. Persist only:

- template/schema version;
- decisions;
- referenced operation/approval;
- minimal redacted evidence;
- optional user-saved workflow form.

## Accessibility

Every component must be keyboard and screen-reader accessible, support zoom/contrast/reduced motion, and maintain deterministic reading/focus order.

## Product rule

Dynamic interfaces accelerate supervision. They never replace the stable canvas, timeline, inspector, history, or settings required for professional mastery.
