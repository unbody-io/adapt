# brain-06-manual-update

**Purpose:** Tests `brain.updateNeuron()` for modifying a neuron's configuration via natural language guidance.

**Evaluates:**
- Updating a neuron's scope changes name/description/instructions
- Neuron identity (ID) is preserved
- Update events are emitted correctly

**Parameters:**
- Model: configurable via `MODEL` env var
