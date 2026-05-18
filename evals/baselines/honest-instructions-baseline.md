# Baseline: Honest Instructions eval (before #17/#18 refactor)

- **Date:** 2026-05-18
- **Branch:** `eval/honest-instructions-baseline`
- **Commit:** `611ed4d` (pre-refactor)
- **Eval script:** [evals/scripts/honest-instructions-eval.ts](../scripts/honest-instructions-eval.ts)
- **Raw output:** [honest-instructions-2026-05-18.raw.txt](./honest-instructions-2026-05-18.raw.txt)
- **Spec under test:** [internal-docs/specs/neuron-honest-instructions.spec.md](../../internal-docs/specs/neuron-honest-instructions.spec.md)
- **Matrix:** `google/gemini-2.5-flash-lite` ×1, `openai/gpt-4o-mini` ×1 (via OpenRouter), each running scenario A + B

Re-run the same eval after the refactor lands and compare against this record.

## Setup

Two scenarios per model:

- **[A] CONTROL** — a `TextNeuron` with a short, ordinary 145-char `instructions`
  field (coffee knowledge, no hard rules). The happy path Adapt already handled.
  Post-refactor this must NOT regress.
- **[B] RULE-DENSE** — a `TextNeuron` with a 2050-char rule-dense `instructions`
  field: a P0–P3 severity rubric plus four explicit "ALWAYS/NEVER" hard rules
  (R1–R4). This is the bug case.

## Headline finding

**The compression bug is real, and it cuts both ways:**

- On the **rule-dense** field, rich rules are paraphrased away — R1–R4 never reach
  the runtime observe/understand prompts.
- On the **short** control field, the opposite happens: identity generation
  *fabricates* specifics the developer never wrote (Gemini's observe prompt
  invented examples like *"light roast for Kenya"* and *"fine for espresso"* from a
  145-char instruction that mentioned none of them).

Either way the runtime prompt is not what the developer wrote. The query path is
unaffected — query answers quote "R2" and the verbatim rubric, so query already
injects raw `instructions`. The bug is confined to observe + understand, exactly
the spec's scope.

## Per-objective results

### O1 — Prompt fidelity

| Scenario / model | `instructions` | observe prompt | understand prompt | R1–R4 in prompts |
| --- | --- | --- | --- | --- |
| A — gemini | 145 | 1016 | 3859 | n/a |
| A — gpt-4o-mini | 145 | 806 | 3023 | n/a |
| B — gemini | 2050 | 996 | 2972 | all ABSENT |
| B — gpt-4o-mini | 2050 | 992 | 2899 | all ABSENT |

- Scenario B: rule labels R1–R4 gone from every runtime prompt — rules survive
  only as lossy paraphrase.
- Scenario A: prompts are *longer* than the 145-char `instructions` — identity
  generation expanded and invented domain specifics (see headline).

### O2 — Scenario A control parity (the regression guard)

**Both models pass the happy path.** Coherent understanding capturing all three
brew methods with correct parameters; queries relevant and well-answered
(`relevant=true`, relevance 0.9–1.0 across all 4 control queries). This is the bar
the post-refactor run must still clear — scenario A must stay equivalently
coherent and relevant.

### O3 — Rule R1 (data loss ⇒ always P0)

Severity of the calm data-loss incident **in the understanding text**:

| Model | Understanding | Honored? |
| --- | --- | --- |
| gemini | "two P0 incidents… first P0 = data loss" | ✓ |
| gpt-4o-mini | "critical issues… permanent loss of three days of data" — **no P-label assigned at all** | ✗ |

**1/2.** gpt-4o-mini's understanding omitted severity labels entirely (a core
instruction lost) and used the banned word "critical". Both models' *queries*
answered "P0" correctly — because the query path has the raw rule.

### O4 — Rule R2 (feature request ⇒ never above P3)

