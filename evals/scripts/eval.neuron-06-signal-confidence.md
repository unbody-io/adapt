# neuron-06-signal-confidence

**Purpose:** Tests that a neuron emits a signal when query confidence is consistently low.

**Evaluates:**
- Low confidence detection across multiple queries
- Signal emission below minConfidence threshold

**Parameters:**
- Model: configurable via `MODEL` env var
- Signal threshold: minConfidence 0.4
