# neuron-02-update

**Purpose:** Tests `neuron.update()` with config changes and immutability constraints.

**Evaluates:**
- Updating name, description, instructions
- Immutability of id and type fields
- Prompt regeneration after instruction changes

**Parameters:**
- Model: configurable via `MODEL` env var
- Neuron type: text, continuous governance
