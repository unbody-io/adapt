# neuron-14-custom-schema

**Purpose:** Verifies custom schemas provided in config are preserved and enforced during understand phase.

**Evaluates:**
- Schema preservation during init (no LLM overwrite)
- Observation and understanding schema enforcement
- Understand phase output conformance to custom schema

**Parameters:**
- Model: configurable via `MODEL` env var
- Neuron type: ListNeuron (standalone)
