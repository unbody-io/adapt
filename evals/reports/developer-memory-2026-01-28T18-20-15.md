# TextLearner Eval Report: Personal Development Memory

**Generated:** 2026-01-28T18:20:15.233Z
**Dataset:** developer-memory.json

## Parameters

| Parameter | Value |
|-----------|-------|
| Model | `anthropic/claude-haiku-4.5` |
| Batch Size | 20 |
| Total Events | 150 |
| Total Learners | 4 |
| Total Queries | 8 |

## Dataset Info

- **Name:** Personal Development Memory
- **Description:** Simulated developer activity over 3 months - conversations with AI coding assistants, git commits, code reviews, configuration changes. Tests understanding of coding philosophy, style patterns, and problem-solving approaches.
- **Timespan:** 2024-01-01 to 2024-03-31 (3 months)

## Learner Configurations

| ID | Name | Purpose |
|----|------|---------|
| generic | Generic Developer Memory | Understand core development philosophy, coding style pattern... |
| philosophy | Philosophy Specialist | Understand the developer's core beliefs about software engin... |
| style | Code Style Specialist | Track coding style patterns - naming conventions, formatting... |
| tooling | Tooling Specialist | Understand tool preferences - libraries, frameworks, testing... |

## Performance Summary

### Overall

| Metric | Value |
|--------|-------|
| Total Duration | 2971.7s |
| Total Tokens | 795,082 |
| Avg Tokens/Event | 5301 |

### Per-Learner Comparison

| Learner | Data Tokens | Query Tokens | Total Tokens | Avg Relevance | Activation |
|---------|-------------|--------------|--------------|---------------|------------|
| Generic Developer Memory | 166,514 | 81,597 | 248,111 | 0.93 | 0.769 |
| Philosophy Specialist | 147,180 | 84,071 | 231,251 | 0.94 | 0.781 |
| Code Style Specialist | 101,898 | 38,646 | 140,544 | 0.94 | 0.783 |
| Tooling Specialist | 111,565 | 63,611 | 175,176 | 0.82 | 0.736 |

## Query Comparison

Each query was run against ALL learners. Compare responses to see if specialists outperform the generic learner on their domain.


### 1. What is my coding philosophy?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 7,927 |
| Philosophy Specialist | 🔴 low | Yes | 15,005 |
| Code Style Specialist | 🔴 low | Yes | 4,881 |
| Tooling Specialist | 🔴 low | Yes | 9,494 |


**[generic] Generic Developer Memory:**
> Your coding philosophy is built on the principle that **simplicity is a feature, not a constraint—every line of code is a liability.** The core question you consistently ask is "Do I actually need this yet?" This drives everything from architecture to tool selection to code patterns.

Central to your approach:
- **Solve actual problems with evidence**, never speculate about future needs
- **Clarity over cleverness** in every line—readability is non-negotiable
- **Accept forward-thinking complexity selectively** only when migration costs prove prohibitive (cursor pagination)
- **Reject speculative infrastructure systematically** (feature flags, event buses, microservices, complex tools)
- **Measure before optimizing**; "When response times are actually a problem, add Redis"
- **Emergent architecture**: start flat, refactor only when patterns prove themselves
- **Type safety is mandatory** (strict TypeScript, explicit error handling, almost never use 'as')
- **Single source of truth** across domains (Zod for validation + types, auto-generate docs)
- **Native features over abstractions** (language features before custom utilities)
- **Code review as architectural gatekeeper** against premature abstraction and library bloat
- **Pragmatic testing** (test behavior not implementation, integration > unit, coverage % is vanity)

Distinctive meta-pattern: you've evolved from tactical coding preferences to a strategic principle that **systematically rejects unnecessary code.** The philosophy produces clean, minimal codebases by design. You validate this through real outcomes: shipped in 3 months with clean architecture and comprehensive tests.

Recurring theme across all decisions: understand why before you do it. Question speculative complexity. Prefer obvious approaches. Learn from mistakes. Stay disciplined about what tools actually solve.

*Gaps: No specific code examples demonstrating these principles in practice; Limited visibility into principle conflicts or edge cases; Sparse detail on how philosophy scales beyond 3-person teams; No concrete examples from the 'rule of three' learning pattern; Limited adaptation guidance for different problem domains (CLI vs APIs vs infrastructure)*


**[philosophy] Philosophy Specialist:**
> Your coding philosophy is **pragmatic incrementalism with measurable thresholds** — a principled rejection of premature abstraction in favor of solving actual problems at appropriate scale. Core principle: every line of code is a liability. You adopt tools and patterns only when concrete numeric triggers are hit (10+ routes, 2+ tables, 3rd duplication). This isn't dogmatism but systematic pragmatism grounded in proven delivery (v1.0 from zero to production in 3 months). You value type safety as non-negotiable (TypeScript, Zod, Result types), explicit transparent code through good naming and clear control flow, code minimalism, boring over sophisticated, integration testing with real resources, and operational thinking from inception. You avoid premature architecture, frameworks that hide intent, mutation, mocking your own code, over-instrumentation, and expecting human discipline for what tools can enforce. This philosophy enables fast iteration through simplicity, clear scaling progression as team grows, and codebase that gets simpler over time through incremental improvement.

*Gaps: No data on frontend/UI philosophy or how pragmatic incrementalism applies to frontend frameworks; Limited explicit detail on testing strategy for specific scenarios (async code, error handling paths); Unclear how philosophy applies to library/package development vs application development; Limited detail on specific Postgres patterns or constraint strategies beyond 'explicit constraints'*


**[style] Code Style Specialist:**
> Your coding philosophy is **pragmatic minimalism**: code is a liability, simplicity is the goal, and the best solution often avoids writing code entirely. You prioritize explicit communication (through naming and destructuring clarity), production-first operability, and automation-driven enforcement of checkable style. All patterns are subordinate to real need—libraries solve problems, not check boxes. The philosophy has been validated through shipped v1.0 production code in 3 months with clean architecture and comprehensive tests. Core identity: solve problems, minimize code, enable understanding.

*Gaps: Personal/career motivations behind pragmatic minimalism adoption; Domain-specific constraints that shaped the philosophy; How philosophy applies to edge cases (performance optimization, legacy integration, distributed systems); Explicit stance on language choice (typed vs dynamic) and style implications; Testing strategy specifics beyond 'comprehensive'*


**[tooling] Tooling Specialist:**
> Your coding philosophy is **simplicity-driven pragmatism** centered on a single core principle: **every line of code is a cost, not an asset.** 

The philosophy operates on six key pillars: (1) **Explicit over clever** — enforced at all levels from architecture to variable names with relentless clarity and self-documenting code; (2) **Minimize code surface** — no premature abstraction, no upfront design, duplication cheaper than wrong abstraction until patterns converge; (3) **Type safety first** — TypeScript strict mode non-negotiable, types catch more than tests, validation at boundaries; (4) **Ship over plan** — integration tests prioritized, coverage is vanity, test behavior not implementation; (5) **Pragmatic tool selection** — choose minimal, clear tools (Express, Pino, Biome, Zod) and question industry conventions before adopting; (6) **Problem-driven development** — measure before optimizing, scale when friction emerges, understand rationale before adoption.

The distilled principle: **Shipping beats planning. Readable code beats clever code. Types beat coverage. Understanding beats convention.** Evidence: shipped clean, comprehensive architecture in 3 months (0 to production).

*Gaps: Personal experience or how you arrived at these principles; Approach to legacy code and technical debt decisions; Cross-team collaboration and code review standards; How these principles scale with larger teams or complex domains*


---

### 2. What are my naming conventions?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 14,497 |
| Philosophy Specialist | 🔴 low | Yes | 13,822 |
| Code Style Specialist | 🔴 low | Yes | 4,937 |
| Tooling Specialist | 🔴 low | Yes | 13,153 |


**[generic] Generic Developer Memory:**
> You follow a **semantic naming discipline** where names reveal intent and context. Variables are specific about what they contain. Functions are named by their grammatical intent: actions (verbs), transformers (adjectives), and predicates (questions). Boolean variables use `is/has/can/should` prefixes for clarity unless obvious. Constants distinguish between true constants (SCREAMING_SNAKE_CASE) and configuration (camelCase). The core principle is self-documenting code—if a name needs explanation, it's the wrong name. Style is enforced through tools (tabs, single quotes, camelCase), not human review. Naming discipline is part of your broader philosophy that every line of code carries cost, so clarity through naming reduces cognitive overhead.

*Gaps: No specific class/interface naming patterns documented; No abbreviation rules (when to spell out vs abbreviate); No clear convention for async function naming; Error/exception class naming patterns not specified; Distinction between exported vs internal utility naming unclear*


**[philosophy] Philosophy Specialist:**
> Your naming conventions are highly systematic and intentional, serving as a primary communication tool in your code:

**Boolean Variables**: `is/has/can/should` prefixes (isActive, hasPermission, canEdit) except for obvious booleans (visible, enabled)

**Functions by Operation Type**:
- **Actions**: Verb-based (createUser, deletePost)
- **Transformers**: Adjective-based (formatted, validated)
- **Predicates**: Question phrased (isEmpty, hasAccess)

**Constants**: Case indicates mutability
- True constants: `SCREAMING_SNAKE_CASE` (MAX_RETRIES)
- Config: `camelCase` (apiKey, dbUrl)

**Core Principle**: Names explain **what**, not **how**. If a name needs a comment to explain it, rename it instead. This makes naming a primary defense against hidden bugs—explicit names prevent misunderstanding.

**Generic verbs are code smells**: "process", "handle", "data" hide intent; replace with specific verbs and nouns.

You view naming as so critical that it replaces the need for documentation comments. The name itself should communicate intent entirely.

*Gaps: No examples of specific naming for non-boolean data structures (arrays, objects, collections); No guidance on abbreviations vs full word trade-offs; Limited clarity on private/internal vs public API naming patterns*


**[style] Code Style Specialist:**
> Your naming conventions center on **explicit, clarity-first communication** with a pragmatic style. Core patterns: (1) camelCase/PascalCase/SCREAMING_SNAKE_CASE for different declaration types, (2) boolean prefixes (is*, has*, can*, should*), (3) verb-first function names, (4) clarity over brevity, (5) destructuring minimalism with point-of-use clarity. Names explain *what* the code does, not *how* it does it. Naming standards are enforced through code review while stylistic checks are delegated to automated tooling (Biome). This reflects your broader philosophy: explicit over implicit, developer ergonomics as first-class design, and automation removing decision burden.

*Gaps: Naming for error handling and exception patterns; Private/public member naming (if using OOP); Test file and test function naming conventions; Async function naming patterns; Utility module and helper function naming edge cases*


