# brain-04-manual-merge

**Purpose:** Tests `brain.mergeLearners()` for combining multiple learners with overlapping domains into one.

**Evaluates:**
- Two learners with overlapping domains merge into one
- Source learners are deleted after merge
- Merged learner retains combined knowledge

**Parameters:**
- Model: configurable via `MODEL` env var
