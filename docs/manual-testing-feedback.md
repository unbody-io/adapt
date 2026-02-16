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