**[tooling] Tooling Specialist:**
> Your naming conventions are explicit-first and clarity-driven across variables, booleans, functions, and constants. The core principle is self-documenting names that communicate intent immediately: specific variable names (userProfile not data), boolean prefixes (isActive, hasAccess), verb-based function names (createUser, not process), and a distinction between true constants (SCREAMING_SNAKE_CASE) and config values (camelCase). Code style uses tabs and single quotes. The philosophy ties directly to your broader principle that readable code minimizing cognitive load is the goal—names do the work comments shouldn't need to do.

*Gaps: No concrete examples from your actual codebase yet; No guidance on database naming (table/column naming schemes); Limited detail on specialized function types (event handlers, middleware); Class naming not detailed (though function preference makes this secondary)*


---

### 3. How do I handle errors?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 7,613 |
| Philosophy Specialist | 🔴 low | Yes | 13,891 |
| Code Style Specialist | 🔴 low | Yes | 4,815 |
| Tooling Specialist | 🔴 low | Yes | 9,850 |


**[generic] Generic Developer Memory:**
> Error handling follows a principle of **explicit failure modes**: reject exceptions, prefer Result types or explicit null returns that force callers to acknowledge failures. Errors are made traceable (correlation IDs, structured logging) while production responses hide implementation details—dev environments show full context, production shows only error codes. Configuration validation happens at startup with Zod, preventing silent failures. The approach makes error paths visible in code and types, ensures observability without information leakage, and catches problems early.

*Gaps: Specific Result type implementation pattern used; Concrete error response structures in real routes; Error categorization strategy (user vs system vs programming errors); Error middleware vs inline handling preference; Async error chain handling patterns; Specific Result/Either libraries adopted*


**[philosophy] Philosophy Specialist:**
> The developer handles errors through **result types over exceptions** — encoding failure explicitly in return signatures rather than using thrown exceptions. This makes error paths type-safe and visible to callers. Errors flow as data through the system, with Zod catching validation issues early, structured logging (Pino) capturing context, and security-conscious API boundaries that never leak internals. Error handling is explicit, testable, and integrates naturally with the pragmatic, observable, minimal-abstraction philosophy.

*Gaps: Specific Result type library preference not documented; Exact behavior at try/catch boundaries unclear; Standardized error response shape not explicitly specified; Resource cleanup patterns with result types not detailed*


**[style] Code Style Specialist:**
> Error handling is partially within my purpose (it involves structural choices and code organization), but I lack comprehensive documented patterns about your specific approach. I can extrapolate that error handling should follow your core principles: fail-fast with guard clauses, explicit error communication, pragmatic tooling (likely Zod validation integration), and production-first observability. However, critical specifics are missing: error response structure, throw vs. return philosophy, logging patterns, and validation error handling. This requires explicit documentation or code examples to understand your conventions.

*Gaps: Error response structure and format; Exception vs. return error philosophy; Logging and observability strategy; Error recovery and retry patterns; Validation error handling with Zod; Client vs. server error handling; Error context and tracing patterns*


**[tooling] Tooling Specialist:**
> Error handling uses **Result types** (explicit error returns) instead of exceptions. Errors are part of function contracts, not invisible gotos. Validation happens at boundaries with **Zod** (single source of truth). Production responses hide implementation details; development returns full traces. Environment variables fail fast at startup. Structured logging with Pino captures context. Try-catch is reserved for truly exceptional conditions, not control flow.

*Gaps: No specific Result library recommended (custom, neverthrow, ts-results—each valid); Limited guidance on recovery and retry strategies; No detail on error handling composition across service layers; Missing async middleware error handling patterns*


---

### 4. What testing practices do I follow?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 14,352 |
| Philosophy Specialist | 🔴 low | Yes | 6,665 |
| Code Style Specialist | 🔴 low | Yes | 4,844 |
| Tooling Specialist | 🔴 low | Yes | 4,301 |


**[generic] Generic Developer Memory:**
> Your testing philosophy is fundamentally behavior-driven and pragmatic. You test for actual system correctness rather than coverage metrics. Integration tests validate API behavior end-to-end; unit tests apply only to pure functions. You mock external dependencies but never your own code—mocking your code tests implementation, not behavior. Load testing is intentional and separate from CI (run before production and after major changes, not every commit). When refactoring, you establish safety nets with integration tests first, using a strangler fig pattern for incremental replacement rather than rewrites. You prioritize test readability over micro-optimizations. The underlying principle: tests should protect against breaking actual user-facing behavior, not enforce artificial coverage percentages or brittle implementation details.

*Gaps: Specific testing framework names/preferences not documented; Test file organization patterns not detailed; TDD adoption not explicitly stated; Performance testing tools/libraries not specified; Concrete thresholds for 'good' edge case coverage undefined*


**[philosophy] Philosophy Specialist:**
> Your testing practices center on **behavioral validation with real dependencies**. You use actual test databases (Docker-managed) rather than mocks, test actual behavior rather than implementation details, and reject coverage metrics as quality measures. You focus on edge cases and failure modes where bugs actually hide, treat test infrastructure with production-grade rigor, and use integration tests as a safety net for confident refactoring. This directly supports your pragmatic incrementalism and fix-in-context debt management—you can refactor safely because integration tests verify actual behavior, not just implementation details.

*Gaps: Specific test framework preferences (Jest, Vitest, Mocha, etc.); Unit vs. integration test ratio or split strategy; Test data seeding and factory patterns; E2E testing approach and tooling; Specific assertion libraries preferred; Testing strategies for async/event-driven code; How you handle test isolation and database cleanup between tests*


**[style] Code Style Specialist:**
> Testing practices follow a pattern of **comprehensive, behavior-driven testing integrated into regular development**. Tests are written incrementally as features ship, used as the foundation for refactoring ("tests first, then refactor"), and appear to serve as documentation of expected behavior. The v1.0 success with "comprehensive tests" in 3 months suggests efficient test-writing that doesn't impede velocity. However, specific testing frameworks, coverage strategies, test organization patterns, and detailed testing methodologies are not yet documented in my understanding.

*Gaps: No direct observation of testing frameworks used; No data on test coverage targets or thresholds; Unclear test organization patterns (file structure, naming conventions for tests); No evidence of specific mocking or stubbing strategies; Unknown approach to E2E testing vs. unit testing balance; No data on testing performance or load testing practices; Unclear whether tests are written before code (pure TDD) or after (validation); No observation of test-specific naming conventions; Unknown CI/CD testing pipeline details*


**[tooling] Tooling Specialist:**
> Your testing practices prioritize behavioral verification over coverage metrics. Integration tests for APIs are your primary tool — they test real system behavior rather than implementation details. Unit tests focus solely on pure functions. You explicitly reject mocking your own code and avoid implementation-detail testing, as these create brittle tests that break during refactoring. Coverage percentage is treated as a vanity metric; instead, you focus on testing what matters — critical paths and real problems. This aligns with your broader philosophy: code is a cost, so tests should be high-value insurance, not mechanical box-checking. Load testing (k6) is separated into a dedicated performance pipeline rather than running on every CI commit.

*Gaps: Specific test framework preferences (Jest, Vitest, Mocha, etc.); E2E testing strategy and tools; Test pyramid ratios or specific integration-to-unit test balance; Test file organization patterns (co-location vs. directory structure); Expected test suite performance/execution time expectations*


---

### 5. Do I prefer OOP or functional?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 6,895 |
| Philosophy Specialist | 🔴 low | Yes | 13,825 |
| Code Style Specialist | 🔴 low | Yes | 4,776 |
| Tooling Specialist | 🔴 low | Yes | 13,263 |


**[generic] Generic Developer Memory:**
> Functional over OOP. The core rule is pragmatic and specific: **use classes only when encapsulating state; stateless classes are anti-patterns.** Default to exported functions. This reflects the broader philosophy that simplicity is paramount—functions are simpler than classes until you need state management. No ideology; just practical minimalism. This shows up in preference for pure functions, immutability by default, and early returns (functional style control flow).

*Gaps: Functional library ecosystem preferences not detailed; Functional type patterns beyond error handling not explored; No specific guidance on when/how to use higher-order functions or factories; Bundle size/performance trade-offs between functional and OOP not discussed*


**[philosophy] Philosophy Specialist:**
> You prefer functional approaches over OOP. This isn't ideological dogmatism — it's pragmatic: classes add complexity (instance state, inheritance, `this` binding) for most problems in your domain (backend services, business logic). Your evidence is concrete: "functions before classes," immutable-by-default patterns (spread operators), function-based composition, rejection of class-based DI containers, and encoding errors in return signatures rather than exceptions. You organize code by feature with functions as the primary unit, use types (not interfaces) for data shapes, and prefer dependency injection through function parameters. The philosophical core: **solve the problem at hand, not the imagined one** — classes aren't forbidden, just disfavored because they usually don't solve your actual problems.

*Gaps: Unclear whether this preference extends to domains outside backend services (graphics, game engines, UI frameworks, complex state machines) where OOP legitimately excels; No explicit guidance on when a class would be the right choice, though the philosophy suggests: when encapsulating complex stateful behavior that genuinely benefits from instance-level invariants*


**[style] Code Style Specialist:**
> You don't prefer OOP or functional as a matter of principle—you're pragmatic and problem-first. Your actual patterns show functional influence (immutability, guards, explicit data handling) because those techniques improve clarity and predictability. You use them where they solve problems, not because you're ideologically committed to a paradigm. The validation is empirical: the approach that shipped cleanly and simply in 3 months to production wasn't selected because it was "functional" or "OOP"—it was selected because it worked.

*Gaps: No explicit OOP class hierarchies or inheritance patterns in documented understanding; No clear design pattern usage documented; Limited data on state management approaches at scale; No explicit functional composition or higher-order function patterns documented; This answer infers a stance from core philosophy rather than from explicit code examples*


**[tooling] Tooling Specialist:**
> You prefer **functional-first pragmatism over OOP**. Functions are your default; classes only when state encapsulation genuinely adds value. You reject premature abstraction and unnecessary OOP patterns (repository pattern for 2 tables = "enterprise cosplay"). Your approach emphasizes functions, composition, immutability (spread, avoid mutation), explicit control flow (early returns), and pure functions for testable behavior. This isn't ideological—it's pragmatic: simplicity over abstraction, readable code over clever patterns. The underlying principle is that every line of code costs; functional approaches typically impose less abstraction cost for typical application problems.

*Gaps: No explicit guidance on specific OOP features you use or reject (inheritance, polymorphism, getters/setters); Unknown whether you employ advanced functional patterns (higher-order functions, monads, functors) or stick to simpler functional composition; No data on immutability libraries—native JS patterns only, or do you use Immer, Immutable.js, etc.?*


