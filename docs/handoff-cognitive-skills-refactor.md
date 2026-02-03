# Handoff: Cognitive Skills Framework Refactor

## Overview

This session refactored the TextLearner architecture to introduce a **cognitive skills framework** and **pluggable learning methods**. The goal was to create a single source of truth for the classification taxonomy and simplify the overall architecture.

## Key Concepts

### Cognitive Skills Framework

The classification taxonomy (CONFIRMS, CONTRADICTS, EXTENDS, NEW, IRRELEVANT) was reframed as a **cognitive skills framework**:

- **Compare** is a "skill-set" - a collection of related cognitive skills
- **confirms, contradicts, extends, new, irrelevant** are individual "skills" within that set
- Skills are for **thinking**, not for output reporting - they guide how the learner processes data

### Learning Methods Abstraction

Two learning methods were introduced:

1. **DirectMethod**: Single LLM call with structured output (faster, requires structured output support)
2. **ToolBasedMethod**: Multi-step with tools (more control, works with all models, higher token usage)

## File Structure

```
src/learners/text-learner/
├── cognitive-skills/
│   ├── compare/
│   │   ├── skill.confirms.ts      # { key: 'confirms', meaning: '...' }
│   │   ├── skill.contradicts.ts
│   │   ├── skill.extends.ts
│   │   ├── skill.irrelevant.ts
│   │   ├── skill.new.ts
│   │   ├── skill-set.compare.ts       # Groups skills + skillSet metadata
│   │   ├── skill-set.compare.types.ts # Zod schemas & TypeScript types
│   │   └── index.ts
│   ├── utils.ts                   # skillsToPromptText() helper
│   └── index.ts
├── learning-methods/
│   ├── direct/
│   │   ├── prompt.template.identity.ts  # Meta-prompt for generating learner identity
│   │   ├── prompt.template.system.ts    # System prompt template
│   │   ├── schema.init.ts               # Identity schema (purpose, focusAreas, etc.)
│   │   ├── schema.output.ts             # LearnOutput schema
│   │   └── index.ts
│   ├── types.ts                   # LearningMethod interface, LearnResult, etc.
│   └── index.ts
└── tools/
    └── classify/
        └── schema.ts              # Uses compare.compareSkillEnum
```

## Key Changes

### 1. Single Source of Truth for Skills

Each skill is defined once in its own file:

```typescript
// skill.confirms.ts
export const key = 'confirms'
export const meaning = 'This reinforces what I already believe'
```

### 2. Simplified Output Schema

`evolution` changed from `{ summary, whatChanged }` to a plain string, because a single data batch can trigger multiple comparison outcomes:

```typescript
export const baseOutputSchema = z.object({
  newUnderstanding: z.string(),
  relevance: z.number().min(0).max(1),
  significance: significanceEnum,
  evolution: z.string(),  // Was { summary, whatChanged }
  reasoning: z.string().optional(),
})
```

### 3. Naming Conventions

| Old Name | New Name |
|----------|----------|
| `CompareOutcome` | `CompareSkill` |
| `outcome` field | `skill` field |
| `onClassification` callback | `onComparison` callback |
| `guidanceSchema` | `compareGuidanceSchema` |
| `outcomeEnum` | `compareSkillEnum` |
| `toPromptText()` | `skillsToPromptText(compare.skills)` |

### 4. Type Organization

Types are kept local to where they're used:
- `CompareSkill` and `compareSkillEnum` in `skill-set.compare.types.ts`
- `CompareGuidance` and `compareGuidanceSchema` in `skill-set.compare.types.ts`
- No unnecessary re-exports

## Consuming the Framework

### In Prompt Templates

```typescript
import { compare, skillsToPromptText } from '../../cognitive-skills'

const skillsText = skillsToPromptText(compare.skills)
const question = compare.skillSet.question
```

### In Zod Schemas

```typescript
import { compare } from '../../cognitive-skills'

const schema = z.object({
  skill: compare.compareSkillEnum,
  guidance: compare.compareGuidanceSchema,
})
```

### In TypeScript Types

```typescript
import type { CompareSkill } from '../cognitive-skills/compare'
```

## Design Principles Applied

1. **Simple First**: Each skill is just `{ key, meaning }` - no complex abstractions
2. **Single Source of Truth**: Skill definitions consumed by prompts and schemas
3. **Separation of Concerns**: Definitions vs types vs utilities in separate files
4. **Code is a Liability**: Removed `whatChanged` field, simplified evolution to string

## Commit

```
refactor(learners): introduce cognitive-skills framework and learning-methods

- Create cognitive-skills framework with compare skill-set
- Split skills into individual files (confirms, contradicts, extends, new, irrelevant)
- Introduce learning-methods abstraction (direct method)
- Simplify output schema: evolution is now a plain string
- Rename CompareOutcome -> CompareSkill throughout
- Add skillsToPromptText utility for prompt generation
- Update classify tool to use new skill terminology

30 files changed, 1196 insertions(+), 685 deletions(-)
```
