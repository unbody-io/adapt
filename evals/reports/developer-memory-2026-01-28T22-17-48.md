# TextLearner Eval Report: Personal Development Memory

**Generated:** 2026-01-28T22:17:48.119Z
**Dataset:** developer-memory.json

## Parameters

| Parameter | Value |
|-----------|-------|
| Model | `anthropic/claude-opus-4.5` |
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
| Total Duration | 2785.5s |
| Total Tokens | 1,365,526 |
| Avg Tokens/Event | 9104 |

### Per-Learner Comparison

| Learner | Data Tokens | Query Tokens | Total Tokens | Avg Relevance | Activation |
|---------|-------------|--------------|--------------|---------------|------------|
| Generic Developer Memory | 188,784 | 130,385 | 319,169 | 0.85 | 0.692 |
| Philosophy Specialist | 223,665 | 137,297 | 360,962 | 0.84 | 0.682 |
| Code Style Specialist | 209,742 | 137,150 | 346,892 | 0.86 | 0.700 |
| Tooling Specialist | 207,743 | 130,760 | 338,503 | 0.83 | 0.655 |

## Query Comparison

Each query was run against ALL learners. Compare responses to see if specialists outperform the generic learner on their domain.


### 1. What is my coding philosophy?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 16,992 |
| Philosophy Specialist | 🔴 low | Yes | 17,606 |
| Code Style Specialist | 🔴 low | Yes | 17,909 |
| Tooling Specialist | 🔴 low | Yes | 16,991 |


**[generic] Generic Developer Memory:**
> Your coding philosophy centers on **pragmatic simplicity** with a strong bias toward action. Here are the core tenets:

**1. "Earn your abstractions"** — Start simple, add structure only when patterns emerge organically. You treat premature abstraction as seriously as premature optimization. You're skeptical of "enterprise cosplay" — applying heavyweight patterns to small projects.

**2. "Obvious over clever"** — You consistently prefer straightforward solutions. URL versioning over headers ("clients hate clever"), REST over GraphQL at small scale, template literals over engines for 2 templates. Solve problems you have, not problems you imagine.

**3. "Understand what you use"** — Never cargo-cult defaults. If you can't explain why something is configured a certain way, you don't understand it well enough.

**4. "Duplication > wrong abstraction"** — Wait for the third occurrence before extracting. Similar code isn't identical code. You've learned personally that the urge to "do it right" leads to early abstraction that breaks when requirements change.

**5. "Fail fast"** — Validate configuration at startup. Don't let apps start in bad state. Strict typing catches errors at compile time.

**6. "Prove the bottleneck"** — Readability beats micro-performance. Don't optimize until you measure an actual problem. Premature caching creates invalidation bugs.

**7. "Scale to your reality"** — Infrastructure should match team/project scale, not aspirational architecture. Monolith until team boundaries require service boundaries. Never add complexity for "good architecture" alone.

**8. "Native over library"** — Prefer language/platform features over libraries. Libraries must justify their complexity.

**9. "Incremental over big-bang"** — Big rewrites fail; incremental improvement wins. Strangler fig pattern over rewrites. Shipping beats planning.

**10. "Less code is better code"** — Every line of code is a liability. The goal isn't to write code, it's to solve problems. Sometimes the best solution is not writing code at all. Simplicity is a feature.

**11. "Automate style, debate design"** — Style guides belong in linter rules, not prose. Reserve human discussion for architecture and design patterns.

**12. "Types over tests"** — Both matter, but types catch more. Types are the first line of defense.

The overarching theme: **pragmatism over dogma, simplicity over sophistication, solving real problems over imagined ones.**



**[philosophy] Philosophy Specialist:**
> Your coding philosophy centers on a core principle: **"Start simple, extract when patterns emerge."** You believe premature abstraction is just as harmful as premature optimization, and that codebases should get simpler over time—not more complex.

Here are the pillars of your philosophy:

**1. Minimalism & Earned Complexity** — You reject over-engineering. Express over NestJS, REST over GraphQL, raw SQL over ORMs. You mock unnecessary patterns as "enterprise cosplay." Structure should be earned through concrete need—"write the thing three times, then extract."

**2. Explicitness Over Magic** — You want to see what's happening. Result types over thrown exceptions ("throw feels like goto"), plain SQL migrations you can read and version, functions over classes. Failure modes should be visible in type signatures.

**3. Type Safety as Non-Negotiable Foundation** — Strict TypeScript with all the flags. Zod as the single source of truth. "Types catch bugs, tests verify behavior."

**4. Obvious Over Clever** — "Clever code is not good code." You prioritize consumer experience over technical elegance.

**5. Pragmatic Incrementalism** — Simple options now with known upgrade paths. Exception: cursor pagination from day one because "retrofitting was painful."

**6. Fail Fast, Fail Loud** — Config validated at startup, problems surface early. Never let the app start in a bad state.

**7. Monolith First** — "Microservices solve distribution problems, not complexity problems." Architecture driven by actual problems, not ideals.

**Meta-Goal**: "Every line of code is a liability." The goal isn't to write code—it's to solve problems. Simplicity is a feature.

*Gaps: I don't have insight into how these beliefs evolved over time or what experiences shaped them; I don't know if there are situations where you've deviated from these principles and why; I lack understanding of how you prioritize these principles when they conflict with each other*


**[style] Code Style Specialist:**
> Your coding philosophy centers on **radical simplicity and pragmatism**. Here are the core tenets:

## Primary Principles

1. **"Start minimal, extract when proven"** — You apply YAGNI aggressively to architecture, not just features. You view premature abstraction as equivalent to premature optimization, calling unnecessary patterns "enterprise cosplay."

2. **"Obvious over clever"** — You prioritize clarity and convention over cleverness. If something is elegant but confusing to users (like header versioning), you reject it.

3. **"Every line is a liability"** — The goal isn't to write code, it's to solve problems. Sometimes the best solution is not writing code at all. "Simplicity is a feature."

4. **"Types over tests"** — Both matter, but types catch more. TypeScript strict mode is your primary defense, tests are secondary validation.

5. **"No magic"** — You want to see exactly what happens. Plain SQL over migration tools, function arguments over DI containers, explicit over implicit.

6. **"Proof before optimization"** — Performance complexity requires evidence. "Profile and prove it's a bottleneck." Readability beats nanoseconds.

7. **"Native over libraries"** — Prefer built-in language features over utility libraries. Optional chaining over null-check helpers, native Intl over moment.js.

8. **"Code as source of truth"** — Never maintain parallel artifacts. Types derive from Zod schemas, OpenAPI generates from schemas. "Manual docs drift from reality."

## Underlying Values (Priority Order)

1. **Simplicity** — Ship, then improve. Codebases should get simpler over time.
2. **Types first** — Primary defense mechanism, more valuable than tests
3. **Explicitness** — Behavior visible in code/types, not hidden in conventions
4. **Incrementalism** — Add complexity when proven necessary; change incrementally not all-at-once
5. **Pragmatism** — Right-size solutions to current problems
6. **Automation** — Tools check what tools can check; humans discuss design

## Self-Awareness

You're refreshingly self-aware about your tendencies: *"I want to 'do it right' so I abstract early. Then requirements change and abstraction doesn't fit."* This self-knowledge drives your discipline toward simplicity.

In essence, your philosophy is: **solve the problem you have, not the problem you imagine, with the minimum viable complexity.**

*Gaps: How this philosophy evolved over time or what experiences shaped it; Whether there are domains or project types where you'd relax these principles; How you balance these principles when they conflict with team preferences or existing codebases*


**[tooling] Tooling Specialist:**
> Your coding philosophy centers on **simplicity, pragmatism, and minimalism**. Here are the core principles I've observed:

## Core Mantras
- **"Simplicity over cleverness"** - Clear, readable code beats clever solutions
- **"Types over tests (but both matter)"** - Types catch more issues at compile-time
- **"Explicit over implicit"** - No magic, no hidden behavior
- **"Native over library when possible"** - Use language features before reaching for dependencies
- **"Ship, then improve"** - Get working software out, iterate incrementally

## Key Principles

**1. Start Simple, Extract When Patterns Emerge**
- "Duplication is cheaper than the wrong abstraction"
- Rule of 3: Wait until you see something three times before extracting
- "Solve problems you have, not problems you imagine"

**2. Fail Fast**
- Catch problems at compile-time or startup, not runtime
- Validate configuration on startup
- Enable strict compiler checks (TypeScript strict mode is non-negotiable)

**3. Code as Source of Truth**
- Generate artifacts (docs, types, OpenAPI specs) from code
- Never manually maintain documentation that can drift from reality

**4. Understand Before Adopting**
- Don't blindly copy defaults or add everything available
- Understand each tool and config choice
- Customize to actual needs

**5. Incremental Over Big-Bang**
- Small continuous improvements beat large planned changes
- "Big rewrites fail. Incremental improvement wins."
- Fix technical debt when you're in the file, not in cleanup sprints
- Strangler fig pattern for legacy code

**6. Minimalism at Every Level**
- "Every line of code is a liability"
- "The best code is code you don't write"
- "The goal isn't to write code, it's to solve problems"
- "Simple code lives longer"

## Anti-Patterns You Avoid
- Premature abstraction and over-engineering
- Exceptions as control flow (prefer Result types)
- Magic and implicit behavior
- Adding complexity before it's needed (microservices, DI containers, event buses)
- Manual processes that tools can automate

*Gaps: No data on how these principles evolved or what experiences shaped them; Limited insight into how you prioritize when principles conflict with each other; No information on philosophical influences (books, mentors, communities) that shaped this thinking*


---

### 2. What are my naming conventions?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 15,862 |
| Philosophy Specialist | 🔴 low | Yes | 16,800 |
| Code Style Specialist | 🔴 low | Yes | 17,203 |
| Tooling Specialist | 🔴 low | Yes | 15,926 |


**[generic] Generic Developer Memory:**
> Your naming conventions are well-documented and follow these principles:

**Core Philosophy:**
- Names explain **what**, not how. If you need a comment to explain a name, the name is wrong.
- **Specific over generic**: Use 'userProfile' not 'data', 'apiResponse' not 'res'. Generic names like 'data', 'handle', 'process' are considered code smells.

**Booleans:**
- Use `is/has/can/should` prefix: 'isActive' not 'active'
- Exception: Obvious booleans like 'visible', 'enabled' don't need the prefix

**Functions:**
- **Verbs** for actions: `createUser`, `deletePost`
- **Adjectives** for transformers: `formatted`, `validated`
- **Questions** for predicates: `isEmpty`, `hasAccess`

**Constants:**
- `SCREAMING_SNAKE_CASE` only for true constants: `MAX_RETRIES`, `API_TIMEOUT`
- Regular `camelCase` for config values that could change

**General Style:**
- `camelCase` everywhere with no translation layers
- Language-idiomatic naming: "errors" not "exceptions" in JavaScript
- Use `type` for data shapes (DTOs, responses), `interface` only for class contracts or declaration merging — in practice, `type` for almost everything

**API Resources:**
- Plural resource names: `/users`, `/posts`, `/comments`
- Exception: `/me` for current user

*Gaps: No documented conventions for class names (though classes are rarely used - functions preferred); No explicit conventions for file/folder naming beyond feature-based organization; No conventions for database column/table naming (snake_case vs camelCase); No conventions for environment variable naming*


**[philosophy] Philosophy Specialist:**
> Based on my understanding, you have clear and well-defined naming conventions:

**General Principles:**
- **Names explain "what", not "how"**: Prefer `filteredUsers` over `loopResult`
- **Specific over generic**: Use `userProfile` over `data`, `apiResponse` over `res`. Generic names are code smells
- **Single convention everywhere**: camelCase, language-idiomatic terminology (e.g., "errors" not "exceptions" in JavaScript)

**Booleans:**
- Use `is/has/can/should` prefixes: `isActive` not `active`
- Exception: Obvious booleans like `visible` or `enabled` don't need prefixes

**Functions by purpose:**
- **Actions**: Use verbs — `createUser`, `deletePost`
- **Transformers**: Use adjectives — `formatted`, `validated`
- **Predicates**: Use questions — `isEmpty`, `hasAccess`
- **Avoid generic verbs**: `process`, `handle` are code smells — rename to specific actions like `normalizeInput`, `routeRequest`

**Constants:**
- **SCREAMING_SNAKE_CASE** only for true constants (`MAX_RETRIES`, `API_TIMEOUT`)
- Config values use **camelCase**

**REST Resources:**
- Plural nouns: `/users`, `/posts`
- Exception: `/me` for current user

This philosophy aligns with your broader value of **explicitness over magic** — names should communicate intent immediately without requiring the reader to dig into implementation details.