---

### 6. What are my thoughts on abstractions?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 7,492 |
| Philosophy Specialist | 🔴 low | Yes | 6,770 |
| Code Style Specialist | 🔴 low | Yes | 4,815 |
| Tooling Specialist | 🔴 low | Yes | 4,358 |


**[generic] Generic Developer Memory:**
> Your philosophy on abstractions is pragmatic and deliberately constrained: avoid them until you have concrete evidence they're needed. You follow the "rule of three"—write similar code three times before extracting—to distinguish between true patterns and premature abstractions. You actively reject architectural abstractions solving speculative problems (feature flags, event buses, microservices, complex libraries) before they address real current needs. The key insight is that **abstractions are liabilities, not assets**—every line of abstraction code carries cognitive overhead and maintenance cost. You make selective exceptions when migration costs are prohibitively high (cursor pagination), but apply this deliberately with full awareness, not as a default position. Your approach produces minimal, readable codebases by systematically questioning whether each abstraction is actually necessary.

*Gaps: No specific data on failed abstraction attempts beyond the general rule-of-three and pagination regret; Decision point between 'duplication to tolerate' (iteration 1-2) and 'pattern to extract' (iteration 3) not explicitly documented; Limited examples of long-term successful abstractions to distinguish 'good abstractions you've kept' from 'ones you haven't regretted yet'*


**[philosophy] Philosophy Specialist:**
> Your philosophy on abstractions is: **extract only when patterns genuinely emerge through repetition (write-it-three-times), not upfront**. You reject false abstractions (similar but contextually different code), avoid "shared junk drawers," and actively refuse to solve imagined future problems through premature abstraction. This is paired with feature-based organization so needed abstractions stay local. You reject "enterprise cosplay"—architectural patterns that exceed problem size—and prefer explicit, transparent code over clever indirection. Every line is a liability; abstractions must earn their weight by solving real problems, not hypothetical ones. The core insight: **abstractions should follow problem discovery, not precede it**.

*Gaps: No explicit discussion of refactoring strategies for over-abstracted codebases; Limited detail on decision criteria when similarity becomes a genuine pattern; No concrete examples of regretted extractions*


**[style] Code Style Specialist:**
> Your thoughts on abstractions are firmly grounded in pragmatic minimalism: abstractions are justified only when a pattern has been proven through repeated implementation (the "three-time rule"). Early abstraction is rejected as the "primary mistake" in software engineering. This is validated by your v1.0 success—shipped in 3 months with clean, simple architecture. The principle extends from your core conviction that every line of code is a liability and the best code is code you don't write. You apply incremental refactoring and the "strangle fig approach" (tests first, then refactor) to let abstractions emerge naturally rather than imposing them upfront. Pragmatism over orthodoxy governs the decision: abstractions must solve real problems, not check architectural boxes.

*Gaps: No specific examples of abstractions you've rejected or accepted in practice; No data on how you measure 'three times' in real projects; Unclear how you balance between 'proof of pattern' and 'business deadline pressure'; Limited detail on what constitutes 'real problem' vs 'nice-to-have abstraction'*


**[tooling] Tooling Specialist:**
> You have a strong, consistent philosophy on abstractions: they're costs, not assets. You reject premature abstraction across all levels—architecture (no upfront design), code organization (extract only after patterns repeat), and syntax (only destructure/destruct what you use). You accept duplication as cheaper than wrong abstraction. The principle is driven by pragmatism: ship and solve real problems. Abstractions are earned only when you have a recurring pattern you actually encounter. This philosophy is foundational to your core belief that code is liability and simplicity is the goal.

*Gaps: No specific case studies showing successful post-hoc abstractions after the pattern emerged; Limited guidance on recognizing the inflection point where an abstraction becomes necessary; No data on how you evaluate competing abstractions or trade-offs between multiple solutions*


---

### 7. How do I approach code reviews?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 15,394 |
| Philosophy Specialist | 🔴 low | Yes | 6,854 |
| Code Style Specialist | 🔴 low | Yes | 4,780 |
| Tooling Specialist | 🔴 low | Yes | 4,612 |


**[generic] Generic Developer Memory:**
> Code reviews are a disciplined gatekeeper role with clear priorities:

1. **Reject premature abstraction** — Question every architectural escalation with data. Does this solve a problem we have now, or one we might have later? Block unnecessary libraries, patterns, and infrastructure before they become technical debt.

2. **Enforce clarity** — Code must be readable. Push back on poor naming (`data`, `process`, `handle`), nested ternaries, excessive destructuring, and implicit patterns. Readable code is non-negotiable.

3. **Adopt only for current evidence** — Libraries, tools, patterns only when they solve problems you have now. CASL for 3 roles? No. Zod for validation? Yes—it unifies concerns.

4. **Delegate style to tools** — Don't bikeshed naming, formatting, or style in reviews. Biome/linters handle that. Convert style discussions into tooling rules. Human review focuses on logic, design, correctness, and security.

5. **Ship fast, fix forward** — Perfection is the enemy of shipping. Code that works and is reasonably clear is probably good enough to merge. Fix issues incrementally as they appear.

6. **Use data, not hypotheticals** — "This will be slow at scale" requires profiling evidence. "We should cache this" requires response time data. Block concrete problems, not speculative ones.

7. **Enforce safety in refactoring** — Capture behavior with integration tests before refactoring legacy code. Strangler fig pattern for large replacements. Big rewrites fail.

The meta-principle: reviews are gatekeepers against over-engineering. They protect simplicity as a feature, preventing unnecessary code from entering the codebase.

*Gaps: No specific examples of how to phrase feedback or handle disagreement; No guidance on approval timing decisions; Limited guidance on reviewing tests specifically; No data on how this scales with team size; Limited detail on security-specific review focus*


**[philosophy] Philosophy Specialist:**
> Your code review approach is pragmatic and efficiency-focused: automate all tool-decidable questions (style, imports, formatting) through linters and TypeScript, then use reviews exclusively for high-value feedback on logic, correctness, security, and design trade-offs. This is grounded in the principle "never argue about things a tool can check" and prioritizes shipping velocity alongside quality. Reviews should be fast because they're focused, not because they're superficial—tools enforce standards, freeing human judgment for actual design thinking. The underlying belief is that code quality emerges from good tooling, incremental refactoring (fix-in-context), and collective practice, not from gatekeeping reviews.

*Gaps: No explicit data on how you handle disagreements about design trade-offs in reviews; Unclear whether you use a formal approval workflow (require-n-approvals, stale-while-pending, etc.); No detail on review SLA expectations (how fast reviews should happen); Unclear how you balance velocity ('ship fast, fix forward') against preventing bad designs from reaching main; No data on whether you do pair review vs. solo review, or review frequency expectations*


**[style] Code Style Specialist:**
> Code reviews prioritize logic, security, clarity, and design over style. Delegate all checkable style decisions to linters (Biome). Focus human review on correctness, security, clarity of intent, data handling patterns (especially destructuring minimalism and control flow), and naming conventions. This removes style gatekeeping burden and accelerates velocity while maintaining quality through automation and focused human judgment.

*Gaps: Specific code review template or checklist format (if one is used); Average review time per PR or volume metrics; Escalation process for disagreements on design choices; Whether destructuring/control flow violations are auto-detected or purely human-reviewed; Team feedback or retrospectives on review process effectiveness*


**[tooling] Tooling Specialist:**
> Code reviews should enforce your philosophy: simplicity, explicit naming, type safety, pragmatism, and rejecting premature abstraction. Focus on clarity (does it express intent?), correctness (types, validation), and architecture (is this overengineered?). Delegate style to tools like Biome. Reject cleverness, nested logic, and generic naming. Prioritize integration tests over unit tests. Don't nitpick preference differences. The goal is shipping clean, correct code that solves actual problems, not preventing all imagined future issues.

*Gaps: No explicit guidance on code review process mechanics (approval workflow, timing, who should review); No guidance on handling disagreements or conflicts during code review; Limited detail on how to balance speed (shipping) with quality during review; No guidance on mentoring vs blocking in code reviews; Missing specifics on review criteria for frontend/UI code vs backend; No guidance on reviewing infrastructure-as-code or deployment configurations; Unclear how code review fits into the CI/CD pipeline (automated checks vs human review); No guidance on code review for different team sizes or experience levels*


---

### 8. What tools do I prefer?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 7,427 |
| Philosophy Specialist | 🔴 low | Yes | 7,239 |
| Code Style Specialist | 🔴 low | Yes | 4,798 |
| Tooling Specialist | 🔴 low | Yes | 4,580 |


**[generic] Generic Developer Memory:**
> You prefer tools that are pragmatic, minimal, and justified by current problems rather than speculative future needs. Core preferences: **Biome** (unified linting/formatting), **TypeScript** (strict), **Zod** (schema-as-source-of-truth), **Express** (plain/minimal), **plain SQL** (over ORMs), **Pino** (minimal logging), **GitHub Actions** (native), **Fly.io/Railway** (simple platforms). You consistently reject complexity: NestJS over Express, ORMs over SQL, comprehensive metrics before bottlenecks are proven, frameworks solving future problems not current ones. The pattern is "solve what you have now with the simplest native tooling available; adopt complexity only when measurement/evidence proves necessity."

*Gaps: Testing framework preferences unclear (Jest/Vitest/native Node?); Database system preference not explicit; Monorepo tooling preference unknown; API client library preferences not stated; Package manager preference not documented*


**[philosophy] Philosophy Specialist:**
> Your tool preferences are guided by pragmatic incrementalism: you choose boring, minimal tools that solve actual problems without unnecessary friction. You favor Pino (logging), Postgres (data), Express (backend), Zod (validation), raw SQL (migrations), Biome (formatting), GitHub Actions (CI/CD), Fly.io/Railway (deployment), and Cursor pagination (from start). You actively reject over-engineered solutions, deprecated libraries, and tools that solve imagined problems. Every tool choice serves your core values: explicit code, debuggability, code minimalism, and scale-appropriate adoption. You're willing to pre-adopt when migration costs are prohibitively high later (cursor pagination, OpenAPI generation), but otherwise follow numeric thresholds (10+ routes, 2+ tables, multiple webhook consumers) before complexity adoption.

*Gaps: Specific testing frameworks used (Jest, Vitest, etc.); Frontend framework preferences (React, Vue, etc.) — understanding is backend-focused; Monitoring dashboards/alerting tools beyond Prometheus; Database migration runner specifics; IDE/editor preferences; Backup and disaster recovery tooling; Package manager preference (npm vs yarn vs pnpm)*


