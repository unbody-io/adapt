# brain-13-multi-type-learners

**Purpose:** Tests Brain lifecycle with a prompt designed to generate both text and list learners.

**Evaluates:**
- LLM decomposition produces both TextLearner and ListLearner types
- Full pipeline: decomposition -> init -> inject -> ask -> evolution

**Parameters:**
- Model: configurable via `MODEL` env var
- Domain: startup product development
