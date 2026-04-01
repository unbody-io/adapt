# evaluator-debug

**Purpose:** Minimal diagnostic to observe raw evaluator LLM output after signal threshold is hit.

**Evaluates:**
- Brain init with 1 external + 1 internal neuron
- Injection of dev items (accepted) and non-dev items (dismissed)
- Evaluator raw output after signal threshold

**Parameters:**
- Model: configurable via `MODEL` env var
- Dataset: digital-twin-daily.json