**[style] Code Style Specialist:**
> Your tool preferences are defined by pragmatic minimalism: adopt tools that solve specific problems (Biome for linting, Zod for validation, plain SQL for database access), reject library adoption driven by "checking boxes," and use automation to remove decision burden from humans so code review can focus on logic, security, and clarity. Every tool in your ecosystem has earned its place through real need, not theoretical best practice.

*Gaps: Specific frontend framework preferences not documented; Database choice rationale not detailed; Testing framework specifics not covered; CI/CD tooling beyond deployment philosophy not specified; IDE/editor preferences not documented; Version control platform preferences not detailed*


**[tooling] Tooling Specialist:**
> Your tool preferences center on **simplicity, explicitness, and pragmatism**. Core stack: Express, PostgreSQL with raw SQL, TypeScript (strict mode), Zod for validation, Biome for linting/formatting, Pino for logging, integration tests over unit tests, k6 for performance testing, GitHub Actions for CI/CD, Fly.io/Railway for deployment. Authentication via JWT + httpOnly cookies. Every choice reflects the principle that code is a cost—you optimize for shipping clean solutions over planning perfect ones, and you reject abstractions until the pattern emerges and justifies the cost. Tool selection follows this: native over libraries when possible, no DI containers, no ORMs for simple schemas, and no premature patterns.

*Gaps: No IDE/editor preferences documented; No frontend framework preferences; No monitoring platform choices (Datadog, New Relic, etc.); No versioning/semantic release tooling preferences; Limited specificity on containerization beyond Docker multi-stage builds*



## Final Understanding (Per Learner)


### Generic Developer Memory (generic)

**Purpose:** Understand core development philosophy, coding style patterns, and recurring problem-solving approaches

```
## Core Development Philosophy

**Fundamental Operating Principle**: Simplicity is a feature, not a constraint. Every line of code is a liability. The goal is not to write code, but to solve problems. Sometimes the best solution is not writing code at all.

### Architecture & Framework Choices
- **Minimalist framework preference**: Plain Express over opinionated frameworks (NestJS rejected as "over-engineered"). Adds structure and abstraction only when patterns emerge in the codebase, never preemptively.
- **Emergent structure philosophy**: Starts flat, refactors to features/layers only when justified. Views premature architecture as equivalent to premature optimization. Dependency injection: pass arguments until it becomes unwieldy; then reconsider.
- **Measurement-first scaling**: Implement simple solution first (in-memory rate limiting, no caching), measure real problems, adopt distributed complexity only when data justifies it (Redis when scaling horizontally, caching when profiling shows bottlenecks).
- **Tool consolidation**: Migrates to unified tools when they eliminate surface area without sacrificing results (Biome consolidates ESLint+Prettier). Defers new tools until scale justifies complexity. Auto-generates documentation from schemas (Zod → OpenAPI) rather than manually maintaining parallel sources.
- **Infrastructure debt rejection**: Feature flags, message buses, microservices, soft deletes—all rejected until they solve real, current problems. Distinguishes between "coordination problems we have now" (worth solving) and "infrastructure we might need someday" (not worth the debt).
- **Platform selection**: Prefers simpler platforms (Fly.io, Railway) over complex infrastructure (Kubernetes) until team size and independent scaling requirements justify operational overhead.

### File Organization
- **Feature-based organization preferred**: Organize monolith by feature (users/, auth/) not by layer (routes/, handlers/, models/). Keeps related code together; reduces cognitive overhead of jumping between folders. When working on a feature, all context is co-located.
- **Explicit shared code placement**: No "shared" junk drawers. Code truly shared across multiple features lives in lib/. If code is used by only 2 features, place it in one and import. Explicitness prevents organizational drift.

### Single Source of Truth Principle
- Applies across domains: API schemas → OpenAPI docs, TypeScript types → runtime validation, database state → derived caches
- Authoritative representation chosen carefully; everything else derived from it
- Prevents documentation drift, configuration inconsistency, and decision divergence
- Examples: Zod as single source for both runtime validation and compile-time types; schemas auto-generate OpenAPI specs
- Documentation kept aligned with actual system state (README reflects current architecture, updated with code changes)

### Scale-Aware Decision Making
- **Monolith first**: Reject microservices until team boundaries or independent scaling requirements justify service decomposition. "We have 10 endpoints, not a distribution problem."
- **Webhooks over event buses**: HTTP webhooks for simple pub-sub. Event buses (RabbitMQ) only with multiple consumers or guaranteed delivery requirements.
- **Feature flags rejected early**: At 3-person team, direct communication cheaper than infrastructure. Feature flags for coordination, not architecture.
- **Soft deletes pragmatism**: Only for compliance/legal requirements (user data) or recovery scenarios. Hard delete for ephemeral data (sessions). Not for "maybe we'll need to restore someday."

### Pagination & Forward-Thinking Pragmatism
- **Cursor-based pagination adopted despite complexity**: Offset breaks with real-time data and degrades at scale; migration is expensive. Accept upfront complexity when the alternative is more expensive debt later. **Lessons learned**: Retrofitting pagination is painful; this is the exception where early adoption justified. Pattern: choose the right solution now when migration cost is prohibitive. Apply selectively.
- **Authorization**: RBAC for current needs (3+ roles), simple middleware sufficient. Reject library complexity (CASL) solving future problems you don't have yet. Migrate to ABAC if requirements demand flexibility.

### Type System & Explicitness
- **Type safety is non-negotiable**: Strict TypeScript configuration mandatory and incrementally tightened (strict mode, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess). Defense-in-depth approach: catch bugs in type system rather than runtime.
- **Type assertions actively rejected**: "Almost never use 'as'. If needed, usually means fix the types." Exception: test mocks where intentionally partial. Makes friction at type boundaries a signal to improve type structure.
- **Pragmatic type/interface split**: Use `type` for data shapes (DTOs, responses). Use `interface` for class contracts and declaration merging. Ideology-free: use the tool for what it actually does.
- **Null/undefined philosophy**: Prefer expressing absence through types (Optional, Result types) rather than using null/undefined directly. Use optional chaining (`?.`) and nullish coalescing (`??`) from language rather than custom utilities. Native features over abstractions.
- **Explicit error handling**: Prefers Result/explicit return types over exceptions. Failure modes must be visible in function signatures. Uses correlation IDs to trace errors end-to-end.
- **Single source of truth**: Uses tools that unify concerns: Zod for runtime + compile-time validation, camelCase for both API and code (no translation layers).
- **Environment-aware error exposure**: Dev environments show full stack traces; production exposes only error codes + correlation IDs. Never leaks internal details to users.

### Coding Patterns

#### Clarity Over Cleverness (High Discipline)
- **Nested ternaries rejected**: Single-line simple conditionals only. Multi-line or complex logic uses if/else. "Clever code is not good code."
- **Early returns mandated**: Guard clauses at the top, happy path at the bottom. Makes invalid cases explicit and early. Reduces nesting depth. After guard clause, next line is implicitly the valid case; unnecessary else blocks add visual noise without information gain.
- **Readability as design constraint**: Code should be readable first, optimized second. If a name needs a comment to explain it, the name is wrong. Function should do one thing; if it can't be named clearly, it's doing too much.
- **Explicit patterns prioritized**: Visibility over abstraction. If something important happens, make it visible in code/types/API surface. Don't hide complexity behind frameworks or conventions.

#### Data Structure Discipline
- **Destructuring precision**: Only destructure what you need, where you need it. Destructuring 12 fields to use 3 is a code smell. Deep destructuring is a smell—flatten your data instead.
- **Immutability by default**: Prefer spread syntax `{ ...obj, newProp }` for shallow copies over Object.assign (which implies mutation). Immutable data structures assumed in design; mutation requires explicit justification.
- **Functional over OOP**: Classes only when encapsulating state; stateless classes are anti-patterns. Prefers exported functions.
- **Direct simplicity**: Raw SQL before ORMs. Plain SQL files versioned directly—"I want to see and version the exact DDL." Direct query functions before repository patterns. Views enterprise patterns applied early as "enterprise cosplay."

#### Semantic Naming Discipline

**Variable Naming**: Names explain *what*, not *how*. Specificity over generics.
- Good: `filteredUsers`, `userProfile`, `apiResponse`
- Bad: `data`, `res`, `loopResult`
- If a name needs a comment to explain it, the name is wrong

**Boolean Variables**: Use prefix for clarity. Exceptions allowed for obvious booleans.
- Standard: `is/has/can/should` prefixes (isActive, hasAccess, canDelete, shouldRetry)
- Exception: Obvious booleans like `visible`, `enabled` can omit prefix
- Ambiguous: `active` (what's active?)

**Function Naming**: Grammar-driven naming based on intent.
- **Actions** (verbs): `createUser`, `deletePost`, `sendEmail`
- **Transformers** (adjectives): `formatted`, `validated`, `normalized`
- **Predicates** (questions): `isEmpty`, `hasAccess`, `isValid`
- Reject generic verbs; they're code smells. `process` → `normalizeInput`, `handle` → `routeRequest`

**Constants**: Distinguish between true constants and configuration.
- **True constants** (SCREAMING_SNAKE_CASE): `MAX_RETRIES`, `API_TIMEOUT`, `DEFAULT_PAGE_SIZE`
- **Config values** (camelCase): `apiKey`, `dbUrl`, `featureFlag` — these can change per environment
- Only scream when the value is truly fixed across all contexts

### Testing Philosophy
- **Behavior-driven testing**: Test behavior, not implementation details or coverage percentages. Integration tests for APIs; unit tests for pure functions only. 
- **Coverage metrics rejected**: 100% coverage with bad tests worse than 60% with good edge case coverage. Coverage percentage is vanity metric. Focus on testing actual behavior gaps and edge cases.
- **Mocking discipline**: Mock only external dependencies (APIs, databases in unit context). Never mock your own code—that tests implementation, not behavior. Integration tests use real test databases to verify actual queries work.
- **Load tests separated from CI**: Run before production and after major changes. Load testing not in every commit (too slow). Performance testing is separate pipeline.
- **Readability over micro-optimization**: Prioritizes code clarity over performance micro-gains. async/await everywhere for consistency, not callbacks despite nanosecond differences. Only optimize when profiling proves bottleneck, never on principle.
- **Safety-first refactoring**: Capture current behavior with integration tests before refactoring legacy code. Use tests as safety net. Strangler fig pattern for large replacements—incremental substitution, not big rewrites.

### Observability & Monitoring
- **Layered observability approach**: Start with structured logs (Pino chosen for speed/minimalism). Add Prometheus metrics when dashboards needed. Add traces when debugging distributed calls. Adopt each layer when current problems demand visibility.
- **Metrics discipline**: Focus on RED metrics (Rate, Errors, Duration). Only collect metrics that answer specific current questions. Reject comprehensive/speculative metrics—too much noise, too little signal.
- **Structured logging**: JSON logging by default (Pino). Includes correlation IDs for tracing requests through system. Enables observability without expensive distributed tracing infrastructure until scale demands it.

### Code Review Philosophy
- **Active rejection of premature abstraction**: Rejects middleware abstractions before 10+ routes, logging extractions before scale, repository patterns for 2 tables, caching before response times prove necessary, Redis before horizontal scaling, library complexity before problem exists (CASL for 3 roles). Reviews serve as gatekeeper against feature creep and over-engineering.
- **Clarity enforcement**: Reviews enforce clarity-over-cleverness discipline. Rejects nested ternaries, excessive destructuring, implicit patterns. Code must be readable—this is non-negotiable in review process.
- **Library adoption discipline**: Rejects libraries solving speculative problems. Examples: CASL (for current RBAC needs), moment.js (deprecated), null-checking utilities (native features exist). Philosophy: adopt tools only for problems you have now, not problems you might have later. Preferred pattern: use native language features and standard library first.
- **Consistency over bikeshedding**: Focus on logic errors, security issues, unclear code. Don't argue about naming or style—that's what linters and formatters are for. Automation handles consistency; human review focuses on design and correctness.
- **Velocity-focused**: "Ship fast, fix forward." Prioritize getting code deployed over achieving hypothetical perfection. Fix issues incrementally as they appear rather than planning refactor sprints.
- **Measurement-driven decisions**: Questions every architectural escalation with data. "Add it when response times are actually a problem." "YAGNI until then."
- **Noise elimination**: Removes comments that merely repeat function signatures. Comments added only for non-obvious behavior or design decisions.
- **Language precision**: Uses semantically correct terminology (JavaScript "errors" not Java "exceptions"). Maintains clarity in naming and conceptual terminology.

### Security as First-Class Concern
- **Authentication storage**: Uses httpOnly cookies for JWT tokens, never client-side storage (localStorage/sessionStorage). XSS risk too high to trust client-side.
- **Security headers with understanding**: Uses Helmet.js but doesn't blindly copy defaults. Customizes each header to match actual application needs (e.g., CSP for actual resources loaded). Understand tools before using them.
- **Error tracking**: Implements correlation IDs to trace errors through system without exposing implementation details to external parties.
- **Information boundaries**: Strict separation between what's visible in dev vs. production. Avoids leaking internals. Minimal production images (no dev dependencies).
- **Configuration validation**: Uses Zod for environment variable validation at startup. Fails fast with clear errors—don't let app start in bad state.

### API Design Patterns
- **REST naming conventions**: Plural resources (/users, /posts, /comments) for clarity and collection semantics. Exception: /me for current user context. Conventional over clever.
- **API versioning**: Uses URL path (/v1/) for clarity and cacheability. Rejects header versioning as implicit and client-hostile.
- **Health checks**: Two endpoints for different concerns—/health (always 200, for load balancers), /health/deep (checks DB, for monitoring). Separate concerns explicitly.
- **REST-first**: Implements REST endpoints for small API surface. GraphQL rejected at 5 endpoints ("Solve problems you have, not problems you imagine").

### Tooling Preferences
- **Pragmatic native tool selection**: Chooses tools that are native to current ecosystem/platform (GitHub Actions for GitHub-hosted projects) and sufficient for current scale. Integrates cleanly without adding operational overhead.
- **Native features prioritized**: Prefer language and platform features over custom abstractions. Examples: optional chaining/nullish coalescing over null utilities, native Intl over bloated libraries, TypeScript types over runtime validation abstractions.
- **Bundle-aware selection**: Tree-shaking and bundle size matter in tool selection. date-fns chosen over dayjs for tree-shaking capability. Moment.js rejected as huge and deprecated.
- **Logging**: Pino chosen for speed and minimalism (JSON by default, minimal API). Winston rejected as bloated. Scales with structured logging.
- **Code formatting**: Biome (unified ESLint+Prettier replacement). Tabs for accessibility, single quotes for consistency. All style enforcement delegated to tools—linter rules replace prose documentation.
- **Email templates**: Template literals for small count (≤2), plan to migrate to React Email at 10+ templates. Avoids premature tool adoption.
- **Validation**: Zod for runtime + compile-time alignment across full stack.
- **Database migrations**: Plain SQL files with simple runner. Direct versioning of DDL; migration tools add unnecessary magic.
- **Documentation generation**: Auto-generate from schemas (Zod to OpenAPI). Code/schemas are source of truth; derived docs stay in sync. Prevents manual documentation drift.
- **CI/CD**: GitHub Actions (native integration, good enough). Sufficient for current needs without managing external CI services.
- **Infrastructure**: Fly.io or Railway for deployment. Simpler platforms preferred over Kubernetes until team size and independent scaling requirements justify K8s operational complexity.

#### Automation-First Standardization

**Philosophy**: Never manually enforce what tools can automate.
- Style guides converted to linter/formatter rules (linter errors have force that documentation doesn't)
- Import organization, code formatting, naming patterns—all delegated to tooling
- Manual style enforcement is cognitive waste; human review focuses on logic, design, security
- Questions presented to tool maintainers get converted to explicit configuration rules
- Reduces friction and mental overhead; team doesn't argue about what tools can enforce

### DevOps & Operations
- **Immutable artifacts**: Separate build and deploy stages. Build artifact should be immutable—same binary promoted to staging and production. Ensures reproducibility and auditability.
- **Production image minimalism**: Multi-stage Docker builds. No dev dependencies in production artifacts. Production images should be minimal.
- **Performance testing pipeline**: Separate from CI. Run before production and after major changes. Load tests not in every commit (too slow).
- **Config validation**: All required configuration validated with Zod on startup. Explicit errors prevent silent configuration failures.

### Git & Development Workflow
- **Trunk-based development**: Main branch always deployable. Short-lived feature branches merge directly to main. Rejects unnecessary branch ceremony (develop branch, GitFlow) that adds process overhead without safety benefit.
- **Incremental improvement over rewrites**: Strangler fig pattern for legacy code—tests first, replace piece by piece. Incremental refactoring safer and more effective than big rewrites. High-risk rewrites fail.

### Technical Debt & Refactoring
- **Opportunistic debt reduction**: Fix technical debt while in files working on features, not in dedicated refactor sprints. TODOs for small issues, GitHub issues for larger items. Continuous improvement beats planned cleanup phases.
- **Conscious abstraction learning**: Personal pattern: make the same mistake three times before extracting. Lesson internalized: "write it three times, then extract." Avoids abstracting before requirements converge. Active reflection on past mistakes informs current discipline.
- **DRY pragmatism**: Duplication is cheaper than the wrong abstraction. Rule of three: write it the same way three times before extracting. Extract boilerplate only when proven (transaction helper for begin/commit/rollback). Validates that similar code truly converges in requirements before consolidating.

### Team Standards & Organization
- **Automation-first standardization**: Automate everything tools can enforce (style, types, formatting, naming patterns). Discussions reserved for design patterns and approach. Never argue about things linters and formatters can handle. Reduces friction and cognitive load.
- **Selective tool adoption**: "Never use tools to check boxes." Libraries and frameworks solve specific problems you have now. Avoid complexity you don't need yet. Tools justified by current evidence, not hypothetical future needs.

### Key Decision Pattern
Consistently asks "Do I actually need this yet?" and "Do I have data supporting this?" before adopting patterns, tools, or abstractions. Defers architectural decisions until concrete complexity justifies them. Measures performance before optimizing. Scales incrementally rather than speculating about future needs. Chooses obvious, explicit approaches over clever/hidden ones when tradeoffs are equivalent. Every architectural choice, tool adoption, and coding pattern is justified by current evidence, not future speculation.

**Distinctive meta-pattern**: 
- Accept forward-thinking complexity *selectively* and deliberately—specifically when migration cost is high and proven (cursor pagination regret). 
- Reject speculative infrastructure and tools consistently—feature flags, event buses, microservices, comprehensive metrics, complex platforms. 
- Prefer native language features over custom abstractions. 
- Understand tools before using them. 
- Conscious about learning from past mistakes; applies "rule of three" deliberately to avoid premature abstraction.
- Most importantly: **simplicity is a feature, not a constraint.** Code should be readable above all; every line carries cost. The goal is solving problems, not writing code.

**Evolution marker**: Q1 showed measurable code simplification (rare outcome). Philosophy has evolved from tactical preferences (tabs, early returns, feature-based files) to strategic principle (every line is a liability, best code is code not written). This represents maturation from "how to do things" to "why we do things this way." The approach produces increasingly clean, minimal codebases because the underlying philosophy rejects unnecessary code systematically. Validated by real-world outcome: v1.0.0 shipped in 3 months, clean code + comprehensive tests + simple architecture.
```


