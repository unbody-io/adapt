# brain-09-comprehensive-brain-update

**Purpose:** E2E behavioral eval verifying that `brain.update()` changes actual runtime behavior, not just stored config values.

**Evaluates:**
- After prompt change, `brain.ask()` reflects new domain
- Model cascade propagates to all neurons
- Learning threshold cascade changes synthesis gating
- Full pipeline: init -> inject -> ask -> update -> inject -> ask

**Parameters:**
- Model: configurable via `MODEL` env var
- 7 phases: baseline, signal-driven, mechanical cascade, learning cascade, brain-only, static guards, event audit
