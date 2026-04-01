# brain-08-brain-update

**Purpose:** Tests `brain.update()` with the 3-category field system: brain-only, mechanical cascade, and signal-driven changes.

**Evaluates:**
- Brain-only fields update without cascading to neurons
- Mechanical cascade propagates to all neurons
- Signal-driven changes trigger the evaluator pipeline

**Parameters:**
- Model: configurable via `MODEL` env var
- Evolution: enabled, signal threshold 5, autoEvaluate on
