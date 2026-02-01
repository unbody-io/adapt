# Brain MVP Requirements

Minimum viable Brain implementation - learners only, no storage, no perceivers.

---

## Phase 1: Core MVP

### 1. Brain Creation

- [ ] `new Brain({ prompt, model })` or `Unbody.createBrain(prompt, { model })`
- [ ] Prompt parsing via LLM - infers what learners to create from natural language
- [ ] Only TextLearners (no List/Graph for MVP)
- [ ] Learners start dormant, ignite on first relevant data

### 2. Learner Management

- [ ] `brain.addLearner(config)` - manually add a learner
- [ ] `brain.getLearners()` - list all brain-level learners
- [ ] `brain.getLearner(id)` - get specific learner
- [ ] Direct learner access: `learner.ingest()`, `learner.ask()` still work

### 3. Subject Management

- [ ] `brain.subject(id)` - get or create subject (lazy creation)
- [ ] `subject.addLearner(config)` - add subject-level learner
- [ ] `subject.getLearners()` - returns subject-level + brain-level learners
- [ ] Brain-level learners shared across all subjects
- [ ] Subject-level learners scoped to one subject

### 4. Injection

- [ ] `brain.inject(data)` - routes to brain-level learners
- [ ] `brain.inject(data, { subject: "x" })` - routes to brain + subject learners
- [ ] `subject.inject(data)` - same as above
- [ ] Simple routing: all relevant learners receive data
- [ ] Returns aggregated results from all learners

### 5. Query

- [ ] `brain.ask(query)` - consults brain-level learners
- [ ] `brain.ask(query, { subject: "x" })` - consults brain + subject learners
- [ ] `subject.ask(query)` - same as above
- [ ] Response synthesis: combine multiple learner responses into one answer (LLM call)
- [ ] Include sources (which learners contributed)

### 6. Events / Observability

- [ ] `brain.on(event, handler)` - subscribe to brain events
- [ ] Events: `learner:created`, `learner:updated`, `inject:complete`, `ask:complete`
- [ ] Aggregate token usage across learners
- [ ] Forward learner events to brain level

---

## Phase 2: Update Flow

### 7. Brain Update

- [ ] `brain.update(prompt)` - update brain prompt
- [ ] Re-parses prompt, reconciles learners:
  - Create new learners if new concerns detected
  - Update existing learners if purpose refined
  - Deprecate learners if concerns removed
- [ ] Preserves understanding from existing learners where possible

### 8. Subject Update

- [ ] `subject.update(prompt)` - update subject prompt
- [ ] Same reconciliation logic as brain update
- [ ] Only affects subject-level learners

---

## Out of Scope (MVP)

- Storage (raw, records, chunks)
- Perceivers (extraction/enrichment)
- Advanced governance (decay, split/merge)
- Complex batching (time/size-based)
- ListLearner, GraphLearner
- Cross-subject queries
- Learner routing optimization (embedding similarity, etc.)

---

## API Summary

```typescript
// Creation
const brain = new Brain({ prompt, model })

// Learner management
brain.addLearner({ instructions: "..." })
brain.getLearners()
brain.getLearner(id)

// Subject management
const subject = brain.subject("user-123")
subject.addLearner({ instructions: "..." })
subject.getLearners()

// Injection
await brain.inject(data)
await brain.inject(data, { subject: "user-123" })
await subject.inject(data)

// Query
const result = await brain.ask("What patterns do you see?")
const result = await brain.ask(query, { subject: "user-123" })
const result = await subject.ask(query)

// Events
brain.on("learner:updated", (event) => { ... })

// Phase 2
await brain.update("new prompt...")
await subject.update("new prompt...")
```
