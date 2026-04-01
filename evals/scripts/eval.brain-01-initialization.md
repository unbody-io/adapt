# brain-01-initialization

**Purpose:** Tests brain initialization with a prompt, verifying that the LLM decomposes the prompt into appropriate neurons.

**Evaluates:**
- Brain initializes from a software engineering prompt
- LLM decomposes the prompt into multiple neurons
- Neurons are created with correct names, descriptions, and instructions
- Initialization events are emitted with correct payloads

**Parameters:**
- Model: configurable via `MODEL` env var
- Evolution: enabled, signal threshold 5, autoEvaluate on