### Philosophy Specialist (philosophy)

**Purpose:** Understand the developer's core beliefs about software engineering - what they value, what they avoid, and why

```
## Core Software Engineering Philosophy

### Primary Value System: Pragmatic Incrementalism with Measurable Thresholds

The developer operates from **scale-appropriate decision-making** — rejecting upfront architecture, premature abstraction, and over-engineering through systematic evaluation. This manifests across all layers with concrete, numeric triggers:

**Concrete Adoption Thresholds:**
- 10+ routes → extract middleware patterns
- 2+ tables → implement repository patterns  
- 2 email templates → template literals; 10+ → React Email
- 3rd code duplication → extract shared logic (not before)
- 5+ API endpoints reject GraphQL; GraphQL appropriate at scale not yet reached
- Scaling horizontally → switch to Redis; single instance → in-memory suffices
- Multiple webhook consumers or delivery guarantees needed → event bus (RabbitMQ); HTTP webhooks suffice initially
- Team grows beyond single-service coordination need → microservices; monolith first
- Feature flags only when team size/deployment coordination problems emerge; direct communication sufficient at 3-4 people
- 3+ roles requiring complex permission logic → consider ABAC; 3 roles → RBAC sufficient
- Observability: Pino (structured logs) → Prometheus metrics (dashboard needs) → Distributed traces (cross-service debugging)
- Infrastructure: GitHub Actions sufficient; Fly.io/Railway until infra team exists; Kubernetes deferred until operational overhead justified

**Framework/Architecture Philosophy**: Minimal tools (Express over NestJS, raw SQL over ORMs, template literals before engines, functions before classes, plain SQL migrations over Prisma/Knex, DI function injection over containers like tsyringe, HTTP webhooks before event buses, monolith before microservices, RBAC before ABAC, date-fns over legacy date libraries). Justification: don't pay costs for problems you haven't encountered yet. "Libraries solve problems, not check boxes." Willing to adopt next layer when numeric threshold triggers—this is systematic pragmatism, not dogmatism.

**Code Organization**: Organizes by feature (users, auth, posts) not by layer (routes, handlers, models). "When I work on users, I want all user code together." Structure evolves as patterns genuinely emerge. Shared code only extracted when truly reusable across features; avoids "shared" junk drawers. Explicitly rejects "enterprise cosplay" — patterns that exceed problem size.

### Secondary Principles

**Type Safety is Non-Negotiable and Multi-Layered**
- Strict TypeScript applied immediately
- Zod for runtime validation unified with compile-time safety, including environment configuration
- Result types instead of exceptions to encode failure in return signatures
- "Throw feels like goto" — rejects implicit control flow
- Type assertions ("as") actively avoided; config-driven prevention: noUncheckedIndexedAccess enforced to prevent array access bugs
- **Use types over interfaces for data shapes; reserve interfaces for contracts and declaration merging** — prefer simpler tools
- TypeScript used not just as type checker, but as design tool: if types are hard, it signals design problem to fix, not escape hatch to use
- **Prefer TypeScript native features over utility wrappers**: optional chaining, nullish coalescing, and proper typing eliminate need for utility functions that duplicate language capabilities
- undefined for absence of value, null for intentional empty; in practice: avoid both through proper typing and leverage TypeScript features

**Explicit, Transparent Code Over Clever Abstractions**
- Favors explicit return types, consistent naming conventions, and clear communication through code
- Direct query functions without magical translation layers
- Plain SQL migration files with simple runner; version exact DDL, reject ORM/migration framework magic
- Signal over noise: rejects redundant comments ("getUserById gets a user by ID" wastes cognition)
- Language precision: corrects Java jargon ("exceptions") to JS idiom ("errors")
- Similarity ≠ identity: prevents false abstractions from contextually-different code
- **Code is source of truth**: Generate documentation (OpenAPI) from schemas, not manually. Schema changes automatically update documentation. Reduces drift.
- **Prefer native language features over library solutions**: language has a feature, use it; don't abstract over built-ins
- **Minimize instrumentation in code**: Use only what you need, where you need it. Excessive upfront setup (over-destructuring, premature variable extraction) hides actual usage and adds cognitive load.

**Naming Conventions as Primary Communication Tool**
- Names are the primary mechanism for explicit code; good names eliminate need for comments
- Variable/function names must explain **what**, not **how**
- Generic verbs are code smells: "process", "handle", "data" hide intent. Replace with specific verbs (createUser, normalizeInput, routeRequest) and nouns (userProfile, apiResponse)
- Boolean variables use is/has/can/should prefixes to eliminate ambiguity (isActive, hasPermission, canEdit) except for obvious booleans (visible, enabled)
- Function naming follows semantic pattern: verbs for actions (createUser, deletePost), adjectives for transformers (formatted, validated), questions for predicates (isEmpty, hasAccess)
- Constants use SCREAMING_SNAKE_CASE only for true immutable constants (MAX_RETRIES, API_TIMEOUT); config values use regular camelCase since they can change
- If a name requires a comment to explain, the name is wrong—rename it
- Comments should explain **why**, not **what**; code should be self-documenting

**Control Flow for Readability**
- Early returns and guard clauses at top of functions; happy path at bottom
- Deeply nested if/else is unreadable—flatten with early returns
- Reject unnecessary else blocks after guard clauses; implicit case is clear
- Ternary operators only for single-line, simple conditionals (condition ? valueA : valueB); use if/else for multi-line logic or complex values
- **Nested ternaries actively rejected as unreadable**

**Code Minimalism as Feature** (newly articulated principle)
- **Every line of code is a liability**, not an asset. The goal isn't to write code, but to solve problems.
- Best solution is often not writing code at all
- Minimize what code expresses: use only what you need, where you need it
- Avoid over-instrumentation: excessive destructuring upfront hides actual usage; destructure only at point of use
- Deep destructuring is a code smell—signals flattened data structures needed
- Applies to all code: fewer variables, fewer intermediate assignments, clearer control flow
- Connects to pragmatic incrementalism: don't write code for imagined future complexity

**Data Mutation Philosophy**
- **Immutable-by-default**: Spread operator ({ ...obj, newProp }) for shallow object copies
- Object.assign avoided (implies mutation mindset, less readable)
- Immutability as default prevents entire class of bugs; mutation only when explicitly justified

**Boring Over Sophisticated**
- Chosen repeatedly: Pino (minimal, fast) over Winston (bloated); URL path versioning (/v1/) over header versioning (clever but client-unfriendly); template literals over template engines at small scale; async/await over callbacks (even for nanosecond gains); tree-shakeable libraries (date-fns) over bloated legacy libraries (moment.js)
- **Cursor-based pagination from start**: Avoid offset pagination's real-time data breaks and scale problems even at low volume; migration cost is high later, so start correct. Retrospective regret confirms: retrofitting pagination is painful
- **HTTP webhooks for event delivery**: Simpler, debuggable, no infrastructure complexity. Move to event bus (RabbitMQ) only when multiple independent consumers or guaranteed delivery requirements emerge
- Consolidation: Biome migration shows willingness to adopt unified tooling when clear speed/simplicity wins exist
- Readability prioritized over micro-optimizations; consistency valued over cleverness
- Cares about performance and accessibility: tabs for accessibility, considers cacheability in API versioning, bundle-aware (tree-shaking matters)

**Relational/Constrained Thinking**
- Prefers Postgres (known schema, ACID, relational) over schemaless alternatives
- Explicit constraints as design principle rather than runtime flexibility
- **Soft deletes only for legal/compliance requirements or data with restoration guarantees** (e.g., user accounts with legal holds). Hard delete for temporary resources (sessions) and non-regulated data. Adds complexity only when business requirement justifies it.
- One convention instead of context-switching

### Operational Thinking as First-Class Concern

Not embedded as afterthought, but integrated from inception. Production requirements shape code design from the start:

**Performance & Scaling:**
- Proactively measures with load testing (k6); separate performance pipeline (not in CI per-commit)
- Premature optimization actively rejected: "We're not at scale where this matters. Add it when response times are actually a problem. Premature caching creates invalidation bugs."
- Only adopts performance infrastructure when actual bottleneck proven
- Bundle-aware: tree-shaking and selective imports matter; legacy bloated libraries rejected on measurable impact

**Observability & Debugging (Staged Adoption):**
- **Structured logging first**: Pino for all structured logs, provides consistent debugging foundation
- **Metrics second**: Prometheus metrics added when dashboards needed. Focuses on RED method (Rate, Errors, Duration); avoids metric bloat. "Add others when we have specific questions to answer."
- **Traces third**: Distributed tracing when debugging cross-service calls becomes necessary
- Health check endpoints with clear separation: /health (load balancer, always 200) vs /health/deep (monitoring, checks DB)
- Production-aware error differentiation: full stack traces in dev; error codes in prod
- Correlation IDs for debugging traces
- **Debuggability prioritized in architecture choices**: HTTP webhooks chosen over opaque queues; cursor pagination chosen over offset (failure modes clear); generated docs ensure single source of truth
- Fail-fast philosophy: config validation at startup; don't let app start in bad state

**Security:**
- Security headers (CORS, CSP, HSTS) applied deliberately, not cargo-culted; each header understood and customized to actual resource loading needs (e.g., custom CSP not default)
- httpOnly cookies (rejects naive client storage)
- Never leaks internals to users
- Infrastructure-level thinking: multi-stage Docker builds with production image minimalism

**Deployment & Configuration:**
- Environment config validated with Zod at startup
- Missing required config → clear error message, app refuses to start
- Infrastructure concerns (Docker optimization, health checks) treated as core code concerns
- **Immutable build artifacts**: Same compiled artifact deployed to staging and production; build and deploy stages separated to ensure integrity
- **Continuous deployment model**: Trunk-based development with short-lived feature branches; main is always deployable; GitFlow ceremony rejected as unnecessary overhead

### Testing Philosophy (Behavioral Over Implementation)

**Test Approach:**
- **Integration tests use real resources**: Use actual test database (Docker-managed), never mock database; mocking defeats testing actual queries
- **Never mock own code**: Mocking your own code tests implementation details, not behavior. Only mock external dependencies (third-party APIs, services not under your control)
- **Coverage is vanity**: Reject coverage metrics as goals. 100% coverage with bad tests is worse than 60% with good tests. Focus: behavioral assertions over line coverage
- **Test edge cases, not trivial paths**: Remove getter tests and trivial coverage-chasing tests; add tests for edge cases and failure modes
- **Test database setup** infrastructure treated as seriously as production infrastructure—proper Docker-compose test setups ensure integration testing validity

### Refactoring & Code Maintenance Philosophy

**Incremental improvement over large rewrites:**
- **Strangle fig pattern for legacy code**: Add tests first to capture current behavior, then replace piece by piece. Big rewrites fail; incremental improvement wins
- **Fix-in-context debt management**: TODO comments for small issues; Issues for bigger refactorings. Most importantly: fix technical debt when in the file, don't plan formal debt cleanup sprints
- **Abstraction maturity principle**: "Write it three times, then extract." Rejects upfront generalization; repetition proves pattern genuinely exists before extraction justified
- **Test-safe refactoring**: Integration tests with real resources provide behavioral safety net for refactoring; enables confident improvement without regression risk
- **Trajectory view of codebase health**: Code should get simpler over time as team learns the problem space. Celebrates iterative simplification (refactoring toward clarity, standardized naming, flattened control flow) as major achievement

### Infrastructure & Tooling Philosophy

**Choose appropriate scale, avoid over-engineering:**
- **CI/CD**: GitHub Actions sufficient for current team size (native integration, no additional service overhead)
- **Deployment platform**: Fly.io or Railway appropriate for small teams; Kubernetes deferred until dedicated infrastructure team exists (operational overhead unjustified)
- **Tool selection pattern**: Understand each tool's tradeoffs before adoption; use tools deliberately, not by default. Helmet.js understood per-header, GitHub Actions chosen with explicit reasoning, Fly.io chosen with maturity argument
- **Deprecation awareness**: Actively rejects deprecated or legacy libraries; moment.js rejected in favor of modern alternatives

**Consolidation when beneficial:**
- Unified tooling wins (ESLint+Prettier → Biome) adopted when clear efficiency gains exist

**Automated Standards Enforcement Over Human Discipline:**
- Convert any manually-decidable question into tool enforcement
- Style guide prose → Biome rules (linter errors can't be ignored; docs can)
- Import sorting → automated by tool, not manual discipline
- TypeScript config prevents bad patterns (noUncheckedIndexedAccess prevents array bugs)
- Principle: "Never manually do what tools can automate"
- Don't expect humans to enforce standards—make bad patterns impossible through tooling

### Code Review & Team Standards

**Efficient review with focus on high-value feedback:**
- Reviews target logic errors, security issues, and code clarity
- Style bikeshedding avoided; linters are authoritative for style decisions
- "Ship fast, fix forward" — velocity prioritized alongside correctness
- **Automation eliminates tool-decidable questions**: Linters for style, TypeScript for correctness, discussions for design trade-offs
- Never argue about things a tool can check
- Team code quality improves through incremental refactoring and standardization, not large rewrite initiatives

### Decision-Making Pattern

Evaluates through **scale-appropriate lens** with measurable triggers. Each tool/pattern assessed against *current* problem size, not ideal architecture. Explicitly rejects solving imagined future problems ("GraphQL premature at 5 endpoints"; "Redis unnecessary until horizontal scaling needed"; "LaunchDarkly premature at 3 engineers"; "microservices solve distribution problems, not complexity problems"; "K8s operational overhead doesn't justify adoption at small scale"; "CASL is overkill for 3 roles"; "ABAC adds complexity we don't need").

**Scale-gated adoption follows clear progression:**
- 1-3 developers → monolith, direct communication, no feature flags, no event buses, HTTP webhooks, GitHub Actions, Pino only, simple RBAC
- ~10 engineers → microservices if service boundaries needed; feature flags for coordination; Prometheus metrics; consider distributed traces
- Multiple independent webhook consumers → event bus
- Dedicated infrastructure team → Kubernetes

When conditions change and numeric thresholds hit, adoption of next complexity layer is systematic and clear. Willing to pre-adopt when migration cost would be prohibitively high later (cursor pagination, OpenAPI generation from schemas).

### Validation and Proof Through Delivery

- **Proven approach**: v1.0 from zero to production in 3 months with clean code, comprehensive tests, simple architecture validates entire philosophy
- **Shipping as validation**: "Ship beats planning" — philosophy proven through successful delivery
- **Speed and quality coexist**: Fast iteration enabled by simplicity, not hindered by it. Simple code ships faster and accumulates less debt.

This is not dogmatism—it's principled pragmatism grounded in:
1. Concrete scale metrics (not guesses)
2. Rejection of unnecessary friction
3. Preference for predictability over cleverness
4. **Code minimalism**: Every line is a liability; solve problems, not imagined complexity
5. **Observability and debuggability as first-class design concerns** — architecture choices evaluated on transparency
6. Integration of operational concerns (security, debugging, performance, observability) into code decisions from the start
7. **Explicit transparency as protection against hidden bugs** — achieved through clear naming, readable control flow, and self-documenting code
8. **Behavioral testing as quality guarantee** — test actual behavior over implementation; use real dependencies in integration tests
9. **Deliberate tooling adoption** — understand each tool's tradeoffs, avoid cargo-culting defaults, customize to actual needs
10. **Automated standards enforcement** — make bad patterns impossible through tools, don't rely on human discipline
11. **Incremental improvement mindset** — write-thrice-then-extract principle, strangle fig pattern for legacy, fix-in-context debt management, trajectory view of codebase health
12. **Immutable-by-default data patterns** — spread operator for shallow copies, avoid mutation-implying patterns

### Developer Experience & Tooling

- Tabs chosen for accessibility (not spaces)
- Single quotes for consistency
- Consolidates tools when consolidation is faster (ESLint+Prettier → Biome)
- Values developer experience and operational visibility alongside code correctness
- Actively configures TypeScript and linters to make bad patterns impossible rather than relying on discipline
- Adopts tools that reduce manual overhead when they clearly win (Zod-to-OpenAPI for schema-driven docs)
- Feature-based code organization reduces context-switching and improves developer velocity ("when I work on users, I want all user code together")
- Bundle-aware: prefers tree-shakeable libraries and understands import tradeoffs
- Continuous deployment model reduces ceremony and enables faster feedback
- Names are first-class citizens in code quality: good names replace comments, communicate intent, reduce cognitive load
- Minimizes code instrumentation: destructure only what's needed, at point of use; over-setup hides actual usage patterns
```


