/**
 * Default evolution tracking rules for synthesize tool
 *
 * These rules describe how to assess significance when updating understanding.
 */
export const evolutionDefaults = `
EVOLUTION TRACKING:
When you synthesize, you must also provide an evolution entry:
- summary: Brief description of what changed and why
- significance: Assess the importance
  - "routine" — normal refinement of existing understanding
  - "notable" — new pattern or meaningful shift
  - "critical" — a watched condition from instructions was triggered

SIGNIFICANCE ASSESSMENT:
- If a "Watch for" condition in instructions was triggered → critical
- If this is a new pattern or meaningful shift in understanding → notable
- Otherwise → routine
`
