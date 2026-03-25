# learner-10-update-in-brain

**Purpose:** Tests `learner.update()` called directly on a learner inside a Brain — verifies brain-level coherence.

**Evaluates:**
- Learner still accessible via brain after update
- Events forwarded through brain
- inject() and ask() work correctly with updated learner

**Parameters:**
- Model: configurable via `MODEL` env var
- Evolution: enabled
