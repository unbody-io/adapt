# brain-03-manual-create

**Purpose:** Tests `brain.createLearner()` for manually creating a new learner via natural language guidance.

**Evaluates:**
- Creating a learner from guidance adds it to the brain
- Learner count increases after creation
- New learner has appropriate name, description, and instructions

**Parameters:**
- Model: configurable via `MODEL` env var