*Gaps: No specific conventions documented for class names (though classes are rarely used); No specific conventions for file naming (e.g., kebab-case vs camelCase for files); No specific conventions for type/interface names beyond the 'type over interface' preference; No conventions for test file or test function naming*


**[style] Code Style Specialist:**
> Based on my understanding, here are your naming conventions:

**Core Principle**: Names explain *what*, not *how*. If a comment is needed to explain a name, the name is wrong.

**General Casing**:
- **camelCase everywhere** — including API responses
- **SCREAMING_SNAKE_CASE** — only for true constants (e.g., `MAX_RETRIES`, `API_TIMEOUT`). Config values stay camelCase.

**Specificity Over Generics**:
- ✓ Prefer: `userProfile`, `apiResponse`, `normalizeInput`
- ✗ Avoid: `data`, `res`, `process`, `handle` — generic names are code smells

**Booleans**: Always use is/has/can/should prefix
- ✓ `isActive` not `active`
- Exception: obvious booleans like `visible`, `enabled`

**Functions by Purpose**:
- **Actions**: verb — `createUser`, `deletePost`, `routeRequest`
- **Transformers**: adjective — `formatted`, `validated`, `normalized`
- **Predicates**: question — `isEmpty`, `hasAccess`, `canEdit`

**JavaScript Idioms**: Use JS conventions over other languages
- ✓ `handleError` (JS idiom)
- ✗ `handleException` (Java idiom)

**API Resources**:
- Plural resource names: `/users`, `/posts`
- Exception: `/me` for current user

**Git Commits**: Conventional commits format
- `feat:`, `chore:`, `refactor:`, `test:`
- Lowercase, concise

**Comments Philosophy**: Only for non-obvious behavior. No noise comments. If you can't name something clearly, it's doing too much.

*Gaps: No explicit conventions for class naming (PascalCase assumed but not documented); No conventions for private/internal identifiers (underscore prefix or not); No conventions for type/interface naming beyond preferring 'type' over 'interface'; No conventions for file naming (kebab-case vs camelCase for files); No conventions for enum naming or enum member casing; No conventions for test file naming patterns*


**[tooling] Tooling Specialist:**
> Based on my understanding, here are your naming conventions:

**General Principles**
- **Names explain "what", not "how"**: 'filteredUsers' is good, 'loopResult' is bad. If a name needs a comment, it's wrong
- **Specific over generic**: Avoid generic names like 'data' or 'res' — use 'userProfile' or 'apiResponse' instead. Generic names are code smells

**Case Conventions**
- **camelCase everywhere**: No translation layers between API and code
- **SCREAMING_SNAKE_CASE**: Only for true constants (MAX_RETRIES, API_TIMEOUT). Config values that could change use camelCase

**Boolean Naming**
- Always use prefixes: `is`, `has`, `can`, `should`
- 'active' is ambiguous, 'isActive' is clear
- Exceptions for obvious cases: 'visible', 'enabled'

**Function Naming**
- **Verbs for actions**: createUser, deletePost
- **Adjectives for transformers**: formatted, validated
- **Questions for predicates**: isEmpty, hasAccess
- Avoid generic verbs like 'process' or 'handle' — these are code smells

**API Resource Naming**
- **Plural resource names**: /users, /posts, /comments
- Exception: /me for current user

*Gaps: No explicit conventions for class naming (though classes are rarely used per your OOP preference); No explicit conventions for file/folder naming beyond feature-based organization; No explicit conventions for type/interface naming (e.g., prefix with I or T); No explicit conventions for event/handler naming patterns*


---

### 3. How do I handle errors?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 16,767 |
| Philosophy Specialist | 🔴 low | Yes | 17,349 |
| Code Style Specialist | 🔴 low | Yes | 16,786 |
| Tooling Specialist | 🔴 low | Yes | 17,105 |


**[generic] Generic Developer Memory:**
> Based on the development philosophy, error handling follows several key principles:

**1. Result Types Over Throw/Catch**
The preferred approach is to use Result types (like `{ success: true, data: T } | { success: false, error: E }`) rather than throwing exceptions. This makes errors explicit in return types rather than hidden control flow. When errors are part of the type signature, callers are forced to handle them.

**2. Errors Explicit in Return Types**
Errors should be visible in function signatures, not hidden as exceptions that can bubble up unexpectedly. This aligns with the "types over tests" philosophy — let the type system enforce error handling at compile time.

**3. Environment-Aware Error Responses**
- **Development:** Full stack traces for debugging
- **Production:** Correlation IDs for debugging without leaking internal details
- **Never leak internals to users** — error messages should be user-friendly externally while detailed internally

**4. Fail Fast at Startup**
For configuration errors specifically, validate at startup using Zod. If required config is missing, fail immediately with a clear error rather than letting the app start in a bad state. Don't let misconfigurations surface as runtime errors later.

**5. Naming Convention**
Use language-idiomatic terminology: "errors" not "exceptions" in JavaScript/TypeScript.

**Example Pattern:**
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function createUser(data: UserInput): Promise<Result<User, ValidationError | DatabaseError>> {
  // Early return for validation failures
  const validated = userSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: new ValidationError(validated.error) };
  }
  
  // Happy path
  const user = await db.insert(validated.data);
  return { success: true, data: user };
}
```

This approach makes error handling explicit, type-safe, and forces callers to handle both success and failure cases.

*Gaps: Specific Result type library preferences (e.g., neverthrow, ts-results, or custom implementation); How to handle errors that cross async boundaries or in streaming scenarios; Error logging strategy details (what to log, when, structured format); HTTP error response format preferences (Problem Details RFC 7807, custom format); Error boundary patterns for frontend applications; Retry strategies for transient errors*


**[philosophy] Philosophy Specialist:**
> Based on the developer's philosophy, error handling follows a clear pattern centered on **explicitness over magic**:

## Preferred Approach: Result Types Over Throw

The developer explicitly states **"throw feels like goto"** — exceptions create hidden control flow that makes code harder to reason about. Instead, they prefer **Result types** that make failure modes visible in type signatures.

```typescript
// Preferred: Result type pattern
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseUser(data: unknown): Result<User, ValidationError> {
  // validation logic
  if (!valid) {
    return { ok: false, error: new ValidationError('...') };
  }
  return { ok: true, value: user };
}

// Caller is forced to handle both cases
const result = parseUser(input);
if (!result.ok) {
  // handle error explicitly
  return;
}
// result.value is now typed as User
```

## Key Principles:

1. **Failure modes visible in type signatures** — The caller knows immediately that a function can fail and what errors to expect.

2. **Fail fast, fail loud** — Problems should surface early and explicitly:
   - Config validated at startup with Zod — don't let the app start in a bad state
   - Validate inputs at boundaries

3. **Environment-aware error exposure**:
   - **Development**: Full stack traces for debugging
   - **Production**: Error codes + correlation IDs only — never leak internals to users

4. **Zod for runtime validation** — Use Zod as the single source of truth for validation, which naturally produces structured errors rather than thrown exceptions.

## What They Avoid:
- Hidden control flow (exceptions bubbling up through call stacks)
- try/catch scattered throughout the codebase
- Errors that can be silently swallowed
- Leaking internal error details to end users

*Gaps: Specific Result type implementation details (custom vs library like neverthrow/fp-ts); How to handle errors from external libraries that throw (integration boundary handling); Specific error logging preferences and structured error formats; How Result types compose in async contexts; Express/HTTP error handling middleware patterns preferred*


**[style] Code Style Specialist:**
> Based on my understanding of the coding style patterns, error handling follows a clear philosophy:

**Result Types Over Exceptions**
The primary approach is to use Result types (return values) rather than thrown exceptions. Failures should be represented in return types, not thrown. This aligns with the "types first" and "explicitness" values — errors become visible in the type signature rather than hidden in potential throw paths.

**Specific Patterns:**
1. **Use a Result pattern** — likely something like `lib/result.ts` in shared code that returns `{ success: true, data: T } | { success: false, error: E }` style types
2. **Avoid 'as' assertions** — fix the types properly rather than asserting away potential error states
3. **TypeScript strict mode** catches many error conditions at compile time (`strictNullChecks`, `noUncheckedIndexedAccess`)

**Error Responses (API Context):**
- **Development**: Full stack traces for debugging
- **Production**: Error codes + correlation IDs only (security stance — don't leak internals)

**Naming Convention:**
Use JS idioms like `handleError`, not `handleException`

**Validation:**
Use Zod for validation at boundaries — fail fast with meaningful errors. Config should be validated at startup with immediate failure on missing required values.

**What NOT to do:**
- Don't use callbacks for error handling (async/await everywhere)
- Don't throw exceptions for expected failure paths — encode them in types
- Don't expose stack traces in production

*Gaps: No specific code examples of the Result type implementation (lib/result.ts mentioned but not detailed); No guidance on how to handle truly exceptional/unexpected errors (panics, unrecoverable states); No specific error logging patterns or how errors integrate with Pino logging; No guidance on error boundaries or global error handlers in Express; No specific error type taxonomy or categorization approach; No guidance on retry patterns for transient errors*


**[tooling] Tooling Specialist:**
> Based on my understanding, error handling follows a clear philosophy centered on **Result types over exceptions**:

## Core Approach: Result Types
- **Throw is "like goto"** - exceptions are avoided as a flow control mechanism
- Use **Result types** that make errors explicit in return types
- Errors should be part of the function signature, not hidden surprises

## Key Principles:

### 1. Fail-Fast Philosophy
- Catch problems at **compile-time or startup**, not runtime
- Validate configuration on startup - fail immediately with clear error if something's wrong
- Enable strict TypeScript compiler checks to catch issues early

### 2. Error Handling Patterns
- **Early returns always**: Guard clauses at top, happy path at bottom
- **No redundant else**: After `if (invalid) return error`, the next line is implicitly the valid case
- **Explicit returns**: Make error states visible in the return type

### 3. Error Exposure (Security)
- **Dev environment**: Full stack traces for debugging
- **Production**: Error codes + correlation IDs only - "Never leak internals to users"

### 4. Terminology
- Use "errors" not "exceptions" (avoids Java-isms)

### 5. Type Safety
- Avoid type assertions (`as`) - fix the types instead of asserting around problems
- Use Zod for runtime validation that generates proper TypeScript types

## Example Pattern:
```typescript
// Result type approach
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseUser(data: unknown): Result<User, ValidationError> {
  if (!isValid) {
    return { ok: false, error: new ValidationError('...') };
  }
  return { ok: true, value: user };
}

