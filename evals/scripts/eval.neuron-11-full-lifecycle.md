# neuron-11-full-lifecycle

**Purpose:** Comprehensive lifecycle with raw state dumps against both MemoryNeuronStore and SQLiteNeuronStore. No assertions.

**Evaluates:**
- Init, update, learn, query at various lifecycle points
- Config-only vs LLM-regen updates
- Restore from existing store
- Store parity: MemoryNeuronStore vs SQLiteNeuronStore

**Parameters:**
- Model: configurable via `MODEL` env var
- Neuron type: TextNeuron (standalone)
