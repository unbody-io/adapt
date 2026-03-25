# learner-05-signal-dismissal

**Purpose:** Tests that a learner emits a signal when observation dismissal rate exceeds threshold.

**Evaluates:**
- Narrow learner dismissing off-topic observations
- Signal emission when dismissal rate exceeds threshold

**Parameters:**
- Model: configurable via `MODEL` env var
- Signal threshold: maxDismissalRate 0.7