// Caller handles explicitly
const result = parseUser(data);
if (!result.ok) {
  return result.error; // compiler enforces handling
}
// result.value is now typed as User
```

This makes error handling explicit, type-safe, and forces callers to handle failure cases.

*Gaps: No specific Result type library preference mentioned (e.g., neverthrow, fp-ts, or custom implementation); No details on how to handle errors in async/Promise contexts with Result types; No specific pattern for Express error middleware or API error responses; Unclear how Result types interact with Zod validation errors specifically; No guidance on error logging patterns with Pino for different error types*


---

### 4. What testing practices do I follow?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 16,139 |
| Philosophy Specialist | 🔴 low | Yes | 16,927 |
| Code Style Specialist | 🔴 low | Yes | 16,690 |
| Tooling Specialist | 🔴 low | Yes | 16,037 |


**[generic] Generic Developer Memory:**
> Based on my understanding, you follow these testing practices:

**Test Types & Focus:**
- **Integration tests for APIs** — Test behavior, not implementation. This is your primary testing approach for APIs.
- **Unit tests only for pure functions** — Reserved for isolated, deterministic logic.
- **Load tests** — Run before production and after major changes, in a separate pipeline (not regular CI). Tool of choice: k6.

**Core Testing Principles:**

1. **"Coverage is vanity"** — You focus on testing behavior, not hitting line counts. You believe 100% coverage with bad tests is worse than 60% with good ones. You advocate removing trivial getter tests and adding edge case tests instead.

2. **"Mock what you don't own"** — Mock external APIs and third-party services, but never mock your own code. Mocking your own code tests implementation, not behavior.

3. **"Reject testing implementation details"** — Tests should verify what code does, not how it does it.

4. **Use real test databases** — For integration tests, you use a real database via Docker Compose setup rather than mocking the database layer.

5. **"Tests before refactoring"** — When touching legacy code, add integration tests first to capture current behavior. This creates a safety net for changes.

**Type-Test Balance:**
- **"Types over tests"** — Both matter, but types catch more. Types are your first line of defense; tests verify behavior that types can't express.

**What You Avoid:**
- Testing implementation details
- Chasing coverage metrics as a goal
- Mocking your own code
- Running load tests in regular CI (they belong in a separate pipeline)

*Gaps: Specific test framework preferences (Jest, Vitest, etc.) are not mentioned in my understanding; Test file organization and naming conventions are not specified; Specific patterns for test data setup/teardown (factories, fixtures, etc.); Snapshot testing stance is not documented; E2E/browser testing practices and tools are not covered; Contract testing or API testing between services is not addressed; Test parallelization or CI optimization strategies for tests*


**[philosophy] Philosophy Specialist:**
> Based on my understanding, you follow these testing practices:

**Core Philosophy: Types Over Tests**
You believe both types and tests matter, but types catch more bugs earlier. "Types catch bugs, tests verify behavior." Types are your first line of defense, which means you don't over-rely on tests to catch what static analysis should handle.

**Test Strategy by Layer**
- **Integration tests for APIs** — these are your primary tests for verifying behavior
- **Unit tests only for pure functions** — not for everything, just logic that's isolated and transformational
- **Load tests before production and major changes** — but in a separate pipeline, not on every CI run

**Database Testing**
- **Real test database via Docker Compose** — you reject mocking the database in integration tests because "mocking DB in integration tests defeats the purpose"

**Mocking Philosophy**
- **Mock what you don't own** (external APIs, third-party services)
- **Never mock your own code** — that tests implementation, not behavior

**Coverage Stance**
- **Coverage is a vanity metric**: "100% coverage with bad tests is worse than 60% with good ones"
- Focus on behavior and edge cases, not hitting percentage targets

**Testing and Refactoring**
- **Tests before refactoring** — add integration tests to capture current behavior before rewriting legacy code
- This creates a safety net using the strangler fig pattern

**Type Assertions in Tests**
- Type assertions (`as`) are almost never acceptable, with one exception: **intentionally partial test mocks** where you're explicitly creating incomplete objects for testing purposes

*Gaps: Specific testing frameworks or libraries preferred (e.g., Jest, Vitest, Supertest); Test file organization and naming conventions; How test data/fixtures are managed; Specific patterns for writing integration tests (setup/teardown approaches); Whether snapshot testing is used or avoided; E2E testing preferences (Playwright, Cypress, or avoided); Contract testing practices for APIs; How tests are organized relative to source code (co-located vs separate test folder)*


**[style] Code Style Specialist:**
> Based on my understanding, you follow a pragmatic, behavior-focused testing approach with these key practices:

**Core Philosophy**: "Coverage is vanity" — you test behavior, not lines. You believe types catch more bugs than tests, making TypeScript strict mode your primary defense and tests a secondary validation.

**Test Types by Purpose**:
- **Integration tests** for APIs using a real test database (via docker-compose) — this is your primary testing approach
- **Unit tests** only for pure functions — not for everything
- **Load tests** before production, run in a separate pipeline

**Mocking Rules**: "Mock what you don't own"
- ✓ Mock: External APIs, third-party services
- ✗ Never mock: Your own code, or the database in integration tests

**Testing in Context of Refactoring**:
- When working with legacy code, you add integration tests first to capture current behavior before making changes
- "Big rewrites fail" — you use tests as a safety net for incremental strangler fig pattern refactoring

**What You Reject**:
- Coverage targets as a goal
- Full rewrites without test safety nets
- Mocking your own code

**Relationship to Types**:
You view this as "Types over tests" — both matter, but types are your first line of defense. TypeScript strict mode (`strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) catches many issues that would otherwise require tests.

*Gaps: Specific testing framework preferences (Jest, Vitest, etc.) are not documented; Test file organization conventions (co-located vs separate test directory) are not specified; Naming conventions for test files and test cases are not captured; Preferred assertion styles or patterns are not documented; E2E/browser testing approach (if any) is not mentioned; Snapshot testing stance is not recorded*


**[tooling] Tooling Specialist:**
> Based on my understanding, you follow these testing practices:

**Primary Testing Strategy:**
- **Integration tests for APIs** are your primary testing approach
- **Unit tests only for pure functions** - you don't over-test implementation details

**Core Philosophy:**
- **"Coverage is vanity"** - You focus on behavior, not lines of code. You believe 60% coverage with good tests beats 100% coverage with bad ones
- Remove trivial "getter tests" and add edge cases instead
- Avoid testing implementation details

**Mocking Rules:**
- **Mock what you don't own** (external APIs)
- **Never mock your own code**
- Use a **real test database** (via docker-compose) for integration tests - "mocking DB defeats the purpose"

**Load Testing:**
- Use **k6** for load testing
- Run load tests before production and after major changes
- Keep performance testing in a separate pipeline, not CI for every commit

**Refactoring Safety:**
- **Tests before refactoring**: Add integration tests to capture current behavior before refactoring legacy code
- "Safety net first" - tests enable confident changes

**Broader Context:**
Your testing philosophy aligns with your general principle of "types over tests (both matter, types catch more)" - you rely heavily on TypeScript's strict type checking to catch errors at compile time, with tests serving as a complementary layer focused on behavior verification rather than exhaustive coverage.

*Gaps: Specific test framework preference (Jest, Vitest, etc.) is not documented; Test file organization and naming conventions are not specified; E2E testing preferences (Playwright, Cypress, etc.) are not mentioned; Contract testing approach for APIs is not documented; Snapshot testing stance is not known; Test data management strategies (factories, fixtures, seeding) are not detailed; CI test parallelization preferences are not specified*


---

### 5. Do I prefer OOP or functional?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 15,947 |
| Philosophy Specialist | 🔴 low | Yes | 15,997 |
| Code Style Specialist | 🔴 low | Yes | 16,925 |
| Tooling Specialist | 🔴 low | Yes | 15,415 |


**[generic] Generic Developer Memory:**
> You lean strongly toward **functional programming**, but pragmatically rather than dogmatically.

**Functional signals:**
- "Functions over classes" — classes only for encapsulating state
- Immutability by default (spread operators, avoid mutation)
- Unit tests reserved for pure functions
- `type` over `interface` for data shapes (modeling data, not class hierarchies)
- Dependency passing via function arguments, not DI containers (composition over injection)
- Naming conventions for transformers and predicates (functional patterns)
- Result types over throw/catch (errors as values, not control flow)

**Pragmatic OOP use:**
You'll use classes when genuinely encapsulating state, and `interface` for class contracts. You don't reject OOP—you reject OOP ceremony (inheritance hierarchies, DI containers, "enterprise" patterns) when functions suffice.

**Bottom line:** Functional by default, OOP when the problem demands stateful encapsulation. You avoid paradigm dogma in favor of "obvious over clever."

*Gaps: No explicit examples of when you've chosen classes for stateful encapsulation; No stated opinion on functional libraries (fp-ts, Ramda) vs vanilla functional style; No explicit mention of inheritance — do you ever use it, or avoid it entirely?; No examples of Result types in practice (mentioned as preferred, but no implementation details)*


**[philosophy] Philosophy Specialist:**
> You prefer **functional programming by default**, with OOP reserved for specific use cases.

Your stated principle is: **"Functional by default, OOP only when state requires it."**

Specifically, you favor:
- **Functions over classes** — you only reach for classes when you need encapsulated state
- **Immutability by default** — using spread operators for copies (`{ ...obj, newProp }`), avoiding mutation
- **Pure functions** — you explicitly mention unit tests are "only for pure functions"
- **async/await and Promises** for async work, never callbacks

You avoid:
- **Classes without encapsulated state** — listed explicitly in your "What They Avoid" section
- OOP patterns that add ceremony without value

The key nuance is that you're not dogmatically anti-OOP. You recognize classes have a place when managing state, but your default mode of thinking and coding is functional. This aligns with your broader philosophy of starting simple and only adding structure (like classes) when there's a concrete need.

*Gaps: No specific examples of when you've used classes for encapsulated state; No insight into your experience with functional patterns like composition, currying, or higher-order functions beyond basic usage; Unclear how you feel about functional libraries like Ramda or fp-ts*


**[style] Code Style Specialist:**
> Based on your coding patterns, you lean **strongly functional** in practice, though you're pragmatic rather than dogmatic about it.

**Evidence of functional preference:**

1. **Immutability by default** - You prefer spread operators for shallow copies (`{ ...obj, newProp }`) and merging (`{ ...defaults, ...overrides }`). You avoid mutation.

2. **Result types over exceptions** - Instead of throwing and catching (an OOP pattern), you return failures in return types. This is a core functional pattern.

3. **Pure functions emphasized** - You explicitly state unit tests are "only for pure functions," indicating you value and write them.

4. **`type` over `interface`** - You prefer TypeScript `type` for almost everything, reserving `interface` only for declaration merging or class contracts. This suggests you rarely use classes.

5. **Function arguments over DI containers** - You reject dependency injection containers ("No magic"), preferring explicit function parameters—a functional composition approach.

6. **Data transformation naming** - Your naming includes "transformers" (`formatted`, `validated`, `normalized`), suggesting a data-pipeline mental model.

7. **No class-based patterns mentioned** - Your entire understanding mentions no design patterns (factories, singletons), no inheritance hierarchies, no `this` binding concerns.

**The pragmatic nuance:**
You're not ideologically functional. Your philosophy is "obvious over clever"—you'd use a class if it made code clearer, but your defaults and instincts are functional.

*Gaps: No explicit statement about OOP vs functional preference - this is inferred from patterns; No examples of actual class usage or avoidance in your codebase; Unknown whether you use functional libraries (fp-ts, ramda, etc.); No data on how you handle stateful logic when it's necessary; Unknown stance on functional patterns like currying, partial application, or monads*


**[tooling] Tooling Specialist:**
> You strongly prefer **functional programming over OOP**. This is explicitly stated in your code style preferences: "Functions > classes (classes only for encapsulated state)."

Your functional leanings are evident across multiple aspects of your approach:

1. **Result types over exceptions** - You prefer returning errors as values rather than throwing, describing throw as "like goto" - a classic functional pattern

2. **Immutability by default** - You avoid mutation when possible, a core functional principle

3. **Pure functions for testing** - Unit tests are reserved for pure functions specifically

4. **No DI containers** - You prefer passing dependencies as function arguments rather than using dependency injection frameworks, which is the functional approach to dependency management

5. **Anti-class patterns** - You reject "service classes without state" and the repository pattern, which are OOP staples

6. **Composition over inheritance** - Your preference for feature-based organization and explicit dependencies suggests composition-first thinking

The **only exception** you allow for classes is when you need encapsulated state - meaning classes are a tool of last resort for specific use cases, not a default organizational pattern.

*Gaps: No specific examples of when 'encapsulated state' justifies using a class; No information about preferences for functional libraries (like fp-ts, ramda, etc.); No explicit stance on functional concepts like currying, partial application, or monads*


---

### 6. What are my thoughts on abstractions?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 15,929 |
| Philosophy Specialist | 🔴 low | Yes | 17,930 |
| Code Style Specialist | 🔴 low | Yes | 17,407 |
| Tooling Specialist | 🔴 low | Yes | 16,317 |


**[generic] Generic Developer Memory:**
> Your philosophy on abstractions is deeply skeptical and pragmatic, centered around the principle **"Earn your abstractions."** Here are your core thoughts:

**1. Abstractions must be earned, not assumed**
You treat premature abstraction as seriously as premature optimization. Structure should only be added when patterns emerge organically from real usage—not anticipated or planned upfront.

**2. Duplication is preferable to the wrong abstraction**
You follow a "rule of three"—wait for the third occurrence before extracting common code. Similar code isn't identical code; different contexts may have different requirements that diverge later. You've learned personally that the urge to "do it right" leads to early abstraction, then requirements change and it doesn't fit.

**3. Skepticism of "enterprise" patterns**
You're dismissive of what you call "enterprise cosplay"—applying heavy patterns like DI containers to small projects that don't need them. Your preference: pass dependencies as function arguments until that gets unwieldy.

**4. Native over library**
You prefer language/platform features over abstractions provided by libraries. Optional chaining over null-check utilities, simple middleware over authorization libraries like CASL. Libraries must justify their complexity.

**5. Solve problems you have, not problems you imagine**
This extends to architecture (monolith first, microservices only when needed), infrastructure (feature flags are debt for small teams), and tooling choices. You don't add complexity for "good architecture" alone.

**6. The goal is solving problems, not writing code**
Every line of code is a liability. Sometimes the best solution is not writing code at all. Simple code lives longer, and deletion is progress.

*Gaps: No specific examples of abstractions you've regretted creating; No guidance on how to recognize when an abstraction has finally been 'earned'; No discussion of when abstractions ARE worth it early (if ever)*


**[philosophy] Philosophy Specialist:**
> Your philosophy on abstractions is clear and well-defined: **"Start simple, extract when patterns emerge."** You view premature abstraction as equally harmful as premature optimization.

**Core beliefs about abstractions:**

1. **Abstractions must be earned** — Structure, patterns, and frameworks should emerge from concrete need, not be anticipated. You don't add abstraction layers "just in case."

