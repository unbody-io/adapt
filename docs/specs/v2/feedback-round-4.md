# Audit Feedback — Effort C (Schema Generation & Validation)

## What's Done Well

- **Schema generation per learner type**: TextLearner returns hardcoded string schemas (matches spec exactly), ListLearner calls LLM generation. Clean separation.
- **`z.fromJSONSchema()` used correctly**: Both for structured output (Layer 1) and validation helpers (Layer 2).
- **Schemas persisted to `store.state`**: `observation_schema` and `understanding_schema` saved and restored on init. No extra LLM calls on restore.
- **Schema regen on instruction changes**: `needsSchemaRegen` flag in `update()`, triggers `generateSchemas()` again.
- **Observer widened to `unknown[]`**: Output type correctly generalized from `string[]` to handle structured observation data.
- **Eval coverage**: Schema assertions verify text schemas are string type, list schemas are object type with properties, and schemas survive restore.
- **Store remains dumb**: All schema logic lives in learner layer. Store is schema-unaware.

---

## Issues

### 1. ListLearner understand is fundamentally wrong — must be agentic (Critical)

The current ListLearner understand (`list-learner/understand/index.ts`) is a **single-shot structured LLM call**: dump all current items + observations into the prompt, get back a list of operations, apply them mechanically. This follows the `learner-types-refactor.spec.md` which explicitly says "NOT agentic."

**This contradicts the architecture spec** (`architecture-v2.spec.md`, Section 6):

> | List | LLM uses store methods as tools to add/update/remove items (agentic) |
>
> List: potentially large → agentic (tools)

The architecture spec is the correct design. The whole point of the store layer is to decouple understanding from context window limits. Dumping 200 items into a prompt defeats that purpose.

**What it should be**: An agentic tool-based flow where the LLM gets tools to interact with the understanding collection (read/search/add/update/remove items via store). The LLM processes observations by using these tools iteratively — checking for duplicates, updating existing items, adding new ones. This also naturally enables per-item validation and self-correction.

**What needs to change**:
- `list-learner/understand/index.ts`: Replace single `generate()` call with an agentic loop using store-backed tools
- Tools needed: `listItems`, `searchItems`, `addItem`, `updateItem`, `removeItem` (wrapping `store.understanding.*`)
- Schema validation happens per tool call (validate item data before writing), not in `setUnderstanding()`
- `setUnderstanding()` becomes a pure setter — remove the validation loop from it
- The `callUnderstand` → `setUnderstanding` flow in BaseLearner may need adjustment since the agent writes items directly via tools rather than returning a batch result

**Reference**: `architecture-v2.spec.md` Section 6, lines 190-200.

---

### 2. `setUnderstanding()` has validation logic that doesn't belong there

`setUnderstanding()` should be a pure setter — its name says "set", it should set. Currently both ListLearner and TextLearner have validation code in `setUnderstanding()`:

- **ListLearner** (`list-learner/class.ts:54-60`): Validates items but stores them all anyway (validation is pointless)
- **TextLearner** (`text-learner/class.ts:52-55`): Validates a string against `{ type: 'string' }` (always true, dead code)

**Action**: Remove validation from `setUnderstanding()` in both learner types. For ListLearner, validation moves into the agentic understand tools (issue #1). For TextLearner, remove entirely.

---

### 3. `repairSchema` usage looks wrong

`list-learner/schema.ts:92`:
```typescript
const { output } = await generate({
    model,
    prompt: observationSchemaPrompt(instructions, identity),
    output: Output.object({ schema: jsonSchemaOutputSchema }),
    repairSchema: jsonSchemaOutputSchema,
})
```

`repairSchema` expects a Zod schema to repair malformed JSON output — but this passes the same schema used for `Output.object()`. Is `repairSchema` even a real option on the `generate()` call in your LLM wrapper? If it's an AI SDK feature, verify it works this way. If it's not a real option, it's dead code that silently does nothing.

**Action**: Verify `repairSchema` is a supported option. If not, remove it.

---

## Summary

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | ListLearner understand is single-shot, not agentic | **Critical** | Redesign as tool-based agent per architecture-v2.spec.md |
| 2 | Validation logic in `setUnderstanding()` | **Medium** | Remove from setter. Moves to agentic tools for list, delete for text. |
| 3 | `repairSchema` may be dead code | **Low** | Verify it's a real option, remove if not. |

**Note on spec conflict**: `learner-types-refactor.spec.md` explicitly says "NOT agentic" for ListLearner understand. `architecture-v2.spec.md` says the opposite. The architecture spec is the authoritative design — the refactor spec's shortcut must be corrected. Update `learner-types-refactor.spec.md` to align with the architecture spec.
