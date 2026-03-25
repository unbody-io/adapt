# brain-internal-learners

**Purpose:** Diagnostic that exercises the full internal learners pipeline with raw log output.

**Evaluates:**
- Init of 4 internal learners, isolated from external
- Injection of relevant data (feeds global understanding) and irrelevant data (feeds gap learner)
- Query storm: answerable + unanswerable queries
- Direct consultation of internal learners
- Evolution and re-injection of dismissed batches

**Parameters:**
- Model: configurable via `MODEL` env var
- Store: MemoryBrainStore + MemoryStore
