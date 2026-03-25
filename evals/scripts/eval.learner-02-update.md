# learner-02-update

**Purpose:** Tests `learner.update()` with config changes and immutability constraints.

**Evaluates:**
- Updating name, description, instructions
- Immutability of id and type fields
- Prompt regeneration after instruction changes

**Parameters:**
- Model: configurable via `MODEL` env var
- Learner type: text, continuous governance
