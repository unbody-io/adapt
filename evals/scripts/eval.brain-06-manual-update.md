# brain-06-manual-update

**Purpose:** Tests `brain.updateLearner()` for modifying a learner's configuration via natural language guidance.

**Evaluates:**
- Updating a learner's scope changes name/description/instructions
- Learner identity (ID) is preserved
- Update events are emitted correctly

**Parameters:**
- Model: configurable via `MODEL` env var
