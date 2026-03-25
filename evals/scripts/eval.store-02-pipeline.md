# Store ↔ Pipeline Integration
Exercises full learn() pipeline against both store adapters (Memory + SQLite). Dumps raw state after each phase — no assertions.
## What to look for
- Observations land with correct metadata
- After understand, observations marked 'processed'
- Understanding written to store
- Schemas persisted in state after init
- Restore from existing store recovers state