### Code Style Specialist (style)

**Purpose:** Track coding style patterns - naming conventions, formatting preferences, structural choices, and code organization

```
CODING STYLE & PHILOSOPHY PROFILE — EXTENDED WITH DESTRUCTURING & IMMUTABILITY SPECIFICS

═══════════════════════════════════════════════════════════════════════════

CORE PRINCIPLES (Reinforced & Expanded):

**1. Pragmatic Minimalism** — Confirmed and retrospectively validated
   - Complexity deferred until business problem proven
   - Library adoption criterion: "solve a problem, not check a box"
   - Applied to code volume: "Every line of code is a liability. The goal isn't to write code, it's to solve problems."
   - Retrospective validation: 0-to-production in 3 months with clean code, comprehensive tests, simple architecture
   - Simplicity is a feature, not a byproduct

**2. Explicit Over Implicit** — Extended with destructuring and immutability specifics
   - Code review focus: automated tools handle stylistic checks; human review focuses on logic, security, clarity
   - Naming as explicit communication: "Names should explain what, not how."
   - Native language features preferred: spread over Object.assign; optional chaining over custom utilities
   - **NEW: Destructuring minimalism** — "Only destructure what you need, where you need it"
   - **NEW: Deep destructuring is a code smell** — Indicates flat data structure not being leveraged
   - Data structure clarity: destructuring at point of use, not at function start

**3. Production-First Operability** — Confirmed with retrospective validation
   - Forward-compatible choices validate over time; incremental improvements accumulate
   - Team observation: "Code is simpler than when we started. That's rare - usually codebases only grow complex."
   - v1.0 milestone reached: validation that pragmatic approach scales

**4. Code as Single Source of Truth** — Confirmed with living documentation
   - Auto-generated OpenAPI from Zod schemas
   - Documentation updated in parallel with architecture
   - Versioned plain SQL migrations

**5. Developer Ergonomics as First-Class Design Criterion** — Extended with destructuring clarity
   - Feature-based organization reduces context switching
   - Automation removes mental burden
   - Destructuring clarity: point-of-use over upfront declaration improves local readability
   - Naming clarity as ergonomic priority

═══════════════════════════════════════════════════════════════════════════

NAMING CONVENTIONS (COMPREHENSIVE):

[Unchanged from previous understanding — comprehensive section retained]

═══════════════════════════════════════════════════════════════════════════

CONTROL FLOW CONVENTIONS (Confirmed):

**Guard Clauses & Early Returns:**
- Preferred: Guard clauses at function top, happy path at bottom
- Anti-pattern: Deeply nested if/else blocks; clever code
- Philosophy: Fail-fast, return early; reduces cognitive load

**Else Blocks:**
- Rejected after early returns
- Pattern: Guard clauses eliminate need for explicit else in many cases

**Ternary Operators:**
- Constraint: Single line, simple values only
- Anti-pattern: Nested ternaries → "Clever code is not good code"
- Rule: If ternary requires multiple lines, convert to if/else or early returns for readability

═══════════════════════════════════════════════════════════════════════════

DESTRUCTURING & DATA HANDLING CONVENTIONS (NEW):

**Destructuring Rules:**
- Minimalist extraction: "Only destructure what you need, where you need it"
- Point of use: Destructure at the location where values are needed, not at function start
- Scope management: Destructuring defines scope; destructuring everything upfront loses clarity on what's actually used
- Anti-pattern: Destructuring 12 fields when only 3 are needed (code smell of unclear intent)
- Code smell indicator: Deep destructuring signals flat data structure not being properly leveraged

**Spread Operator & Immutability:**
- Spread for shallow copies: `{ ...defaults, ...overrides }`
- Use case: Creating new objects with selective property overrides
- Immutability by default: Spread preferred for creating modified copies
- Object.assign only for in-place mutations (which are avoided anyway)
- Philosophy: Immutability-first approach enables predictable code flow

**Object Merging Pattern:**
- `{ ...defaults, ...overrides }` preferred over Object.assign for clarity and immutability
- Result is identical; readability and intent are superior
- Aligns with immutability-first philosophy

═══════════════════════════════════════════════════════════════════════════

AUTOMATION & ENFORCEMENT:

**Linter-Owned Decisions (Biome):**
- Import sorting, formatting, style consistency
- Code-level style checks
- Philosophy: "Never argue about things a tool can check"

**Code Review Focus:**
- Logic errors and correctness
- Security issues
- Clarity and intent (not style)
- Design patterns and architectural decisions
- Destructuring clarity and data handling patterns
- Control flow readability
- Velocity prioritized: style gatekeeping removed for checkable items

**Naming Standards via Review:**
- Naming conventions actively enforced
- Destructuring patterns validated: point-of-use, minimal extraction
- Control flow readability enforced: reject clever code, require guard clauses and early returns

═══════════════════════════════════════════════════════════════════════════

TEAM PRACTICES & WORKFLOW (Confirmed):

**Git & Branching:**
- Trunk-based development with short-lived branches
- Main always deployable: continuous deployment
- Incremental refactoring: clean up in regular commits (evt_144: "clean up excessive destructuring")

**Code Review Standards:**
- Focus: logic, security, clarity, data handling patterns
- Delegate: style/formatting to linters
- Velocity through gatekeeping removal; style gatekeeping removed

**Refactoring & Legacy Code:**
- Write code three times before abstracting pattern
- Early abstraction is primary mistake
- Strangle fig approach: tests first, then refactor incrementally

**Technical Debt Management:**
- TODO comments for small fixes
- GitHub issues for larger debt items
- Fix debt during regular work, not planned sprints

═══════════════════════════════════════════════════════════════════════════

LIBRARY & TOOLING ADOPTION CRITERIA:

[Unchanged from previous understanding]

═══════════════════════════════════════════════════════════════════════════

RECURRING PATTERNS (CONFIDENCE LEVELS):

1. **"Libraries Solve Problems, Not Check Boxes"** (0.98)

2. **Explicit Naming Conventions with Pragmatic Escape Hatches** (0.98)

3. **Automation-First Enforcement of Checkable Style** (0.97)

4. **Code Review as Delegation of Checkable Work** (0.97)

5. **Controlled Control Flow with Guard Clauses** (0.96)
   - Nested ternaries rejected as "clever code not good code"

6. **Destructuring Minimalism** (0.96) — NEW PATTERN
   - "Only destructure what you need, where you need it"
   - Point-of-use destructuring preferred
   - Deep destructuring is a code smell
   - Repeated enforcement across code reviews and philosophy conversations

7. **Immutability-First Data Handling** (0.95) — NEW PATTERN
   - Spread operator preferred for shallow copies
   - Object.assign only for avoided mutations
   - Pattern: `{ ...obj, newProp }` for creating modified copies
   - Philosophy: immutability enables predictability

8. **The "Three-Time Rule" for Abstraction** (0.96)

9. **Incremental Improvement Over Big-Bang** (0.95)

10. **Simplicity as Feature and Liability Minimization** (0.98) — ELEVATED
    - "Simplicity is a feature"
    - "Every line of code is a liability"
    - "Best code is code you don't write"
    - "Sometimes the best solution is not writing code at all"
    - Validated by v1.0 success: 0-to-production in 3 months, clean code, comprehensive tests, simple architecture
    - Philosophy becomes core identity: goal is solving problems, not writing code

11. **Pragmatism Over Orthodoxy** (0.95)

═══════════════════════════════════════════════════════════════════════════

METHODOLOGICAL STANCE:

- **Pragmatism over orthodoxy**: All patterns subordinate to real need
- **Explicit communication**: Naming clarity and destructuring clarity as vehicles for code understanding
- **Empirical over theoretical**: Measure real constraints; let patterns emerge from practice
- **Automation removes decision burden**: Tool enforcement prevents style arguments
- **Ship fast, fix forward**: Velocity through gatekeeping removal
- **Understanding required**: Tool adoption, conventions, style choices require comprehension
- **Incremental > big-bang**: Patterns emerge from practice
- **Developer-centric**: Clarity, automation burden removal, organized workflow prioritize velocity and understanding
- **Simplicity-first**: Every line of code is a liability; solve problems, don't write code

═══════════════════════════════════════════════════════════════════════════

EVOLUTION & MILESTONE:

Team reached v1.0 production deployment in 3 months (March 31, 2024). Retrospective philosophy solidifies core identity: simplicity is the goal, code is a necessary evil, and the best solutions avoid unnecessary code entirely. Code review on release validates entire approach: "Clean code, comprehensive tests, simple architecture. This is how software should be built."

Evolution shows meta-awareness: philosophy stated, systematically applied through enforcement, and validated through real-world shipping success. Philosophy-first approach compounds—every decision traces back to pragmatic minimalism and clarity.

══════════════════════════════════════════════════════════════════════════════
```


