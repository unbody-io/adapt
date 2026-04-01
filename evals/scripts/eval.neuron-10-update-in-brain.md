# neuron-10-update-in-brain

**Purpose:** Tests `neuron.update()` called directly on a neuron inside a Brain — verifies brain-level coherence.

**Evaluates:**
- Neuron still accessible via brain after update
- Events forwarded through brain
- inject() and ask() work correctly with updated neuron

**Parameters:**
- Model: configurable via `MODEL` env var
- Evolution: enabled