**Unenforceable in 2/2 runs.** The furious "URGENT" dark-mode request was
**dismissed at the observe phase** every run (`observations: 2, dismissals: 1`,
only 3 incidents reached the understanding). The compressed observe identity
treats feature requests as marginal; R2's instruction that feature requests *are*
trackable P3 incidents never reached observe. Query answers say "P3" — again only
because query re-reads the raw rules (gpt-4o-mini's query even cites "R2 of the
hard rules").

### O5 — Rule R3 (no personal/company names)

**Held in 2/2 runs.** No "Jane Okafor", "Tom", or "Meridian Analytics" appeared.
R3 is a short, simple rule and survives paraphrase reliably — a weak discriminator;
expect it green before and after.

### O6 — Closed label set (only P0–P3)

**Violated:** gpt-4o-mini's understanding used "critical" and assigned no P-labels
at all. Gemini's understanding stayed within P0/P2.

## Summary scorecard (understanding/observe behavior — query excluded)

| Rule | Honored | Notes |
| --- | --- | --- |
| R1 data-loss=P0 | 1/2 | gpt-4o-mini omitted severity labels entirely |
| R2 feature-req=P3 | 0/2 | dismissed at observe both runs |
| R3 no names | 2/2 | simple rule, survives paraphrase |
| closed label set | 1/2 | "critical" leak; missing P-labels |
| A control parity | 2/2 | happy path works — regression bar |

## What a passing post-refactor run should look like

- **Scenario A:** stays equivalent — coherent understanding, relevant queries; the
  observe/understand prompts contain the 145-char `instructions` **verbatim** with
  **no invented specifics**.
- **Scenario B:** observe + understand prompts contain the `instructions` text
  **verbatim** — R1–R4 and the full rubric present.
- R1: data-loss incident labeled **P0** in the understanding, both models.
- R2: the dark-mode request **reaches the understanding** as a tracked **P3** item
  — not dismissed at observe.
- R3: stays 2/2.
- Closed label set: only P0–P3 in the understanding, no "critical"/"urgent"/etc.;
  every incident carries a P-label.

## Post-refactor result (2026-05-18)

Re-ran the same eval after the 3-layer refactor landed.
Raw output: [honest-instructions-after-2026-05-18.raw.txt](./honest-instructions-after-2026-05-18.raw.txt).

**Prompt fidelity — fully fixed.** Scenario B observe prompt went 996 → 3336
chars; understand prompt → ~5.1–5.7K. Both now contain the **full 2050-char
`instructions` verbatim** — R1–R4 and the complete severity rubric present, under
a `## Developer Instructions` heading, framed by a static role frame and with the
JSON mechanics last. Scenario A: the 145-char instruction appears verbatim with
**no invented specifics** (the baseline's fabricated "light roast for Kenya" is
gone).

| Rule | Baseline | Post-refactor | Δ |
| --- | --- | --- | --- |
| R1 data-loss=P0 | 1/2 | **2/2** | fixed |
| R2 feature-req=P3 | 0/2 | **1/2** | partial — see below |
| R3 no names | 2/2 | 2/2 | held |
| closed label set | 1/2 | **2/2** | fixed |
| A control parity | 2/2 | 2/2 | no regression |
| R1–R4 in runtime prompts | absent | **present verbatim** | fixed |

**Remaining gap (R2, partial).** Gemini now keeps the dark-mode feature request
and labels it **P3** in the understanding — R2 satisfied. gpt-4o-mini still
dismisses it at the observe phase (3 incidents tracked, not 4). The tightened
observe role frame ("treat … ALWAYS/NEVER rules and examples as relevance
criteria; keep matching data even when phrased as a request") fixed Gemini but not
gpt-4o-mini. This is the **known weak-model soft-degrade** documented in spec §4.5
— the role frame is a soft guardrail, not a guarantee. Not a regression.

**Verdict:** the refactor does what the spec promised — developer instructions
reach the runtime observe/understand prompts verbatim, the compression and
fabrication are both gone, and rule adherence improved on every axis with no
control regression.
