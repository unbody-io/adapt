# brain-13-multi-type-neurons

**Purpose:** Tests Brain lifecycle with a prompt designed to generate both text and list neurons.

**Evaluates:**
- LLM decomposition produces both TextNeuron and ListNeuron types
- Full pipeline: decomposition -> init -> inject -> ask -> evolution

**Parameters:**
- Model: configurable via `MODEL` env var
- Domain: startup product development
