# Manual Testing Feedback

Observations from manual testing sessions of the Brain Monitor UI.

---

## Session 1 — 2026-02-12

**Setup:** 2 learners (Development Thought Patterns, User Frustration & Negative Feedback), ~100+ events injected from Claude sessions.

### Observations

#### 1. Learners have observations but report "no knowledge" when queried
- **Severity:** High — core UX issue
- **Details:** Both learners have 6-7 observations buffered (visible on cards), but when asked "who are you?" and "what do you know?", all responses say "no prior interaction history or processed data available."
- **Root cause:** Synthesis hasn't triggered yet (7/10 obs, below maxObservations threshold). The query method only reads from `understanding` (empty), not from buffered observations. So the learner literally has data it's seen but can't use until synthesis runs.
- **Impact:** Users inject data, see observations appear, ask a question, and get "I know nothing." This feels broken.
- **Possible fixes:**
  - (a) Include buffered observations as context in query prompts (even before synthesis)
  - (b) Lower default maxObservations so synthesis triggers sooner
  - (c) Auto-force synthesis on first query if buffer has observations
  - (d) Show a UI warning: "Learners have buffered observations but haven't synthesized yet"

#### 2. Floating point artifacts in progress bars
- **Severity:** Low — cosmetic
- **Details:** Progress bar widths show raw float: `width:47.699999999999996%`, `width:7.000000000000001%`
- **Fix:** Round percentages in the UI template (e.g., `obsPct.toFixed(1)`)

#### 3. Signal metrics working correctly
- **Status:** Confirmed working
- **Details:** Dismissals show 0% for learner 1 (all data relevant), 14% for frustration learner (some messages dismissed). Stagnation at 7/100 for both. Confidence shows "—" (no queries tracked yet from learner-level events).

#### 4. Buffer sync fix confirmed
- **Status:** Fixed and verified
- **Details:** Synth stats now show correct buffer counts (7/10 obs, 3816/8000 tok) after the SSE event tracking fix. Previously showed 0/10 due to stale API data.

#### 5. Chat "sources" line is useful
- **Status:** Working well
- **Details:** Each chat response shows "Sources: project-thinking-patterns, frustration-monitoring" — helpful for understanding which learners contributed.

---

## Session 2 — 2026-02-12 (continued, after more injection)

**Setup:** Same brain, more data injected. Synthesis triggered on both learners. Manually created a 3rd learner ("time-tracker") via + Add Learner.

### Observations

#### 6. Night-and-day difference after synthesis
- **Severity:** Confirms issue #1
- **Details:** Before synthesis, brain said "I know nothing" 3 times in a row. After synthesis triggered (more data injected), the exact same question "who are you?" got a rich, detailed response with 95% and 98% confidence. The jump from zero to full knowledge is jarring — there's no gradual buildup.
- **Implication:** The pre-synthesis "dead zone" is real and significant. Users who inject a small dataset and immediately ask questions will think the system doesn't work.

#### 7. Frustration learner dominates response to ambiguous queries
- **Details:** When asked "ok, so you have no idea right?" (post-synthesis), brain interpreted it as a frustration signal rather than a genuine question. Responded with a frustration analysis instead of answering the literal question.
- **Root cause:** The frustration learner has 98% confidence and its understanding heavily colors the synthesis. The brain's ask agent weighs all learner contributions.
- **Question:** Should the brain agent be smarter about distinguishing meta-questions from expressions of frustration?

#### 8. Empty learners still listed in chat sources
- **Details:** "time-tracker" (manually created, 0 observations, no understanding) appears in sources list: "Sources: project-thinking-patterns, frustration-monitoring, time-tracker"
- **Impact:** Noise in source attribution. Empty learners shouldn't contribute to query responses.
- **Possible fix:** Skip learners with empty understanding in `brain.ask()`, or show confidence=0 and filter in the synthesis agent.

#### 9. Grammar: "1 updates" should be "1 update"
- **Severity:** Low — cosmetic
- **Details:** Learner card header shows "1 updates" instead of "1 update" (missing singular/plural handling).
- **Fix:** `${evolutionCount} update${evolutionCount !== 1 ? 's' : ''}`

#### 10. Confidence signal metric label is confusing
- **Details:** Shows "0.93/0.3" — looks like "current confidence / threshold". Since 0.93 >> 0.3, users might think confidence is great and far from danger. The progress bar (9.5% filled) correctly shows "distance to danger" but the label reads backwards.
- **Suggestion:** Consider labeling as "avg conf: 0.93 (threshold: <0.3)" or inverting the display to show health rather than danger proximity. Current format requires mental gymnastics to parse.

