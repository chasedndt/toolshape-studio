# Tool use and harness engineering

## ReAct

Interleaving reasoning and action established a useful agent loop, but production software should not expose internal chain-of-thought as an API requirement. Preserve plans, tool calls, results, and verification evidence.

## Toolformer

Tool use can be learned, but application developers still control the quality, stability, and safety of available tools.

## Gorilla

API selection and hallucination depend on documentation and retrieval. This supports a dedicated Agent Experience discipline: precise names, schemas, examples, errors, and capability discovery.

## Anthropic practical guidance

Use the simplest pattern that works, prefer composable workflows, and invest in the agent-computer interface. Add orchestrator-worker or evaluator-optimizer patterns when the task demonstrates that need.

## Toolshape harness stance

- one coordinating harness is the default for one product workflow;
- deterministic application services perform domain edits;
- specialist agents are introduced for genuinely separate judgement/research tasks;
- ChaseOS can route among harnesses without embedding product business logic;
- capability quality is measured, not assumed.
