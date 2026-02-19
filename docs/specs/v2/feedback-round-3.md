# Audit Feedback — Round 3

## Naming Convention: `persistX()` / `restoreX()`

Store-interacting methods have inconsistent naming. Standardize to `persistX()` / `restoreX()`:

| Current | Rename to |
|---|---|
| `saveStateToStore()` | `persistState()` |
| `restoreStateFromStore()` | `restoreState()` |
| `restoreUnderstandingFromStore()` | `restoreUnderstanding()` |

17 occurrences across `base/class.ts`, `text-learner/class.ts`, `list-learner/class.ts`. Update section comments to match.
