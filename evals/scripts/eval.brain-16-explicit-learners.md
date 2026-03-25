# brain-16-explicit-learners

**Purpose:** Tests explicit learner configuration: `autoSetup: false` with/without explicit learners, and autopilot with explicit learners.

**Evaluates:**
- autoSetup false + explicit: no LLM call, only explicit learners
- autoSetup false + none: zero learners
- autoSetup true + explicit: both coexist
- Explicit learners survive persist -> restore

**Parameters:**
- Model: configurable via `MODEL` env var
- Store: MemoryBrainStore + MemoryStore
