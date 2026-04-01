# brain-14-full-capabilities

**Purpose:** Tests the complete Brain lifecycle with both MemoryBrainStore and SQLiteBrainStore backends.

**Evaluates:**
- Fresh init with text + list neurons
- Inject, ask, adjustNeuron, removeNeuron
- Persist -> restore flow
- Full suite runs twice (once per store backend)

**Parameters:**
- Model: configurable via eval helper
- Store backends: MemoryBrainStore, SQLiteBrainStore
