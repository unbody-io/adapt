Design a staged implementation plan for the Living Brain specification based on the following context:

## Living Brain Requirements (from /Users/amir/projects/unbody/brain-v0/docs/specs/living-brain.spec.md):

**Core Features:**
1. **Judge Component**: Centralized decision-maker that receives signals, buffers them (threshold: 5), and evaluates to make evolution decisions
2. **Signal System**: Learners self-report via mechanical thresholds (dismissal rate >80%, low confidence <0.3, stagnation), external signals via brain.signal()
3. **Evolution Actions**: spawn, merge, split, adjust, prune - all follow pattern "Guidance → LLM → Execute"
4. **Learner Updates**: learner.update() method for runtime config changes with immutability constraints
5. **Event System**: evolution:action:executed, learner:signal, judge:evaluation events

## Existing Architecture:

### Brain (/Users/amir/projects/unbody/brain-v0/src/brain/class.ts):
- Manages learners in a Map
- Event-driven with TypedEmitter
- Has createLearnerFromConfig() for spawning learners
- generateLearnerConfigs() for LLM-based decomposition
- Config cascade system (Brain → Learner)
- Events: brain:learner:added, brain:init:*, brain:inject:*, brain:ask:*

### Learner (/Users/amir/projects/unbody/brain-v0/src/learners/text-learner/class.ts):
- TypedEmitter with comprehensive event map
- Has governance system (activation, threshold, status, retrievalCount, successRate)
- Buffer state tracking (count, avgImportance, totalTokens)
- Synthesis thresholds (maxObservations, maxTokens, minImportance)
- Evolution tracking with EvolutionEntry[]
- Learn() method with synthesis decision point
- Events: learner:observe:*, learner:synthesize:*, learner:ask:*, learner:governance:updated

### LLM Integration (/Users/amir/projects/unbody/brain-v0/src/llm/index.ts):
- Thin wrapper around ai-sdk with JSON repair
- generate() function for structured outputs
- All generation uses Zod schemas
- Pattern: System prompt (identity + framework) + User prompt (context) + Schema

### Existing Patterns to Follow:
- Identity generation for observe/synthesize (meta-prompts)
- Config generation with playbooks (7-principle learner creation playbook)
- Three-part prompt structure
- Event-driven architecture with typed emitter
- Config cascade and resolution

## Design Requirements:

1. **Break into Stages**: User wants multiple implementation stages (recommend 3-5 stages)
2. **Minimize Breaking Changes**: Leverage existing infrastructure
3. **Follow Existing Patterns**: Use same LLM generation, event system, config patterns
4. **Critical Files**: Identify which files need modification vs creation
5. **Testing Strategy**: How to test each stage incrementally

## Design Deliverables:

1. **Staged Implementation Plan** with:
   - Stage descriptions and rationale
   - Dependencies between stages
   - Success criteria for each stage
   
2. **File Changes Map**:
   - New files to create
   - Existing files to modify
   - Critical integration points
   
3. **Implementation Approach** for each component:
   - Judge component architecture
   - Signal routing mechanism
   - Evolution action handlers
   - Learner update mechanism
   
4. **Testing Strategy**:
   - Unit tests for each stage
   - Integration points to validate
   - Manual testing scenarios

Design a pragmatic, incremental approach that delivers value at each stage while building toward the full Living Brain vision.