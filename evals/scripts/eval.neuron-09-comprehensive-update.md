# neuron-09-comprehensive-update

**Purpose:** E2E behavioral eval verifying `neuron.update()` changes runtime behavior through full init-learn-query-update-learn-query pipeline.

**Evaluates:**
- After instructions change, learn() observes differently
- After instructions change, query() responds differently
- After threshold change, synthesis gating changes
- Static guards: immutability, no-op, metadata updates

**Parameters:**
- Model: configurable via `MODEL` env var
- Neuron type: text, continuous governance