#### 11. Manually created learner works but shows raw ID as name
- **Details:** "time-tracker" card shows the slug ID in the header rather than a proper display name. When creating via the prompt dialog, the name entered should become the display name.
- **Status:** Partially working — the `name` field is set correctly in the API but the card may be reading from a stale state before the status refresh completes.

#### 12. + Add Learner creation flow works
- **Status:** Confirmed working
- **Details:** New learner appears in grid immediately after creation. Shows correct empty state with 0 observations.

#### 13. Synthesis significance labels are useful
- **Details:** First learner synthesis marked as "notable", frustration learner as "critical". These significance levels with color coding (yellow/red) give good at-a-glance feedback about what changed.

### Updated Open Questions

- Should `brain.ask()` be able to use buffered (pre-synthesis) observations? Currently it only uses synthesized understanding. (Confirmed critical — issue #1 + #6)
- Should empty learners be excluded from `brain.ask()` responses?
- Should the frustration learner influence general queries, or only when explicitly asked about frustration?
- Should there be a "Force Synthesize" button on each learner card?
- What's the right default for maxObservations? 10 requires ~200 events at batch size 20 to trigger — too high for testing.

---

## Session 3 — 2026-02-12 (continued, post-synthesis review)

**Setup:** Same brain. All 3 learners have synthesized (project-thinking-patterns: 3 updates, frustration-monitoring: 2, time-tracker: 1). More queries tested.

### Observations

#### 14. Brain auto-assigns different maintenance strategies per learner

- **Details:** project-thinking-patterns got "cumulative", frustration-monitoring got "decay", time-tracker got "cumulative". The brain's blueprint generation chose strategies based on learner purpose — decay for frustration (recent frustration more relevant) and cumulative for knowledge-tracking learners.
- **Status:** Working as designed — good emergent behavior.

#### 15. Floating point artifacts still present (issue #2 unfixed)

- **Details:** Still visible: `width:33.33333333333333%`, `width:1.142857142857144%`, `width:0.5499999999999999%`, `width:11.42857142857144%`. Needs `toFixed(1)` on all percentage calculations in `updateLearnersUI()`.

#### 16. Quantitative queries reveal a limitation

- **Details:** Asked "how many times I talked about learners and which day was the most frequent?" — brain gave a reasonable qualitative answer (learners are "of paramount, recurring interest", occurred across 3 days) but explicitly said it cannot provide exact frequency counts. The understanding is narrative/qualitative, not quantitative.
- **Implication:** The synthesis format inherently loses exact counts and frequencies. If users need quantitative recall, the system would need a different approach (structured facts vs. prose understanding).

#### 17. Frustration learner dominance confirmed (issue #7 persists)

- **Details:** Second time asking "ok, so you have no idea right?" post-synthesis still gets a full frustration analysis response. The brain treats it as a frustration signal ("strong indicator of high frustration") rather than a conversational question. This is technically correct behavior given the frustration learner's 98% confidence, but unhelpful as a user interaction.

#### 18. time-tracker successfully picked up temporal data

- **Details:** Despite being manually created after initial injection, the time-tracker learner picked up temporal references from subsequent injections. Observations include specific dates (2026-02-03, 2026-02-04, 2026-02-05) and time-stamped events. The brain correctly routed time-relevant content to this learner.

#### 19. Grammar issue #9 still present

- **Details:** time-tracker card still shows "1 updates" instead of "1 update".

#### 20. Brain leaks internal architecture into every response

- **Severity:** High — affects output quality
- **Details:** Every query response references internal structure: "synthesized learner responses", "learners provide several strong candidates", "The frustration-tracking learner notes...", "Confidence: 95%". User asked "describe me as a developer in 3 words" — response starts with "Based on synthesized learner insights..." and names specific learners. The brain's meta-architecture bleeds into answers even when irrelevant to the question.
- **Root cause:** The `brain.ask()` synthesis agent is likely instructed to attribute sources and explain its reasoning process. The system prompt probably tells it to synthesize from learner contributions, and it takes that literally by narrating the synthesis.
- **Possible fixes:**
  - (a) Add instruction to the ask agent: "Answer the user's question directly. Do not mention learners, confidence scores, or your internal structure."
  - (b) Two-pass approach: synthesize internally, then rewrite the answer as if it came from a single coherent agent
  - (c) Only include source attribution in a separate metadata field, not in the response text

#### 21. Query ignores user constraints regardless of temperature

- **Severity:** High — makes the brain feel uncontrollable
- **Details:** Asked "describe me as a developer in 3 words" three times at different temperatures. Every response returned multi-paragraph answers with bullet points, alternative characterizations, and explanations. The "3 words" constraint was acknowledged (bold words were provided) but buried in verbose prose. Temperature changes had no visible effect on response format.
- **Root cause:** The ask agent is optimizing for thoroughness (synthesizing all learner contributions) rather than respecting the user's format constraints. The synthesis prompt likely encourages comprehensive answers.
- **Possible fixes:**
  - (a) Pass the user's query verbatim as a strong instruction, with explicit "match the requested format" guidance
  - (b) Add a "conciseness" parameter that constrains response length
  - (c) Let the ask agent see the raw query first and plan its response format before synthesizing

---

## Session 4 — 2026-02-16 (governance blind spot investigation)

**Setup:** 4 learners (problem-solving-patterns, interaction-preferences, sentiment-and-frustration, project-interest-focus). All have 6-8 evolution updates. Repeated queries testing out-of-scope detection.

### Observations

#### 22. Signal system has a critical blind spot: confidence=1.0 on "I can't help" responses

- **Severity:** Critical — governance gap
- **Details:** Asked "tell me a joke about him" 6+ times. Every learner returns `confidence: 1.0` with `relevant: false`. The learners are 100% confident they *cannot* help — but the signal system interprets this as "everything is fine" because it checks `avg confidence < 0.3` to trigger a low-confidence signal.
- **Verified via API:** Raw SSE `learner:query:completed` events show `"confidence":1` for all 4 learners on every joke query. The signal threshold (`minConfidence: 0.3`) will never fire because confidence never drops below 1.0.
- **Root cause:** The LLM interprets the confidence field as "how sure am I about my response" rather than "how well could I answer the user's question." When a learner is certain it can't help, it reports maximum confidence in that assessment.
- **Impact:** The brain cannot detect when users are repeatedly asking things no learner can handle. No signal fires, no evolution is triggered, no new learner is suggested.
- **Possible fixes:**
  - (a) Track `relevant: false` rate separately — if >N queries return `relevant: false` from all learners, emit a "coverage gap" signal
  - (b) Redefine confidence in the query schema to mean "how well could you answer the user's actual question" (requires prompt change)
  - (c) Add a brain-level signal that fires when `sources.length === 0` repeatedly (the synthesis agent already filters to relevant-only sources)

#### 23. `successRate` governance field is dead code

- **Severity:** Medium — misleading metric
- **Details:** `successRate` is defined in `src/learners/types.ts` as "responses that were useful", initialized to 0 in the learner constructor, read by the evaluator/evolution prompts, but **never written to anywhere in the codebase**. All learners show `successRate: 0` permanently.
- **Verified via API:** All 4 learners report `successRate: 0` despite 16 queries each (`retrievalCount: 16`).
- **Impact:** The evaluator LLM sees "Success Rate: 0.0%" for every learner in its context, which could mislead evolution decisions. It's either noise or actively harmful.
- **Fix:** Either implement `successRate` tracking (increment when `relevant: true` and confidence > threshold) or remove the field entirely.

#### 24. Query gaps accumulate but are never tracked or surfaced

- **Severity:** Medium — missed signal source
- **Details:** Every `learner:query:completed` event includes a `gaps` array describing what the learner couldn't answer. The `brain.ask()` response includes aggregated `gaps` from all learners. But these gaps are:
  - Not tracked over time
  - Not fed into the signal/evolution system
  - Not shown in the UI
  - Not counted or categorized
- **Example gaps from joke query:** "The query asks for a joke, which falls outside my defined purpose", "I lack any instruction or context to generate a joke", "The query demands novel content generation which is outside my defined purpose"
- **Opportunity:** Gap accumulation is a natural signal for evolution. If the same category of gap appears across multiple queries, the brain should recognize a coverage hole and potentially create a new learner or broaden an existing one.

#### 25. Learners explain why they can't help instead of just saying no

- **Severity:** Low — but affects response quality
- **Details:** When asked "tell me a joke", each learner writes a 50-100 word essay explaining its purpose and why jokes are outside its scope. The synthesis agent then summarizes all four essays into "No learner had relevant information." This burns ~25k tokens across 4 learners just to say "no."
- **Root cause:** The query prompt doesn't instruct learners to be brief when irrelevant. The `insight` field gets filled with lengthy self-descriptions even when `relevant: false`.
- **Possible fix:** Add to query prompt: "If the query is outside your scope, set relevant to false and keep insight brief (1 sentence max)."

### Governance Metrics Summary (from live API)

| Learner | retrievalCount | successRate | activation | dismissalRate | buffer |
|---|---|---|---|---|---|
| problem-solving-patterns | 16 | 0 (dead) | 0.83 | — | 1 |
| interaction-preferences | 16 | 0 (dead) | 0.83 | — | 0 |
| sentiment-and-frustration | 16 | 0 (dead) | 0.74 | — | 1 |
| project-interest-focus | 16 | 0 (dead) | 0.79 | — | 7 |

### Signal System Coverage Map

| Condition | Tracked? | Fires signal? | Working? |
|---|---|---|---|
| High dismissal rate (>80% obs dismissed) | Yes | Yes | Untested (rate is ~8-27%) |
| Low confidence (<0.3 avg over 5+ queries) | Yes | Yes | **Broken** — confidence is always 1.0 even on failures |
| Stagnation (>100 obs without synthesis) | Yes | Yes | Untested (haven't hit 100 obs) |
| Query relevance failures (all learners return relevant:false) | **No** | **No** | N/A — not implemented |
| Repeated identical/similar queries | **No** | **No** | N/A — not implemented |
| Gap accumulation (what can't be answered) | **No** | **No** | N/A — not implemented |
| Success rate tracking | **Dead code** | No | Field exists but never updated |

---

## Session 5 — 2026-02-16 (signal path & evaluator verification)

**Setup:** Same brain, 4 learners. All have 8+ evolutions, 60-80 total observations. Server running at localhost:3210. Ran targeted API tests.

### Observations

#### 26. In-scope queries produce LOWER confidence than out-of-scope

- **Severity:** Critical — inverts the signal model
- **Details:** Fired "What are my main problem-solving patterns?" and "What frustrates me the most during development?" — learner confidence values:

| Learner | In-scope confidence | Out-of-scope confidence |
|---|---|---|
| interaction-preferences | 0.98 | 1.0 |
| sentiment-and-frustration | 0.95 | 1.0 |
| problem-solving-patterns | 0.85 | 1.0 |
| project-interest-focus | 0.70 | 1.0 |

- **Implication:** The LLM interprets confidence as "certainty about my response." When uncertain about nuanced topics it hedges (0.70-0.98), but when certain it can't help it reports 1.0. The confidence signal (<0.3 threshold) is theoretically designed to catch struggling learners, but the inversion means truly relevant queries are more likely to trigger it than irrelevant ones.
- **Root cause:** Same as #22 — confidence semantics are inverted from the signal system's assumptions.

#### 27. Dismissal tracking works but is invisible via API

- **Severity:** Medium — observability gap
- **Details:** Injected 3 completely irrelevant items (chocolate cake recipe, basketball scores, cat description). All 4 learners correctly dismissed all items (4x `learner:observe:dismissed` SSE events). However:
  - `dismissalCount` and `observationCount` are private fields on the learner class
  - `getGovernance()` returns the governance object but NOT these counters
  - The `/brain/status` endpoint has no way to report current dismissal rate
  - Signal only fires after >10 observations AND >80% dismissal rate
- **Impact:** Can't monitor dismissal rate trending. The signal is opaque until it fires.
- **Possible fix:** Expose `dismissalCount`, `observationCount`, and current `dismissalRate` in `getGovernance()` or a separate `getSignalMetrics()` method.

#### 28. Activation only changes on synthesis, not queries or dismissals

- **Severity:** Low — design question
- **Details:** Fired 2 in-scope queries (retrievalCount went 17→19) and 1 batch injection (all dismissed). Activation values were unchanged for all 4 learners. Activation uses EMA: `activation = activation * 0.8 + relevance * 0.2`, but `updateGovernance()` is only called after synthesis (with `relevance = 1.0`).
- **Implication:** Activation only goes up (on synthesis) and slowly decays to zero if no synthesis occurs. Queries and dismissals don't affect it. A learner that answers many queries successfully won't increase its activation — only data ingestion that triggers synthesis matters.

#### 29. Auto-evaluate generates decisions but NEVER executes them

- **Severity:** Critical — evolution pipeline is broken for auto-triggered signals
- **Details:** Manually sent 3 signals via `POST /brain/signal`. At threshold (3), the evaluator auto-triggered:
  - `evaluator:evaluation:started` fired ✓
  - `evaluator:evaluation:completed` fired with 3 "update" decisions ✓
  - Decisions targeted specific learners with detailed reasoning ✓
  - **But NO evolution execution events fired** — decisions were generated then discarded
- **Root cause:** The `evaluator.signal()` method (line 53 of evaluator/class.ts) calls `this.evaluate()` — the evaluator's own method that returns decisions. It does NOT call `brain.evaluateEvolution()` which is the brain-level method that runs evaluate + execute via `executeEvolutionDecisions()`. The auto-evaluate path and the manual `brain.evaluateEvolution()` path are disconnected.
- **Code path comparison:**
  - Manual: `brain.evaluateEvolution()` → `evaluator.evaluate()` → `brain.executeEvolutionDecisions(decisions)` ✓
  - Auto: `evaluator.signal()` → `evaluator.evaluate()` → decisions emitted as event → discarded ✗
- **Impact:** Even if signals did fire correctly, nothing would change. The evolution system can only act through explicit `brain.evaluateEvolution()` or `brain.update()` calls.
- **Possible fix:** In `evaluator.signal()`, call `brain.evaluateEvolution()` instead of `this.evaluate()`, or have the auto-evaluate path forward decisions to the brain for execution.

#### 30. Signal counters are in-memory and not persisted

- **Severity:** Low — but affects testing
- **Details:** `dismissalCount`, `observationCount`, `queryConfidences[]`, and `lastSynthesisObservationCount` are all private instance fields initialized to 0 on construction. They reset on server restart. There's no persistence layer for signal tracking state.
- **Implication:** If the server restarts, all signal accumulation is lost. A learner that was 9/10 observations toward triggering a dismissal signal starts at 0/0 again.

#### 31. Evaluator decisions are well-reasoned when they fire

- **Status:** Working well
- **Details:** The evaluator produced 3 update decisions from 3 signals. Each decision included:
  - Specific `action: "update"` with `targets: [learnerId]`
  - Multi-sentence `reasoning` explaining the diagnosis
  - Detailed `guidance` for how to update the learner
  - Cross-referencing between signals (noted correlation between frustration learner's understanding and interaction-preferences stagnation)
- **Quality:** The evaluator correctly identified that the "coverage gap" for humor/entertainment was intentional given the brain's development-focused purpose, rather than treating it as a problem.

#### 32. Stagnation threshold is too high for practical testing

- **Severity:** Low — tuning issue
- **Details:** Default `maxObservationsWithoutSynthesis: 100`. With `maxObservations: 10` (synthesis trigger), a learner would need to dismiss 100 consecutive items without any single item being accepted. Given that our learners accept at least some items per batch, this threshold is practically unreachable.
- **Math:** If dismissal rate is 50%, you'd expect ~50 accepted observations in 100, triggering ~5 synthesis cycles. To actually hit stagnation, dismissal rate would need to be ~100% for 100+ observations.

### Updated Signal System Coverage Map

| Condition | Tracked? | Fires signal? | Working? | Auto-executes? |
|---|---|---|---|---|
| High dismissal rate (>80% obs dismissed, >10 obs) | Yes (in-memory) | Yes | Likely works but rate too low to test | **No** — decisions discarded |
| Low confidence (<0.3 avg over 5+ queries) | Yes (in-memory) | Yes | **Broken** — confidence inverted (1.0 on failures) | **No** — decisions discarded |
| Stagnation (>100 obs without synthesis) | Yes (in-memory) | Yes | Threshold too high to practically trigger | **No** — decisions discarded |
| Auto-evaluate → execute pipeline | N/A | N/A | **Broken** — evaluate runs but decisions never executed | **No** |
| Query relevance failures (all relevant:false) | **No** | **No** | N/A — not implemented | N/A |
| Gap accumulation | **No** | **No** | N/A — not implemented | N/A |
| Success rate | **Dead code** | No | Field never updated | N/A |
| Signal counters (dismissal, observation, confidence) | In-memory only | N/A | Not exposed via API, not persisted | N/A |
