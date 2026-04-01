# brain-internal-neurons

**Purpose:** Diagnostic that exercises the full internal neurons pipeline with raw log output.

**Evaluates:**
- Init of 4 internal neurons, isolated from external
- Injection of relevant data (feeds global understanding) and irrelevant data (feeds gap neuron)
- Query storm: answerable + unanswerable queries
- Direct consultation of internal neurons
- Evolution and re-injection of dismissed batches

**Parameters:**
- Model: configurable via `MODEL` env var
- Store: MemoryBrainStore + MemoryNeuronStore
