# brain-16-explicit-neurons

**Purpose:** Tests explicit neuron configuration: `autoSetup: false` with/without explicit neurons, and autopilot with explicit neurons.

**Evaluates:**
- autoSetup false + explicit: no LLM call, only explicit neurons
- autoSetup false + none: zero neurons
- autoSetup true + explicit: both coexist
- Explicit neurons survive persist -> restore

**Parameters:**
- Model: configurable via `MODEL` env var
- Store: MemoryBrainStore + MemoryNeuronStore
