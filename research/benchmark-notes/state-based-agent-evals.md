# State-based agent evaluation

## AppWorld lesson

AppWorld evaluates agents against final application state with unit tests that allow different valid trajectories and detect unexpected changes. This is the correct philosophy for Toolshape.

Do not grade only:

- final text response;
- exact chain of thought;
- one prescribed tool sequence;
- the agent saying “done.”

Grade:

- required postconditions;
- forbidden/collateral changes;
- policy events;
- operation/job/artifact state;
- verification evidence;
- recovery.

## tau-bench lesson

tau-bench combines tools, policies, users, final database state, and repeated reliability through `pass^k`. Reported agents were inconsistent even when individual pass rates looked moderate.

Toolshape should report:

```text
pass^1
pass^3
pass^5
pass^8
```

for golden workflows and fault conditions.

## Why trajectory data still matters

Final state can pass while a process was unsafe or wasteful. Preserve redacted trajectory evidence to evaluate:

- forbidden attempts;
- unnecessary data reads;
- approval timing;
- cost;
- tool selection;
- retries;
- recovery quality.

Final state is the truth for outcome; trajectory is evidence for process and safety.
