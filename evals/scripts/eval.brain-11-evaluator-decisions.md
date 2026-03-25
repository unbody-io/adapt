# brain-11-evaluator-decisions

**Purpose:** Tests the evaluator's decision quality in isolation using `dryRun` mode.

**Evaluates:**
- Related pivot: expects UPDATE or MERGE
- Unrelated pivot: expects DELETE + CREATE
- High dismissal rate: expects SPLIT, UPDATE, or MERGE
- Low confidence, stagnation, mixed signals, borderline scenarios

**Parameters:**
- Model: configurable via `MODEL` env var
- Output: markdown report
