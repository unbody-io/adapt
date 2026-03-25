# learner-08-signal-stagnation

**Purpose:** Tests that a learner emits a stagnation signal when observations accumulate without synthesis.

**Evaluates:**
- High minImportance preventing synthesis
- Stagnation signal emission after threshold

**Parameters:**
- Model: configurable via `MODEL` env var
- Signal threshold: maxObservationsWithoutSynthesis 5
