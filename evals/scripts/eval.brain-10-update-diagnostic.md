# brain-10-update-diagnostic

**Purpose:** No-assertions diagnostic that produces a markdown report of `brain.update()` behavior across a large dataset.

**Evaluates:**
- Domain shift via prompt update
- Mechanical cascade via model + threshold update
- Query quality before and after each update

**Parameters:**
- Model: configurable via `MODEL` env var
- Dataset: therapist-profile (120+ events)
- Output: markdown report
