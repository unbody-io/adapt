# brain-02-signal-buffering

**Purpose:** Tests that the Brain/Evaluator correctly buffers signals and triggers evaluation only when the threshold is reached.

**Evaluates:**
- Sending signals below threshold does not trigger evaluation
- Reaching the threshold triggers evaluation
- Signal buffering respects the configured `evaluatorSignalThreshold`

**Parameters:**
- Model: configurable via `MODEL` env var
- Evolution: enabled, signal threshold 5, autoEvaluate on