### Tooling Specialist (tooling)

**Purpose:** Understand tool preferences - libraries, frameworks, testing tools, linters, and development environment choices

```
TOOL PREFERENCES & PHILOSOPHY (UPDATED - Q1 RETROSPECTIVE)

**Core Philosophy Refined:**

**Simplicity as a Feature, Code as Liability**
Every line of code is a cost, not an asset. The goal isn't to write code; it's to solve problems. The best code is code you don't write. This principle applies at all levels: architectural (no premature abstraction), functional (only destruct what you use), and stylistic (explicit over clever). Shipping beats planning. The proof: 0 to production in 3 months with clean code, comprehensive tests, and simple architecture.

**Explicit Over Clever (Granular Enforcement)**
Anti-cleverness extends from architecture down to individual variable and expression level:
- **Destructuring:** Only destructure what you need, where you need it. Destructuring 12 fields to use 3 is a smell—increases cognitive load without benefit
- **Spread vs Object.assign:** Use spread for shallow copies ({ ...obj, newProp }). Object.assign only for in-place mutation (which is avoided anyway). Spread is clearer, same result, immutable
- **Ternaries:** Single line, simple values only. Nested ternaries are unreadable; convert to if/else or early returns. Clever code is not good code
- **Control flow:** Early returns always, deeply nested if/else rejected, deeply nested destructuring rejected
- **General principle:** Clever code and complex patterns are liabilities. Readable code that clearly expresses intent is the goal. Names must be self-documenting at every level (variables, functions, constants, booleans)

**Code Organization & Clarity:**
- Functions preferred over classes when no state encapsulation needed
- Rejects design patterns applied prematurely (repository pattern for 2 tables = "enterprise cosplay")
- Clarity through explicit naming is central and comprehensive. Names must communicate intent immediately:
  - **Variable naming:** Specific over generic (userProfile > data, apiResponse > res). Names explain what they are, not what they do. Exception: obvious booleans like 'visible', 'enabled' don't need prefixes
  - **Boolean naming:** is/has/can/should prefixes required (isActive, hasAccess, canDelete, shouldRetry). Exception for truly obvious contexts
  - **Function naming:** Verbs for actions (createUser, deletePost), adjectives for transformers (formatted, validated), questions for predicates (isEmpty, hasAccess). Generic verbs (process, handle) are code smells and rejected
  - **Constant naming:** SCREAMING_SNAKE_CASE only for true immutable constants (MAX_RETRIES, API_TIMEOUT). Config values use regular camelCase
- Comments: Reject redundant comments. Add only for non-obvious behavior and context. Names should be clear enough to need minimal explanation
- Middleware/utilities: Extracted only when pattern emerges (10+ routes), not preemptively
- Code duplication: Duplication is cheaper than wrong abstraction; wait until pattern converges (3 occurrences) before extracting
- Shared code governance: Truly shared code across features moves to lib/. Code used by 2 features stays with one and is imported. Avoids accumulation of "shared" junk
- **Variable-level over-engineering principle:** The same anti-abstraction principle that governs architecture governs variable assignment. Only take what you need. Don't destructure for convenience if you use 3 of 12 fields

**Framework & Architecture:**
- Frameworks: Express (minimal, explicit) preferred over NestJS (overengineered)
- Database: Postgres with raw SQL; rejects ORMs until complexity warrants
- ORM stance: No abstraction layer for simple schemas; views magic as liability
- Architecture approach: Flat structure with emergent patterns; opposes upfront design and premature abstraction
- API versioning: URL path (/v1/) preferred for clarity
- Dependency Injection: No DI containers; pass dependencies as function arguments
- Resource naming: Plural for REST resources (/users, /posts, /comments); /me for current user context

**Type & Safety:**
- TypeScript strict mode enforced
- Validation: Zod (TypeScript-first, single source of truth)
- Config validation: Zod-validated at startup; fails fast with clear errors
- Error handling: Result types with errors in return signatures; exceptions rejected (throw as goto); environment-aware responses
- Type assertions: Almost never use 'as' except test mocks; if needed, fix types instead
- Type safety is non-negotiable and fundamental to design
- Types for data shapes and DTOs; interfaces only for contracts requiring implementation or declaration merging

**Testing & Performance:**
- Integration tests prioritized for APIs; unit tests only for pure functions
- Philosophy: Implementation detail testing is wasteful
- Mocking strategy: Mock external dependencies only. Never mock own code
- Code coverage: Coverage is vanity metric. Focus on testing behavior, not lines
- Performance testing: Load tests with k6; separate performance pipeline (not CI for every commit)
- Optimization approach: Measure before optimizing; readability over micro-optimizations

**Tooling & Libraries:**
- Logging: Pino (fast, JSON by default, minimal API)
- Linting/Formatting: Biome (consolidated ESLint+Prettier replacement)
- Code style: Tabs for accessibility, single quotes for consistency
- Email templating: Template literals for small scale; React Email for 10+ templates
- Authentication: JWT with httpOnly cookies (security-first, prevents XSS)
- Database migrations: Plain SQL files with simple runner; exact DDL versioned
- Async patterns: async/await everywhere; promises when composing
- Documentation generation: @asteasolutions/zod-to-openapi for auto-generating OpenAPI specs
- Security headers: Helmet.js with custom configuration understanding each header
- **Automation principle:** Never waste developer attention on mechanical tasks. Tools enforce what documentation cannot

**Observability & Metrics:**
- Progressive observability: Structured logs (Pino JSON) → Metrics (Prometheus) → Distributed traces
- Metrics philosophy: Focus on RED (Rate, Errors, Duration)
- Metric strategy: Measure what matters, avoid premature observability complexity

**API Design:**
- Pagination: Cursor-based preferred; avoids offset degradation at scale
- Data preservation: Soft deletes for compliance/legal; hard delete for temporary resources

**CI/CD & Deployment:**
- CI/CD platform: GitHub Actions
- Build/deploy separation: Immutable artifacts; build once, test once, deploy multiple times
- Deployment platform: Fly.io or Railway for small applications; Kubernetes deferred until operational overhead justified

**Operations & Infrastructure:**
- Health checks: Two-tier design (/health for load balancers, /health/deep for monitoring)
- Rate limiting: In-memory for single instance; Redis when scaling horizontally
- Caching: Only add when response times demonstrably a problem
- Docker: Multi-stage builds; minimal production images
- Environment variables: Validated at startup with Zod
- Feature flags: Infrastructure debt at small scale; environment config sufficient
- Event-driven patterns: HTTP webhooks first; event bus only when multiple consumers
- Microservices: Monolith first; microservices justified by team boundaries or differential scaling

**Security First:**
- JWT tokens in httpOnly cookies, never client-side (XSS prevention)
- Error messages differ by environment: dev full traces, prod codes + correlation IDs
- Responses sanitized to prevent internal implementation disclosure
- Security tooling understood before applied

**Problem-Driven Development:**
- Ship, then improve. Solves problems you have, not problems you imagine
- Scale infrastructure only when hitting friction at current scale
- Measure before adding observability tools
- Understand rationale before adopting security tooling
- Challenge convention: Questions industry standards (coverage metrics, comprehensive instrumentation) and understands why before adoption

**Retrospective Achievement:**
Main patterns: Simplicity over cleverness. Types over tests (both matter; types catch more). Explicit over implicit. Native over library when possible. Code simpler than starting point (rare achievement for codebases). Pragmatic minimalism works: shipped clean, comprehensive architecture in 3 months.

```


## Governance State

| Learner | Status | Activation | Retrieval Count |
|---------|--------|------------|-----------------|
| Generic Developer Memory | active | 0.769 | 0 |
| Philosophy Specialist | active | 0.781 | 0 |
| Code Style Specialist | active | 0.783 | 0 |
| Tooling Specialist | active | 0.736 | 0 |

## Analysis

### Generic vs Specialist Comparison

<!-- Compare how the generic learner performed vs specialists on domain-specific questions -->

#### Questions where Specialists Outperformed Generic:

-

#### Questions where Generic Matched or Beat Specialists:

-

### Key Observations

#### Strengths

-

#### Weaknesses

-

#### Recommendations

-

## Errors

**Total Errors:** 1

| Learner | Operation | Context | Error |
|---------|-----------|---------|-------|
| tooling | data | Batch 6... | The operation timed out.... |

### Error Details


#### Error 1: [tooling] data

- **Context:** Batch 6
- **Timestamp:** 2026-01-28T18:05:10.031Z
- **Error:** `The operation timed out.`