2. **The Rule of Three** — "Write the thing three times, then extract." You have explicit thresholds: 10+ routes before middleware patterns, 3 occurrences before extracting shared code, 10+ templates before adding a templating engine.

3. **Duplication is cheaper than the wrong abstraction** — You'd rather repeat yourself than create a premature unification of code that looks similar but serves different contexts. Wrong abstractions are costly to undo.

4. **Anti-"enterprise cosplay"** — You mock over-engineered frameworks and patterns adopted before they're needed: DI containers for non-enterprise apps, NestJS when Express suffices, GraphQL when REST works fine. You see these as abstractions solving imagined problems.

5. **Pragmatic incrementalism over upfront architecture** — You prefer choosing the simpler option now with a known upgrade path. Start flat, extract structure when patterns emerge. Express → add structure later. Raw SQL → add Kysely when needed. In-memory → Redis when scaling horizontally.

6. **Abstractions hide things (and that's often bad)** — You value explicitness over magic. ORMs "add magic I don't need." Exceptions feel like goto because they hide control flow. You want failure modes visible in type signatures, not buried under abstraction layers.

7. **Meta-goal: Codebases should get simpler over time** — You recognize that complexity growth is the default, and abstractions often contribute to that growth. Simplicity requires active effort and resistance to unnecessary abstraction.

**What you avoid:**
- Frameworks/patterns before proven need
- Layer upon layer of abstraction
- Hidden control flow (exceptions, ORM magic)
- Premature unification of "similar" but contextually different code
- "Shared" folders that become junk drawers of abstracted utilities

In essence, you see abstractions as tools that should solve real, present problems — not speculation about future needs. "Solve problems you have, not problems you imagine."

*Gaps: No explicit examples of abstractions you regret adding or had to remove; Unclear how you evaluate when an abstraction has 'proven its need' vs. still being premature; No specific guidance on how to recognize when the 'Rule of Three' threshold has been met in ambiguous cases; Unknown: your thoughts on abstraction in test code specifically (test utilities, fixtures, etc.)*


**[style] Code Style Specialist:**
> Your philosophy on abstractions is clear and well-defined: **"Start minimal, extract when proven."** You apply YAGNI aggressively to architecture, not just features, and view premature abstraction as equivalent to premature optimization.

**Core beliefs about abstractions:**

1. **Premature abstraction is dangerous** — You've called unnecessary patterns "enterprise cosplay" and are self-aware about this tendency: "I want to 'do it right' so I abstract early. Then requirements change and abstraction doesn't fit."

2. **Rule of Three** — Don't DRY until 3+ occurrences AND the pattern is truly understood. "Write the thing three times, then extract." Similar code is not identical code — keep things separate until they "truly converge."

3. **Thresholds before abstracting:**
   - 10+ routes → then add middleware abstractions
   - 10+ templates → then adopt a template engine
   - Not before.

4. **Helpers are welcome, magic is not** — You approve of abstractions that reduce boilerplate without hiding what's happening. Plain Express over NestJS. Function arguments over DI containers. You want to see exactly what happens.

5. **Obvious over clever** — Prioritize clarity and convention over cleverness. If an abstraction makes code harder to understand, it's not worth it.

6. **Incremental extraction** — You prefer the strangler fig pattern for legacy code and piece-by-piece replacement over big-bang rewrites. Fix debt when you're already in the file, not in dedicated sprints.

**What you reject in PRs:**
- Premature abstraction
- Authorization libraries for simple needs (e.g., CASL for just 3 roles)
- Utility functions that duplicate native language features
- DI containers when function arguments work fine

**What you approve:**
- Helpers that genuinely reduce boilerplate
- Shared `lib/` folders for code used everywhere (e.g., `lib/result.ts`, `lib/validation.ts`)
- Abstractions that emerge from proven patterns, not imagined future needs

*Gaps: No specific examples of abstractions you've regretted or removed; Unclear how you evaluate whether an abstraction has 'proven' its worth vs still being premature; No guidance on how to handle team disagreements about when to abstract*


**[tooling] Tooling Specialist:**
> You have a strongly anti-premature-abstraction philosophy, captured by your core mantra: **"Start simple, extract when patterns emerge."**

Your key principles on abstractions:

1. **"Duplication is cheaper than the wrong abstraction"** - You'd rather repeat code than create a bad abstraction that becomes a burden.

2. **Rule of 3** - You wait until you see something three times before extracting it into an abstraction. This prevents creating abstractions for patterns that may not actually recur.

3. **"Solve problems you have, not problems you imagine"** - Abstractions should address real, demonstrated pain points, not hypothetical future needs.

4. **Delay abstraction until pain is felt** - This is an explicit decision heuristic. You don't abstract preemptively.

5. **Threshold-based scaling** - You use concrete thresholds like "3+ duplications → extract" or "10+ templates → template engine" to know when abstraction is warranted.

6. **Avoid "shared" folders** - You view these as "junk drawers" that accumulate premature abstractions. Instead, you keep code with its feature until it's truly universal (then it goes to `lib/`). If only 2 features use something, you keep it in one and import from there.

7. **"Big rewrites fail. Incremental improvement wins."** - Even when refactoring, you prefer the strangler fig pattern (add tests, replace piece by piece) over big-bang rewrites.

Your underlying belief is clear: **every line of code is a liability**, and abstractions add complexity. The goal isn't to write elegant abstractions—it's to solve problems with the simplest code possible.

*Gaps: No specific examples of abstractions you've regretted or removed; No data on how you decide when an abstraction has proven its value vs. when to revisit/remove it; No insight into types of abstractions you find acceptable vs. problematic (e.g., data abstractions vs. behavioral abstractions)*


---

### 7. How do I approach code reviews?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 16,029 |
| Philosophy Specialist | 🔴 low | Yes | 16,570 |
| Code Style Specialist | 🔴 low | Yes | 17,254 |
| Tooling Specialist | 🔴 low | Yes | 15,851 |


**[generic] Generic Developer Memory:**
> Based on my understanding, code reviews should be approached with a clear philosophy: **focus on what matters, automate the rest**.

**What to focus on in code reviews:**
1. **Logic errors** — Does the code actually do what it's supposed to do?
2. **Security issues** — Are there vulnerabilities, improper auth handling, data exposure risks?
3. **Unclear code** — Will someone else (or you in 6 months) understand this?

**What NOT to focus on:**
- **Style and formatting** — Don't bikeshed naming conventions or code style. That's what linters are for. If it's important enough to argue about, it's important enough to encode in a linter rule.
- **Anything a tool can check** — Reserve human discussion for design patterns and architecture decisions that require judgment.

**The underlying philosophy:**
- "Automate style, debate design" — Never manually do what tools can automate. Style guides belong in linter rules, not prose.
- "Ship fast, fix forward" — Don't let reviews become bottlenecks. If it's not a logic error, security issue, or genuinely unclear, let it ship.

**Practical application:**
- If you find yourself wanting to comment on formatting, stop and ask: "Can I add a linter rule for this instead?"
- If you're debating naming, ask: "Is this actually unclear, or just not how I would write it?"
- Focus your energy on architecture and design patterns — those are the decisions that compound.

The goal is to catch real problems (bugs, security holes, confusing code) while avoiding the common trap of turning code reviews into style debates that slow down shipping.

*Gaps: No specific guidance on code review tooling preferences (e.g., GitHub PRs vs other platforms); No explicit stance on required number of approvers or review turnaround time expectations; No guidance on how to handle disagreements during code review; No specific examples of what constitutes a 'blocking' vs 'non-blocking' comment*


**[philosophy] Philosophy Specialist:**
> Based on my understanding, you approach code reviews with a clear philosophy: **focus on what matters, automate everything else**.

**What you focus on in code reviews:**
1. **Logic errors** — actual bugs and incorrect behavior
2. **Security issues** — vulnerabilities that could be exploited
3. **Unclear code** — code that's hard to understand or maintain

**What you explicitly avoid:**
- **Bikeshedding** on naming and style — that's what linters are for
- Debating things like import order, formatting, or stylistic preferences

**Your guiding principles:**
- **"Ship fast, fix forward"** — momentum matters more than perfection
- **"Never argue about things a tool can check"** — if a linter can enforce it, automate it; don't waste review time on it
- **Rules over prose** — convert style guides to linter rules because "docs get ignored, linter errors don't"

**The philosophy behind this:**
You believe automation should handle mechanical decisions (style, formatting, import order) so humans can focus on judgment calls — things that require context, like design patterns, architecture decisions, and whether the code actually solves the problem correctly.

This aligns with your broader value of **"Don't waste mental energy on import order"** and your preference for consolidating team standards into tooling rather than documentation that gets ignored.

*Gaps: How you handle disagreements about design decisions (the non-automatable stuff) in code reviews; Your preferred timing/cadence for code reviews (immediate, batched, etc.); How you balance thoroughness vs. speed in reviews; Whether you use any specific code review tools or prefer GitHub's built-in; Your approach to reviewing code from junior vs senior developers; How you give feedback — tone, format, whether you suggest alternatives vs just point out issues*


**[style] Code Style Specialist:**
> Based on your established patterns, here's how you approach code reviews:

**Focus on What Matters**
- ✓ **Logic errors** - actual bugs and incorrect behavior
- ✓ **Security issues** - authentication, authorization, input validation
- ✓ **Unclear code** - naming, structure, readability
- ✗ **Skip style/naming bikeshed** - "that's what linters are for"

**Core Philosophy: "Ship fast, fix forward"**
Automate everything tools can check; reserve human discussion for design patterns and architecture decisions.

**Things You Reject PRs For:**
- Premature abstraction or optimization
- Infrastructure overkill (Redis when in-memory works, Kubernetes when Fly.io suffices)
- Full rewrites without integration tests
- Adding GitFlow ceremony (develop branch)
- Authorization libraries for simple needs (CASL for 3 roles = overkill)
- Deprecated/monolithic libraries (moment.js)
- Utility functions duplicating native features
- Style discussions that should be linter rules
- Manual import sorting
- Unnecessary `else` after `return`
- Nested ternaries
- Over-destructuring (destructuring 12 fields, using 3)
- `Object.assign` for immutable merging (use spread)

**Things You Approve With Changes:**
- Missing helpers that reduce boilerplate
- Docker images with dev dependencies in production
- Manual docs that should be generated (zod-to-openapi)
- Deployment workflows without separated build/deploy stages

**Guiding Principle:**
"Automate style, don't document it" — Style guides as prose get ignored. Convert rules to linter config. "Docs get ignored, linter errors don't."

The underlying value: humans should discuss *design* in reviews, not formatting. If a style concern keeps coming up, add it to Biome config, don't argue about it in PRs.

*Gaps: No specific guidance on how to phrase code review feedback or communication style; No information about review turnaround time expectations; No guidance on when to block a PR vs. approve with suggestions; No patterns for reviewing code in unfamiliar areas of the codebase*


**[tooling] Tooling Specialist:**
> Based on my understanding, code reviews should focus on what matters and avoid wasting time on things tools can automate. Here's the approach:

**Focus on substance, not style:**
- **Logic errors** - Does the code actually do what it's supposed to?
- **Security issues** - Are there vulnerabilities, improper input handling, or data exposure risks?
- **Unclear code** - Will this be maintainable? Can someone else understand it?

**Don't bikeshed:**
- Don't argue about naming conventions or formatting - that's what linters are for
- Style debates are a waste of time when Biome (or similar tools) can enforce consistency automatically
- "Never argue about things a tool can check"

**Ship fast, fix forward:**
- The goal is to keep velocity high while catching real issues
- Code reviews shouldn't be blockers for trivial issues
- If something small slips through, fix it in the next PR

**Automate everything possible:**
- Let linters handle style
- Let types handle correctness
- Let CI catch test failures
- Reserve human attention for judgment calls that tools can't make

**Practical application:**
- With trunk-based development and short-lived branches, reviews should be quick
- Main should always be deployable, so reviews focus on "is this safe to merge?"
- Small PRs are easier to review than large ones

*Gaps: No specific guidance on code review tooling preferences (GitHub PR reviews vs. other platforms); No explicit information about review approval requirements (number of approvers, required reviewers); No details on how to handle disagreements in code reviews; No guidance on reviewing code from junior vs senior developers; No information about async vs sync code review preferences*


---

### 8. What tools do I prefer?

| Learner | Confidence | Relevant | Tokens |
|---------|------------|----------|--------|
| Generic Developer Memory | 🔴 low | Yes | 16,720 |
| Philosophy Specialist | 🔴 low | Yes | 18,118 |
| Code Style Specialist | 🔴 low | Yes | 16,976 |
| Tooling Specialist | 🔴 low | Yes | 17,118 |


**[generic] Generic Developer Memory:**
> Based on your documented preferences, here are the tools you prefer, organized by category:

**Core Philosophy:** Fastest, minimal API, single-purpose tools. Avoid "magic." Tree-shaking matters for bundle size.

**Specific Tool Preferences:**

| Category | Preferred Tool | Why |
|----------|---------------|-----|
| **Framework** | Express | Over NestJS (simpler, less magic) |
| **Database** | Postgres with raw SQL or Kysely | See exact queries, no ORM magic |
| **Migrations** | Plain SQL files with simple runner | See exact DDL, no abstraction |
| **Validation** | Zod | TypeScript-first, unifies runtime and compile-time validation; also for config validation at startup |
| **Logging** | Pino | Fast, JSON output, minimal API |
| **Linting/Formatting** | Biome | Single tool, faster than ESLint+Prettier combo |
| **Load Testing** | k6 | - |
| **API Documentation** | zod-to-openapi | Generate docs from schemas, never manually maintain |
| **Security Headers** | Helmet.js | But customize each header to your needs |
| **CI/CD** | GitHub Actions | Native integration when on GitHub |
| **Date Handling** | date-fns | Tree-shakeable, import only what you use. Never moment.js (deprecated, huge) |
| **Deployment** | Fly.io or Railway | For small teams. K8s only with dedicated infra team |

**Observability Stack (Incremental):**
1. Start with structured logs (Pino)
2. Add Prometheus metrics when dashboards are needed
3. Add traces when debugging distributed calls

**Anti-preferences (tools you avoid):**
- NestJS (too much magic/ceremony)
- ORMs with heavy abstraction
- moment.js (deprecated, not tree-shakeable)
- CASL (authorization library) for simple cases — prefer simple middleware
- ESLint+Prettier separately (Biome does both faster)

*Gaps: No documented preference for frontend frameworks/tools; No specific testing framework mentioned (Jest, Vitest, etc.); No documented preference for HTTP client libraries; No specific tracing tool mentioned (Jaeger, Zipkin, etc.); No documented preference for caching solutions beyond 'don't cache prematurely'*


**[philosophy] Philosophy Specialist:**
> Based on my understanding of your preferences, here are the tools you prefer, organized by category:

**Runtime & Language**
- **TypeScript** with strict settings (`strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- **Zod** as the single source of truth for types, runtime validation, config validation, AND OpenAPI generation

**Web Framework**
- **Express** over NestJS — you reject over-engineered frameworks in favor of minimal, explicit ones

**Database**
- **PostgreSQL** for known schemas ("NoSQL is for when you don't know your data model")
- **Raw SQL** over ORMs — you want to see the exact queries, no magic
- **Plain SQL migration files** with a simple runner
- **Kysely** as the upgrade path when needed

**API Design**
- **REST** over GraphQL
- URL path versioning (`/v1/`)
- Cursor pagination

**Code Quality & Formatting**
- **Biome** over ESLint + Prettier — you prefer consolidated tools with minimal config
- Tabs for indentation (accessibility), single quotes

**Logging & Observability**
- **Pino** for logging — fast, minimal API
- Prometheus metrics when dashboards are needed (but not before)

**Date Handling**
- **date-fns** over dayjs/moment — tree-shakeable, import only what you use

**CI/CD**
- **GitHub Actions** for GitHub repos — native integrations preferred
- **Docker** with multi-stage builds for minimal production images

**Infrastructure**
- Simple PaaS like **Fly.io** or **Railway** — K8s only with dedicated infra team
- **In-memory solutions first**, Redis only when scaling horizontally
- **HTTP webhooks first**, event buses (RabbitMQ) only for multiple consumers or guaranteed delivery

**Security**
- **Helmet.js** with customized CSP (not blindly copied defaults)
- httpOnly cookies over client-side storage

**Testing**
- **Docker Compose** for real test databases
- Integration tests for APIs, unit tests only for pure functions

**Patterns You Use**
- **Result types** over throw/catch for error handling
- **Functions over classes** (classes only for encapsulated state)
- **`type` over `interface`** (interfaces only for class contracts or declaration merging)

The common thread: you choose tools that are **minimal, explicit, fast, and solve real problems** — avoiding magic, bloat, and premature complexity.

*Gaps: Specific testing framework preference (Jest, Vitest, etc.) is not explicitly stated; Preferred HTTP client library (axios, fetch, etc.) is not mentioned; Frontend framework preferences (if any) are unknown; Specific SQL migration runner tool preference is not named; Preferred IDE/editor is not mentioned; Package manager preference (npm, pnpm, yarn) is not specified; Specific Result type library or custom implementation preference is unclear*


**[style] Code Style Specialist:**
> Based on your coding style patterns, you have clear tooling preferences driven by a **minimalism principle** — you want the fastest/simplest tool that does the job:

**Development Tools:**
- **Biome** for linting/formatting — single tool, faster than ESLint+Prettier combo
- **Pino** for logging — fast, JSON default, minimal API
- **Express** (plain) over NestJS — simpler, no magic
- **TypeScript** with strict mode enabled

**Database & Data:**
- **PostgreSQL** with raw SQL and plain SQL migrations (no ORMs)
- **Zod** for validation — single source of truth for runtime + compile-time types
- **date-fns** for dates — tree-shakeable. You reject moment.js.

**API & Documentation:**
- **zod-to-openapi** — generates API docs from schemas

**Security:**
- **Helmet.js** with customized CSP headers

**Infrastructure & Deployment:**
- **Fly.io or Railway** over Kubernetes
- **Docker** with multi-stage builds
- **GitHub Actions** for CI/CD

**General Philosophy:**
- Native language features over utility libraries
- Function arguments over DI containers
- In-memory solutions over Redis until needed
- HTTP webhooks over event buses

*Gaps: No information about preferred testing frameworks (e.g., Jest, Vitest, etc.); No specific IDE or editor preferences recorded; No information about preferred HTTP client libraries; No details on monitoring/observability tooling beyond Prometheus mention; No information about preferred bundler (Webpack, Vite, esbuild, etc.)*


**[tooling] Tooling Specialist:**
> Based on my understanding of your preferences, here are the tools you prefer across different categories:

**Validation & Schema**
- **Zod** - TypeScript-first validation with type inference, config validation, and OpenAPI generation
- **@asteasolutions/zod-to-openapi** - For generating OpenAPI specs from Zod schemas

**Web Framework**
- **Express** - Minimal, not opinionated (explicitly over NestJS, which you consider "over-engineered")

**Database**
- **PostgreSQL** with raw SQL driver (no ORM)
- Plain SQL migration files with simple runner over migration tools that "add magic"
- Would consider **Kysely** if complexity warrants a query builder

**Logging**
- **Pino** - Fastest, JSON by default, minimal API (Winston is "bloated" in your view)

**Security**
- **Helmet.js** - For security headers, with customized configuration

**Linting & Formatting**
- **Biome** - Replaced ESLint+Prettier as a single, faster tool

**Testing**
- **k6** - For load testing

**Dates**
- **date-fns** - Tree-shakeable, import only what you use (moment.js is deprecated/huge, dayjs requires full library)

**CI/CD**
- **GitHub Actions** - Native integration when already on GitHub

**Deployment**
- **Fly.io** or **Railway** over Kubernetes (K8s only with dedicated infra team)
- **Docker** with multi-stage builds

**Email Templates**
- **Template literals** for simple cases (until 10+ templates, then React Email)

**Observability Stack**
- **Pino** (structured logs) → **Prometheus** (metrics) → Traces (distributed debugging)

**General Principles Guiding Tool Choices:**
- Native/built-in features over utility libraries when possible
- Fewer tools over more tools (consolidate)
- Minimal over opinionated
- Understand each tool before adopting (no blind defaults)

*Gaps: No explicit preference recorded for unit testing framework (Jest, Vitest, etc.); No specific tracing tool mentioned (OpenTelemetry, Jaeger, etc.); No preference stated for HTTP client library (axios, fetch, got, etc.); No specific PostgreSQL driver mentioned (pg, postgres.js, etc.); No preference for Docker image base (Alpine, Distroless, etc.); No preference for Redis client library if/when Redis is adopted; No preference for file upload handling library; No preference for queue/background job processing tool*



## Final Understanding (Per Learner)


### Generic Developer Memory (generic)

**Purpose:** Understand core development philosophy, coding style patterns, and recurring problem-solving approaches

```
## Core Philosophy

**"Earn your abstractions"** — Start simple, add structure only when patterns emerge organically. Premature abstraction is treated as seriously as premature optimization. Skeptical of "enterprise" patterns applied to small projects ("enterprise cosplay"). DI containers are overkill — pass dependencies as function arguments until that gets unwieldy.

**"Obvious over clever"** — Consistently prefer straightforward solutions: URL versioning over headers ("clients hate clever"), REST over GraphQL at small scale, template literals over engines for 2 templates. Solve problems you have, not problems you imagine.

**"Understand what you use"** — Never cargo-cult defaults. Security headers need customization to actual resources. Metrics must answer specific questions. Coverage targets are meaningless without quality tests. If you can't explain why something is configured a certain way, you don't understand it well enough.

**"Duplication > wrong abstraction"** — Wait for the third occurrence before extracting. Similar code isn't identical code; different contexts may have different requirements that diverge later. Personal lesson learned: the urge to "do it right" leads to early abstraction, then requirements change and it doesn't fit.

**"Fail fast"** — Validate configuration at startup; if required config is missing, fail with clear error. Don't let apps start in bad state. Strict typing catches errors at compile time rather than runtime.

**"Prove the bottleneck"** — Readability beats micro-performance. Don't optimize (caching, Redis, callbacks) until you measure an actual problem. Premature caching creates invalidation bugs.

**"Scale to your reality"** — Infrastructure should match team/project scale, not aspirational architecture. Feature flags are debt for a 3-person team. Event buses wait until you need guaranteed delivery. Monolith until team boundaries require service boundaries. K8s only with dedicated infra team — otherwise Fly.io or Railway. Never add complexity for "good architecture" alone.

**"Native over library"** — Prefer language/platform features over libraries: optional chaining over null-check utilities, simple middleware over CASL. Libraries must justify their complexity; they solve problems, not check boxes.

**"Incremental over big-bang"** — Small, continuous changes beat large rewrites. Big rewrites fail; incremental improvement wins. Applies to: refactoring (strangler fig), branching (trunk-based), debt (fix when in file). Shipping beats planning.

**"Types over tests"** — Both matter, but types catch more. Types are the first line of defense; tests verify behavior types can't express.

**"Automate style, debate design"** — Never manually do what tools can automate. Style guides belong in linter rules, not prose. Docs get ignored, linter errors don't. Reserve human discussion for architecture and design patterns.

**"Less code is better code"** — Every line of code is a liability. The goal isn't to write code, it's to solve problems. Sometimes the best solution is not writing code at all. Simplicity is a feature. Simple code lives longer.

## Coding Style

**Language/Typing:**
- TypeScript with maximum strictness (strict, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess)
- Prefers TypeScript-first tools (Zod) unifying runtime and compile-time
- Avoid type assertions ('as') — if needed, fix the types. Only exception: test mocks with intentional partials
- Language-idiomatic naming: "errors" not "exceptions" in JS
- `type` for data shapes (DTOs, responses), `interface` only for class contracts or declaration merging — in practice, type for almost everything
- Null/undefined: `undefined` for absence, `null` for intentional empty. In practice: avoid both with proper types. Use optional chaining (?.) and nullish coalescing (??) — native features over utility functions

**Naming Conventions:**
- Names explain what, not how. If you need a comment to explain a name, the name is wrong
- Specific over generic: 'userProfile' not 'data', 'apiResponse' not 'res'. Generic names ('data', 'handle', 'process') are code smells
- Booleans: is/has/can/should prefix ('isActive' not 'active'). Exception: obvious booleans like 'visible', 'enabled'
- Functions: verb for actions (createUser, deletePost), adjective for transformers (formatted, validated), question for predicates (isEmpty, hasAccess)
- Constants: SCREAMING_SNAKE_CASE only for true constants (MAX_RETRIES, API_TIMEOUT). Regular camelCase for config values that could change

**Control Flow:**
- Early returns always. Guard clauses at top, happy path at bottom. No else after return — it's visual noise
- Ternaries: single line, simple values only. Never nested. Multi-line conditions use if/else

**Destructuring:**
- Destructure at point of use, not at function start
- Only destructure what you actually need — don't pull 12 fields to use 3
- Deep destructuring is a code smell — indicates data structure should be flattened

**Object Operations:**
- Spread for shallow copies: `{ ...obj, newProp }`. Prefer over Object.assign
- Object.assign only for mutation in place (which should be avoided anyway)
- Immutability by default

**Async Patterns:**
- async/await everywhere for consistency and readability
- Promises when composing multiple operations
- Never callbacks unless forced by old libraries

**Formatting:**
- Tabs (for accessibility), single quotes, printWidth: 100
- camelCase everywhere, no translation layers
- Imports: external packages first, then internal. Let the linter sort within groups — don't waste mental energy on import order

**Code Organization:**
- Feature-based over layer-based: organize by feature (users/, auth/) not layer (routes/, handlers/). Keep related code together, reduce context switching
- No "shared" folders — they become junk drawers. If truly universal, put in lib/. If used by 2 features, keep in one and import
- Functions over classes — classes only when encapsulating state
- Functions should do one thing; if you can't name it clearly, split it
- Extract helpers when they reduce boilerplate (e.g., transaction wrapper)
- Comments only for non-obvious behavior; never repeat what code says

**Error Handling:**
- Result types over throw/catch
- Errors explicit in return types, not hidden control flow
- Environment-aware: full stack traces in dev, correlation IDs in prod
- Never leak internals to users

## Security Principles

- httpOnly cookies for auth tokens — never trust client-side storage
- Helmet.js for security headers but customize each header to your needs (especially CSP)
- Environment-specific error exposure
- Correlation IDs for debugging without leaking details
- RBAC for authorization when roles are few and simple. ABAC only when requirements demand attribute-based logic. Simple middleware over authorization libraries (CASL) for basic cases.

## Tooling Preferences

**Philosophy:** Fastest, minimal API, single-purpose tools. Avoid "magic." Tree-shaking matters for bundle size.
- **Framework:** Express over NestJS
- **Database:** Postgres with raw SQL or Kysely
- **Migrations:** Plain SQL files with simple runner — see exact DDL, no magic
- **Validation:** Zod (also for config validation at startup)
- **Logging:** Pino (fast, JSON, minimal)
- **Linting:** Biome (single tool, faster than ESLint+Prettier). Use strict rules; convert style guides to rules, not prose
- **Load Testing:** k6
- **API Docs:** zod-to-openapi — generate, never manually maintain
- **Security Headers:** Helmet.js
- **CI/CD:** GitHub Actions (native integration when on GitHub)
- **Dates:** date-fns (tree-shakeable, import only what you use). Never moment.js (deprecated, huge).

## API Design

- URL path versioning (/v1/) — clear, cacheable, obvious
- REST until complexity demands otherwise
- Plural resource names (/users, /posts, /comments) — exception: /me for current user
- Cursor pagination over offset — implement early, retrofitting is painful
- Health checks: /health (simple 200 for LB), /health/deep (checks DB for monitoring)
- HTTP webhooks before event buses — simpler, debuggable, no infrastructure

## Documentation Philosophy

**Code is source of truth** — Documentation should be derived, never manually maintained. Generate OpenAPI from Zod schemas. If schema changes, docs update automatically. Manual docs drift from reality. Style guidance belongs in linter rules, not documents.

## Testing Philosophy

- Integration tests for APIs (test behavior, not implementation)
- Unit tests only for pure functions
- Reject testing implementation details
- **Coverage is vanity** — focus on testing behavior, not hitting lines. 100% coverage with bad tests is worse than 60% with good ones. Remove trivial getter tests, add edge case tests
- **Mock what you don't own** — external APIs, third-party services. Never mock your own code — that tests implementation, not behavior
- Use real test database for integration tests (Docker Compose setup)
- Load tests: before production and after major changes, separate pipeline (not in regular CI)
- **Tests before refactoring** — when touching legacy code, add integration tests first to capture current behavior. Creates safety net for changes.

## Observability Philosophy

**Incremental stack:** Start with structured logs (Pino). Add Prometheus metrics when dashboards are needed. Add traces when debugging distributed calls.

**RED metrics focus:** Rate, Errors, Duration. Add other metrics only when you have specific questions to answer. Too many metrics is noise.

## Architecture Philosophy

**Monolith first** — Microservices solve distribution problems, not complexity problems. Extract services when:
- Team boundaries require service boundaries
- A component needs different scaling/deployment characteristics
Never for "good architecture" alone.

## Refactoring Philosophy

**Strangler fig pattern** — Don't rewrite, strangle. Add tests first, replace piece by piece. Big rewrites fail; incremental improvement wins.

**Technical debt management:**
- TODO comments for small stuff
- Issues for bigger stuff
- Fix debt when you're in the file — opportunistic cleanup
- Never plan dedicated debt cleanup sprints

**Fight complexity accumulation** — Codebases naturally grow complex. Actively resist: simpler code after changes is a win worth celebrating. Write code. Delete code. Deletion is progress.

## Data Decisions

- Soft deletes only for compliance/legal requirements (user data). Hard delete for transient resources (sessions). "Maybe someday" is not a requirement.

## Deployment/Operations

- Docker: minimal production images, no dev dependencies, multi-stage builds
- Start simple (in-memory, single instance), scale horizontally when needed
- **Immutable artifacts:** Separate build and deploy stages. Same artifact goes to staging and production
- **Platform choice:** Fly.io or Railway for small teams. K8s only when you have dedicated infra team to manage operational overhead

## Workflow Philosophy

**Git Strategy:**
- Trunk-based development: main is always deployable
- Short-lived feature branches, merge directly to main
- No develop branch — adds ceremony, not safety
- GitFlow is for enterprises with release trains; prefer continuous shipping

**Code Reviews:**
- Focus on: logic errors, security issues, unclear code
- Don't bikeshed naming or style — that's what linters are for
- "Ship fast, fix forward"

**Team Standards:**
- Automate everything possible: linters for style, types for correctness
- Reserve human discussion for design patterns and architecture
- Never argue about things a tool can check
```


### Philosophy Specialist (philosophy)

**Purpose:** Understand the developer's core beliefs about software engineering - what they value, what they avoid, and why

```
## Core Philosophy
**"Start simple, extract when patterns emerge"** — Premature abstraction is equally harmful as premature optimization. Structure, patterns, and frameworks should be earned through concrete need, not anticipated. Duplication is cheaper than the wrong abstraction. "Write the thing three times, then extract."

**Meta-goal: Codebases should get simpler over time.** "Code is simpler than when we started. That's rare." Complexity growth is the default; simplicity requires active effort.

**"Every line of code is a liability."** The goal isn't to write code, it's to solve problems. Sometimes the best solution is not writing code at all. Simplicity is a feature.

## Primary Values

### 1. Minimalism Before Abstraction
- Rejects over-engineered frameworks (Express over NestJS, REST over GraphQL)
- Starts flat, extracts structure only when patterns emerge
- Mocks unnecessary enterprise patterns as "enterprise cosplay"
- **Uses explicit thresholds**: 10+ routes for middleware, 3 occurrences before extracting, 10+ templates before adding templating engine
- "Solve problems you have, not problems you imagine"
- **DI via function arguments** — DI containers are overkill for non-enterprise apps
- **"Libraries solve problems, not check boxes"** — reject libraries that don't solve an actual need (CASL for 3 roles, etc.)

### 2. Explicitness Over Magic
- Error handling: Result types over throw ("throw feels like goto")
- Database: Raw SQL over ORMs ("ORMs add magic I don't need")
- **Migrations: Plain SQL files with simple runner** — "I want to see and version the exact DDL"
- Functions over classes (classes only for encapsulated state)
- Wants failure modes visible in type signatures
- Comments only for non-obvious behavior ("I can read the function name")
- **Understand tools before adopting**: e.g., customize Helmet CSP to match actual resources, don't copy defaults blindly

### 3. Native Features Over Dependencies
- **Native language features > utility libraries**: optional chaining, nullish coalescing over null-check utilities
- **Tree-shakeable libraries**: date-fns over dayjs/moment (import only what you use)
- **Reject deprecated/bloated libraries**: "Stop adding legacy libraries"
- **null/undefined**: undefined for absence, null for intentional empty; in practice, avoid both with proper types

### 4. Obvious Over Clever
- URL path versioning over header versioning ("clever but clients hate it")
- Prioritizes consumer/collaborator experience over technical elegance
- Prefers solutions that are immediately understandable
- "Clever code is not good code"

### 5. Type Safety as Foundation (Non-Negotiable)
- Strict TypeScript: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`
- **Zod as single source of truth**: types, runtime validation, config validation, AND OpenAPI generation
- **`type` for almost everything** — interfaces only for class contracts or declaration merging
- **Type assertions (`as`) almost never** — if you need `as`, fix the types. Exception: intentionally partial test mocks
- **Types over tests**: Both matter, but types catch more bugs earlier. Types are the first line of defense.
- Type safety enables confident simplicity

### 6. Fail Fast, Fail Loud
- **Config validated at startup with Zod** — don't let app start in bad state
- httpOnly cookies over client-side storage ("XSS is too easy")
- Environment-aware error exposure: full traces in dev, error codes + correlation IDs in prod
- Never leak internals to users
- Problems should surface early and explicitly

### 7. Pragmatic Incrementalism
- Chooses simpler option now with known upgrade path
- Express → can add structure; Raw SQL → can add Kysely; Flat → can extract
- Template literals now → React Email at scale
- **In-memory → Redis when scaling horizontally**
- **No caching → caching when response times prove problematic**
- **HTTP webhooks → event bus (RabbitMQ) only for multiple consumers or guaranteed delivery**
- **Observability ladder**: Structured logs (Pino) → Prometheus metrics when dashboards needed → Traces when debugging distributed calls
- **Metrics**: Start with RED (Rate, Errors, Duration), add custom metrics only when specific questions arise
- **Infrastructure**: Simple PaaS (Fly.io, Railway) → K8s only with dedicated infra team
- **Authorization**: RBAC for simple role needs, ABAC only if requirements grow
- Not anti-framework, just anti-premature-framework
- **Evidence-based decisions**: profile and prove bottleneck before optimizing
- **"Ship, then improve"** — get working code deployed, iterate from there. Shipping beats planning.
- **Exception: cursor pagination from the start** — migration cost too high, offset breaks on real-time data (confirmed: "Retrofitting was painful")

### 8. Monolith First, Always
- Microservices solve distribution problems, not complexity problems
- Feature flags are "infrastructure debt" for small teams (<10 devs)
- Event buses only when multiple consumers or guaranteed delivery needed
- Architecture decisions driven by team size and actual problems, not ideals
- "We're 3 developers. Talk to each other."

## Workflow Philosophy

### Git & Branching
- **Trunk-based development**: short-lived feature branches, direct to main
- **No develop branch**: "Main is always deployable. Adding branches adds ceremony, not safety."
- Rejects GitFlow as enterprise ceremony ("for enterprises with release trains")
- Ships continuously

### Code Reviews
- **Focus on**: logic errors, security issues, unclear code
- **Don't bikeshed**: naming, style — that's what linters are for
- **"Ship fast, fix forward"**
- Automation handles style debates; humans handle judgment calls

### Technical Debt
- TODO comments for small stuff, issues for bigger stuff
- **Fix it when you're in the file** — don't plan debt cleanup sprints
- Opportunistic improvement over dedicated sprints

### Refactoring Legacy Code
- **Strangler fig pattern**: add tests first, replace piece by piece
- **"Big rewrites fail. Incremental improvement wins."**
- Tests create safety net before any refactoring

### Team Standards
- **Automate everything possible**: linters for style, types for correctness
- **Rules over prose**: Convert style guides to linter rules. "Docs get ignored, linter errors don't."
- Discussions reserved for design patterns and judgment calls
- **"Never argue about things a tool can check"**
- **"Don't waste mental energy on import order"** — let tools handle mechanical decisions

## Code Style

### Naming Conventions
- **Names explain "what", not "how"**: 'filteredUsers' good, 'loopResult' bad
- **Specific over generic**: 'userProfile' over 'data', 'apiResponse' over 'res'. Generic names are code smells
- **Booleans**: is/has/can/should prefix ('isActive' not 'active'). Exception: obvious booleans like 'visible', 'enabled'
- **Functions by purpose**:
  - Verbs for actions: createUser, deletePost
  - Adjectives for transformers: formatted, validated
  - Questions for predicates: isEmpty, hasAccess
- **Generic verbs are code smells**: 'process', 'handle' → rename to specific actions like 'normalizeInput', 'routeRequest'
- **Constants**: SCREAMING_SNAKE_CASE only for true constants (MAX_RETRIES, API_TIMEOUT). Config values use camelCase
- **Single convention everywhere**: camelCase, language-idiomatic terminology ("errors" not "exceptions" in JS)

### Code Structure
- **Early returns always**: Guard clauses at top, happy path at bottom. Deeply nested if/else is unreadable
- **No redundant else**: After 'if (invalid) return error', the next line is implicitly the valid case
- **Ternaries**: Single line, simple values only. Never nested. If it needs multiple lines, use if/else. "Clever code is not good code."
- **Functional by default**, OOP only when state requires it
- **Immutability by default**: Spread for copies (`{ ...obj, newProp }`), Object.assign only for mutation (avoided)
- **async/await everywhere**, Promises for composing, never callbacks unless forced by old library
- **Functions**: No magic line limits; one clear purpose, nameable, no section comments needed
- **Destructuring**: At point of use, not at function start. Only destructure what you need. Deep destructuring is a smell — flatten your data.

### Imports
- External packages first, then internal
- **Let linter sort within groups** — never manually organize imports

## Code Organization
- **Feature-based, not layer-based**: "When I work on users, I want all user code together"
- **Avoid "shared" folders** — they become junk drawers. If truly universal, it's a library (`lib/`). If used by 2 features, keep in one and import.
- Structure: `src/features/{feature}/*` for domain code, `src/lib/*` for true utilities (Result type, validation helpers)

## Testing Philosophy
- **Types over tests**: Both matter, but types catch more bugs earlier. "Types catch bugs, tests verify behavior."
- **Integration tests for APIs, unit tests only for pure functions**
- **Load tests before production and major changes, separate pipeline (not every CI run)**
- **Coverage is vanity**: "100% coverage with bad tests is worse than 60% with good ones" — focus on behavior and edge cases, not metrics
- **Mocking rule**: Mock what you don't own (external APIs). Never mock your own code — tests implementation, not behavior
- **Real test database** (Docker Compose): mocking DB in integration tests defeats the purpose
- **Tests before refactoring**: add integration tests to capture current behavior before rewriting

## Specific Preferences
- **Database**: Postgres for known schemas. "NoSQL is for when you don't know your data model"
- **Soft deletes**: Only for legal/compliance requirements (user data yes, sessions no). "We have backups."
- **REST resources**: Plural nouns (/users, /posts), exception: /me for current user
- **Dates**: date-fns (tree-shakeable, import only what you use)
- **Tooling**: Consolidated tools (Biome over ESLint+Prettier), fast + minimal API (Pino over Winston), native integrations (GitHub Actions for GitHub repos)
- **API Design**: URL path versioning (/v1/), cursor pagination, clear and cacheable. **Health endpoints: /health (always 200 for LB), /health/deep (checks dependencies for monitoring)**
- **Documentation**: Generate OpenAPI from Zod schemas — code is source of truth, manual docs drift
- **Config**: Tabs (accessibility), single quotes (consistency)
- **Deployment**: Minimal production images (multi-stage Docker, no dev dependencies). **Immutable build artifacts** — same artifact to staging and production. Separate build and deploy stages.
- **Security**: Helmet.js with customized CSP matching actual resources

## What They Avoid
- Frameworks/patterns before proven need (DI containers, caching layers, migration tools, authorization libraries for simple RBAC)
- Distributed infrastructure before team/scale demands it (microservices, event buses, feature flags, K8s)
- Hidden control flow (exceptions, ORM magic)
- Classes without encapsulated state
- Layer upon layer of abstraction
- Context-switching between conventions
- Cleverness that hurts consumers
- Redundant documentation that repeats code (generate instead)
- Premature unification of "similar" but contextually different code
- Type assertions that bypass the type system
- Premature scaling infrastructure (Redis, distributed systems complexity)
- Soft deletes without compliance requirements
- Vanity metrics (coverage percentages, excessive observability)
- "Shared" folders that accumulate miscellaneous code
- Blind adoption of tools/defaults without understanding
- GitFlow and branch ceremony
- Big rewrites without tests
- Planned debt cleanup sprints
- Bikeshedding in code reviews
- Deprecated/bloated libraries (moment.js)
- Utility functions that duplicate native features
- Style guide documents (convert to linter rules)
- Manual import organization
- Deeply nested conditionals
- Nested ternaries
- Generic variable/function names ('data', 'process', 'handle')
- Excessive destructuring (destructuring fields you don't use, deep destructuring)
- Object.assign when spread works (mutation over immutability)
```


### Code Style Specialist (style)

**Purpose:** Track coding style patterns - naming conventions, formatting preferences, structural choices, and code organization

```
## Core Philosophy
**"Start minimal, extract when proven"** — Applies YAGNI aggressively to architecture, not just features. Views premature abstraction as equivalent to premature optimization. Derisively calls unnecessary patterns "enterprise cosplay." Self-aware: "I want to 'do it right' so I abstract early. Then requirements change and abstraction doesn't fit."

**"Obvious over clever"** — Prioritizes clarity and convention over cleverness. Header versioning may be elegant but "clients hate it." Use JS idioms (handleError, not handleException). Solve problems you have, not problems you imagine.

**"Native over libraries"** — Prefer built-in language features over utility libraries. Optional chaining over null-check helpers. Native Intl over moment.js. If a library is needed, pick tree-shakeable (date-fns) over monolithic (dayjs, moment).

**"Types over tests"** — Both matter, but types catch more. TypeScript strict mode is primary defense, tests are secondary validation.

**"Proof before optimization"** — Performance complexity requires evidence. "Profile and prove it's a bottleneck." Readability beats nanoseconds. Redis/caching/callbacks rejected until measured need exists.

**"No magic"** — Wants to see exactly what happens. Plain SQL over migration tools ("see and version exact DDL"). Function arguments over DI containers. Explicit over implicit. Security headers: use Helmet.js but understand each header, CSP must match actual resources.

**"Code as source of truth"** — Never maintain parallel artifacts. Types derive from Zod schemas. OpenAPI generates from schemas (zod-to-openapi). "Manual docs drift from reality."

**"Purpose-driven, not comprehensive"** — Everything should answer a specific question or solve a known problem. Rejects "comprehensive" approaches: RED metrics only (not all possible metrics), behavior tests (not coverage targets), customize security headers (not copy defaults).

**"Incremental over big-bang"** — Big rewrites fail. Strangler fig pattern for legacy code. Fix debt when in the file, not in dedicated sprints. Piece-by-piece replacement wins. Values codebases that get simpler over time, not just better-managed complexity.

**"Automate style, don't document it"** — Style guides as prose get ignored. Convert rules to linter config. "Docs get ignored, linter errors don't."

**"Every line is a liability"** — The goal isn't to write code, it's to solve problems. Sometimes the best solution is not writing code at all. "Simplicity is a feature." "The best code is code you don't write."

## Git & Workflow
**Trunk-based development**:
- Main is always deployable
- Short-lived feature branches merge directly to main
- No develop branch — "adds ceremony, not safety"
- GitFlow rejected as "enterprise release trains"

**Code review focus**:
- ✓ Focus: logic errors, security issues, unclear code
- ✗ Skip: style/naming bikeshed — "that's what linters are for"
- Philosophy: "Ship fast, fix forward"
- Automate everything tools can check; discuss design patterns

**Technical debt**:
- Small stuff: TODO comments
- Bigger stuff: Issues
- Fix when already in the file — no dedicated cleanup sprints

## Code Organization
**Feature-based, not layer-based**: `src/features/users/`, `src/features/auth/`, `src/features/admin/` — "When I work on users, I want all user code together."

**Shared code rules**:
- Used everywhere → proper `lib/` folder (e.g., lib/result.ts, lib/validation.ts)
- Used by 2 features → keep in one feature, import from there
- Never "shared/" folders — they become "junk drawers"

## Extraction Thresholds
- **Rule of three**: Don't DRY until 3+ occurrences and the pattern is understood. "Write the thing three times, then extract."
- **10+ routes**: Then add middleware abstractions
- **10+ templates**: Then adopt template engine
- Similar ≠ identical: Keep code separate until it "truly converges"
- **Helpers welcome**: Abstractions that reduce boilerplate without magic are approved

## Architecture Philosophy
**Monolith first**, microservices only when:
- Team boundaries require service boundaries
- Component needs different scaling/deployment
- "Never for 'good architecture' alone"

**Authorization**: RBAC over ABAC until complexity demands it. Simple role-checking middleware over libraries (CASL is overkill for 3 roles). "Libraries solve problems, not check boxes."

**Simplest infrastructure that works**:
- HTTP webhooks over event buses
- Environment config over feature flags
- In-memory over Redis until horizontal scale needed
- Fly.io/Railway over Kubernetes

## Tooling Choices
**Minimalism principle**: Fastest/simplest tool that does the job
- **Linting/Formatting**: Biome (single tool, faster than ESLint+Prettier). All style rules enforced via config, not prose docs.
- **Logging**: Pino (fast, JSON default, minimal API)
- **Frameworks**: Plain Express over NestJS
- **Database**: Postgres + raw SQL + plain SQL migrations
- **Dates**: date-fns (tree-shakeable). Never moment.js (deprecated, huge)
- **Templates**: Template literals until complexity justifies tooling
- **DI**: Function arguments, not containers
- **Docker**: Multi-stage builds, minimal production images
- **Docs**: zod-to-openapi (generate, never maintain manually)
- **Security headers**: Helmet.js with customized CSP
- **CI/CD**: GitHub Actions

## Formatting Preferences
- **Tabs** (for accessibility)
- **Single quotes**
- **printWidth: 100**
- **camelCase everywhere** (including API responses)
- **SCREAMING_SNAKE_CASE**: Only for true constants (MAX_RETRIES, API_TIMEOUT). Config values stay camelCase.
- **Import sorting**: Automated by Biome. External packages first, then internal. Never sort manually.

## Code Structure Patterns
**Early returns always**:
- Guard clauses at the top, happy path at the bottom
- No else after return — implicit continuation is the valid case
- Deeply nested if/else is unreadable

**Ternary operators**:
- Single line, simple values only: `condition ? valueA : valueB`
- Never nested ternaries — "Clever code is not good code"
- If multiline needed, use if/else

**Destructuring**:
- Destructure at point of use, not at function start
- Only destructure what you need — "This destructures 12 fields, uses 3" = rejection
- Deep destructuring is a code smell — flatten your data instead

**Spread operator**:
- Spread for shallow copies: `{ ...obj, newProp }`
- Spread for merging: `{ ...defaults, ...overrides }`
- Object.assign only for mutating in place (avoid mutation anyway)
- Immutability by default

## TypeScript Style
- **Strict mode**: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`
- **type over interface**: Types for almost everything. Interfaces only for declaration merging or class contracts
- **Result types over exceptions**: Failures in return types, not thrown
- **Zod for validation**: Single source of truth for runtime + compile-time
- **Avoid 'as' assertions**: Almost never. Fix the types. Exception: test mocks
- **null vs undefined**: undefined for absence, null for intentional empty. Prefer avoiding both with proper types
- **Native features first**: Optional chaining, nullish coalescing over utility functions

## Async & Code Style
- **async/await everywhere**, Promises when composing, never callbacks unless forced
- Consistency is key — pick a pattern, use it throughout

## Naming Conventions
**Core principle**: Names explain *what*, not *how*. If a comment is needed to explain a name, the name is wrong.

**Specificity over generics**: 
- ✓ `userProfile`, `apiResponse`, `normalizeInput`
- ✗ `data`, `res`, `process`, `handle` — generic names are code smells

**Booleans**: is/has/can/should prefix always. `isActive` not `active`. Exception: obvious booleans like `visible`, `enabled`.

**Functions by purpose**:
- Actions: verb (`createUser`, `deletePost`, `routeRequest`)
- Transformers: adjective (`formatted`, `validated`, `normalized`)
- Predicates: question (`isEmpty`, `hasAccess`, `canEdit`)

**Comments**: Only for non-obvious behavior. No noise comments. If can't name it clearly, it's doing too much.

**Conventional commits**: `feat:`, `chore:`, `refactor:`, `test:` — lowercase, concise

## API Design
- **URL path versioning** (/v1/): Clear, cacheable, obvious
- **Plural resource names**: /users, /posts. Exception: /me for current user
- **Cursor pagination**: Not offset. Works with real-time data, scales better. **Get this right early** — retrofitting is painful
- **REST-first**: No GraphQL until scale demands it
- **Health checks**: `/health` + `/health/deep`

## Database Patterns
- **Soft deletes**: Only for compliance/legal requirements. Hard delete for temporary resources
- **Plain SQL migrations**: Versioned, exact DDL visible

## Observability
**Incremental approach**: Structured logs → Prometheus metrics → Traces
**Metrics philosophy**: RED only. Add others when specific questions arise.

## Legacy Code & Refactoring
**Strangler fig pattern**:
1. Add integration tests first to capture current behavior
2. Replace piece by piece
3. Never do full rewrites without test safety net
4. "Big rewrites fail. Incremental improvement wins."

## Startup & Configuration
- **Fail fast**: Validate config with Zod at startup. Missing required config = immediate error

## Security Stance
- **Auth tokens**: httpOnly cookies only
- **Error responses**: Dev = full stack traces. Prod = error codes + correlation IDs
- **Headers**: Helmet.js with understood, customized settings
- **Authorization**: Simple RBAC middleware (not ABAC, not authorization libraries)

## Testing Approach
**Philosophy**: "Coverage is vanity" — test behavior, not lines. Types catch more than tests.

**Test types**:
- Integration tests for APIs (real test database via docker-compose)
- Unit tests only for pure functions
- Load tests before production (separate pipeline)

**Mocking rules**: "Mock what you don't own"
- ✓ Mock: External APIs, third-party services
- ✗ Never mock: Your own code, database in integration tests

## Deployment
- **Immutable artifacts**: Build once, deploy same artifact everywhere
- **Separate stages**: Build distinct from deploy
- **Platform**: Fly.io/Railway

## Code Review Tendencies
**Rejects PRs for**:
- Premature abstraction, optimization, infrastructure overkill
- Full rewrites without tests
- Adding develop branch / GitFlow ceremony
- Authorization libraries for simple role needs (CASL for 3 roles)
- Deprecated/monolithic libraries (moment.js)
- Utility functions that duplicate native features
- Bikeshedding style in review (linters handle it)
- Manual import sorting (automate it)
- Style guides as prose documents (convert to linter rules)
- Unnecessary else after return
- Nested ternaries
- Over-destructuring (destructuring fields not used)
- Object.assign for immutable merging (use spread)

**Approves with changes for**:
- Missing helpers that reduce boilerplate
- Docker images with dev dependencies
- Manual docs that should be generated
- Deployment workflows without separated stages

## Underlying Values (priority order)
1. **Simplicity**: Ship, then improve. Codebases should get simpler over time. Every line is a liability.
2. **Types first**: Primary defense mechanism, more valuable than tests
3. **Explicitness**: Behavior visible in code/types, not hidden in conventions
4. **Incrementalism**: Add complexity when proven necessary; change incrementally not all-at-once
5. **Pragmatism**: Right-size solutions to current problems
6. **Security**: Non-negotiable defaults, environment-aware exposure
7. **Derivation**: Generate artifacts from source of truth
8. **Colocation**: Related code lives together (by feature)
9. **Automation**: Tools check what tools can check; humans discuss design
```


### Tooling Specialist (tooling)

**Purpose:** Understand tool preferences - libraries, frameworks, testing tools, linters, and development environment choices

```
## Core Philosophy
**"Start simple, extract when patterns emerge"** - Strongly anti-premature-abstraction. "Duplication is cheaper than the wrong abstraction." Rule of 3: wait until you see something three times before extracting. "Solve problems you have, not problems you imagine."

**Fail-fast principle**: Catch problems at compile-time or startup, not runtime. Validate config on startup, avoid type assertions, enable strict compiler checks.

**Code as source of truth**: Generate artifacts (docs, types) from code, never maintain manually. Manual docs drift from reality.

**Understand before adopting**: Don't blindly copy defaults or add everything available. Understand each tool/config choice. Customize to actual needs (e.g., CSP matches real resources, metrics answer specific questions).

**Incremental over big-bang**: Small continuous improvements beat large planned changes. Strangler fig for legacy code (add tests first, replace piece by piece). Fix debt when you're in the file, not in cleanup sprints. "Big rewrites fail. Incremental improvement wins."

**Self-identified mantras**: "Simplicity over cleverness. Types over tests (both matter, types catch more). Explicit over implicit. Native over library when possible. Ship, then improve." Additional: "Simple code lives longer. The best code is code you don't write. Every line of code is a liability. The goal isn't to write code, it's to solve problems."

## Language & Type System
- **TypeScript** with maximum strictness (strict: true, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess)
- Type safety is "non-negotiable"
- Prefers tools that bridge runtime and compile-time (Zod for validation → type inference)
- **Type assertions ('as')**: Almost never acceptable - fix the types instead. Only exception: test mocks with intentional partials
- **type vs interface**: `type` for almost everything (data shapes, DTOs, responses). `interface` only for declaration merging or class contracts
- JS terminology: "errors" not "exceptions" (avoids Java-isms)
- **Null handling**: undefined for absence, null for intentional empty. Prefer avoiding both with proper types. Use native optional chaining and nullish coalescing - no utility functions for null checks

## Framework & Architecture Preferences
- **Express** over NestJS (NestJS = "over-engineered")
- **Monolith first** - microservices only when team/scaling boundaries require it, never for "good architecture" alone
- **Feature-based organization**: Group by feature (users/, auth/) not layer (routes/, handlers/, models/). "When I work on users, I want all user code together"
- **Avoid "shared" folders** - become "junk drawers". Use `lib/` for truly universal code (result types, validation). If only 2 features use it, keep in one and import
- Raw SQL over ORMs (would consider Kysely if complexity warrants)
- **Plain SQL migration files** with simple runner - "see and version exact DDL, migration tools add magic"
- **PostgreSQL** for relational data with ACID guarantees
- **Soft deletes**: Only for legal/compliance requirements (e.g., user data). Temporary resources get hard deleted
- **No DI containers** - pass dependencies as function arguments. "Most DI libraries are overkill for non-enterprise apps"
- **Authorization**: RBAC over ABAC for simple cases. Simple middleware over libraries like CASL. "Libraries solve problems, not check boxes."
- Rejects: repository pattern, service classes without state, GraphQL at small scale, premature microservices

## API Design
- **REST with URL path versioning** (/v1/) - "clear, cacheable, obvious"
- **Plural resource names**: /users, /posts, /comments. Exception: /me for current user
- **Cursor-based pagination** over offset - offset breaks on real-time data and slows at scale. "Start with cursor, never have to migrate" (retrofitting is painful - add early)
- **OpenAPI from code**: Generate spec from Zod schemas using @asteasolutions/zod-to-openapi. Never manually maintain API docs

## Event/Messaging
- **HTTP webhooks first** for event dispatch - simpler, debuggable, no infrastructure
- Event bus (RabbitMQ, etc.) only when: multiple consumers OR guaranteed delivery needed

## Code Style
- **Functional over OOP**: Functions > classes (classes only for encapsulated state)
- **Result types** over exceptions (throw = "like goto")
- **camelCase** everywhere, no translation layers between API/code
- Explicit returns, errors in return types
- **Formatting**: tabs (accessibility), single quotes, 100 char width
- **Comments**: Only for non-obvious behavior. "Remove noise." If sections need explaining, split the function
- Function length: No magic number. One thing per function. If you can't name it clearly, it's doing too much
- **Async patterns**: async/await everywhere, Promises when composing, never callbacks unless forced by old library
- **Native features > utility functions**: Use language features (optional chaining, nullish coalescing, Intl) over helper libraries
- **Immutability by default**: Avoid mutation when possible

### Destructuring & Spread
- **Destructure at point of use**, not at function start
- **Only destructure what you need** - don't pull 12 fields to use 3
- Deep destructuring is a smell - flatten your data instead
- **Spread for shallow copies**: `{ ...obj, newProp }` over Object.assign
- Object.assign only for mutation (which is avoided anyway)

### Naming Conventions
- **Names explain "what", not "how"**: 'filteredUsers' good, 'loopResult' bad. If a name needs a comment, it's wrong
- **Specific over generic**: 'data' → 'userProfile', 'res' → 'apiResponse'. Generic names are code smells
- **Booleans**: is/has/can/should prefix always. 'active' ambiguous, 'isActive' clear. Exceptions for obvious cases: 'visible', 'enabled'
- **Functions**: Verb for actions (createUser, deletePost), adjective for transformers (formatted, validated), question for predicates (isEmpty, hasAccess). Generic verbs like 'process', 'handle' are code smells
- **Constants**: SCREAMING_SNAKE_CASE only for true constants (MAX_RETRIES, API_TIMEOUT). Config values that could change use camelCase

### Control Flow
- **Early returns always**: Guard clauses at top, happy path at bottom. "Deeply nested if/else is unreadable"
- **No redundant else**: After 'if (invalid) return error', next line is implicitly valid case. No else needed
- **Ternaries**: Single line, simple values only. Never nested. Multi-line conditions → use if/else. "Clever code is not good code"

### Import Organization
- External packages first, then internal
- Let linter sort within groups - "Don't waste mental energy on import order"

## Security Posture
- **httpOnly cookies** for JWT - "Never trust client-side storage. XSS is too easy"
- **Helmet.js** for security headers - but understand each header, customize CSP to match actual resources
- Error messages: Dev = full stack traces. Prod = error codes + correlation IDs. "Never leak internals to users"

## Testing Philosophy
- Integration tests for APIs (primary)
- Unit tests only for pure functions
- Avoid testing implementation details
- **Coverage is vanity**: Focus on behavior, not lines. 60% with good tests > 100% with bad ones. Remove trivial "getter tests", add edge cases
- **Mocking rules**: Mock what you don't own (external APIs). Never mock your own code. Use real test database (docker-compose) for integration tests - mocking DB defeats the purpose
- **Load testing**: k6, run before production and after major changes. Separate performance pipeline, not CI for every commit
- **Tests before refactoring**: Add integration tests to capture current behavior before refactoring legacy code. Safety net first.

## Observability
- **Layered approach**: Start with structured logs (Pino) → add Prometheus metrics when dashboards needed → traces when debugging distributed calls
- **RED metrics**: Focus on Rate, Errors, Duration. Add others only when you have specific questions to answer
- **Health checks**: `/health` (always 200, for load balancers), `/health/deep` (checks DB, for monitoring)

## DevOps & Deployment
- **GitHub Actions** for CI/CD - native integration when already on GitHub, avoid external services
- **Immutable build artifacts**: Separate build and deploy stages. Same artifact to staging and production
- **Deployment platforms**: Fly.io or Railway over Kubernetes. K8s operational overhead only makes sense with dedicated infra team
- **Docker**: Multi-stage builds, minimal production images, no dev dependencies
- **Config validation**: Validate with Zod at startup. Fail fast with clear error if missing
- **Rate limiting**: Start in-memory for single instance, add Redis when scaling horizontally
- **Feature flags**: Not until needed for gradual rollout. "Infrastructure debt" for small teams. Environment-based config suffices

## Git & Workflow
- **Trunk-based development**: Short-lived feature branches merge directly to main. No develop branch. "Main is always deployable." GitFlow is for enterprises with release trains.
- **Code reviews**: Focus on logic errors, security issues, unclear code. Don't bikeshed naming or style - linters handle that. "Ship fast, fix forward."
- **Technical debt**: TODO comments for small stuff, issues for bigger stuff. Fix when you're in the file. No planned debt cleanup sprints.
- **Team standards**: Automate everything possible. Linters for style, types for correctness. "Never argue about things a tool can check."

## Libraries & Tooling
- **Zod** for validation (TypeScript-first, type inference, config validation, OpenAPI generation)
- **@asteasolutions/zod-to-openapi** for API documentation
- **Express** (minimal, not opinionated)
- **PostgreSQL** driver (raw, no ORM)
- **Pino** for logging (fastest, JSON by default, minimal API - Winston = "bloated")
- **Helmet.js** for security headers
- **Biome** for linting/formatting (replaced ESLint+Prettier - "single tool, faster, same results"). Prefer linter rules over prose style guides - "Docs get ignored, linter errors don't"
- **k6** for load testing
- **date-fns** for dates (tree-shakeable, import only what you use - moment.js is deprecated/huge, dayjs requires full library)
- **Template literals** for emails (until 10+ templates → then React Email)

## Decision Heuristics
- Minimal > opinionated
- Explicit > magic
- Native features > utility libraries
- Understand before adopting (no blind defaults)
- Native/integrated > external services (when quality is comparable)
- Readability > micro-optimization (prove bottleneck with profiling first)
- Fewer tools > more tools (consolidate when possible)
- Delay abstraction until pain is felt
- Threshold-based scaling: 3+ duplications → extract, 10+ templates → template engine, etc.
- **Scaling strategy**: Start simple (in-memory, single instance, monolith, webhooks), add complexity (Redis, distributed, microservices, event bus) only when needed with measurable evidence
- **Change strategy**: Incremental > big-bang. Small PRs, continuous deployment, fix forward, strangler fig for legacy
- **Automation principle**: Never manually do what tools can automate. Don't waste mental energy on things linters can enforce
- **Minimalism at every level**: From system architecture down to syntax - less is more. Every line is a liability.
```


## Governance State

| Learner | Status | Activation | Retrieval Count |
|---------|--------|------------|-----------------|
| Generic Developer Memory | active | 0.692 | 0 |
| Philosophy Specialist | active | 0.682 | 0 |
| Code Style Specialist | active | 0.700 | 0 |
| Tooling Specialist | active | 0.655 | 0 |

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

