# brain-17-ask-prefilter

**Purpose:** Tests that `brain.ask()` pre-filters learners so only relevant ones contribute to the answer.

**Evaluates:**
- Domain-specific question routes to the correct learner
- Unrelated learners excluded from response
- Cross-domain queries include multiple learners

**Parameters:**
- Model: configurable via `MODEL` env var
- 4 explicit learners across different domains
