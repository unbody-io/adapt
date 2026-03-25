# learner-11-full-lifecycle

**Purpose:** Comprehensive lifecycle with raw state dumps against both MemoryStore and SQLiteStore. No assertions.

**Evaluates:**
- Init, update, learn, query at various lifecycle points
- Config-only vs LLM-regen updates
- Restore from existing store
- Store parity: MemoryStore vs SQLiteStore

**Parameters:**
- Model: configurable via `MODEL` env var
- Learner type: TextLearner (standalone)
