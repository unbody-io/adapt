# brain-17-ask-prefilter

**Purpose:** Tests that `brain.ask()` pre-filters neurons so only relevant ones contribute to the answer.

**Evaluates:**
- Domain-specific question routes to the correct neuron
- Unrelated neurons excluded from response
- Cross-domain queries include multiple neurons

**Parameters:**
- Model: configurable via `MODEL` env var
- 4 explicit neurons across different domains
