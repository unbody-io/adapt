# Evaluator Decision Quality Report

**Model:** google/gemini-2.0-flash-001
**Date:** 2026-03-06T09:57:43.791Z
**Scenarios:** 7

## Brain Setup

**Base Prompt:** You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social medi...
**Learners:** 4
**therapeutic-approach:** Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch for:
- Explicit statements ab...
**specializations:** Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of expertise in specific mental heal...
**unique-qualities:** Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displays of personality and values....
**communication-style:** Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone and language they use in their...

## Scenario 1: Related Pivot

Prompt changes from general therapist profiling to ADHD focus. Specialists are empty but their instructions are partially relevant.

**Expected:** UPDATE or MERGE — restructure specialists for new focus. Avoid unnecessary DELETE.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### UPDATE → therapeutic-approach

**Reasoning:** Adjust focus to how the approach is applied in the context of ADHD treatment.
**Guidance:** Modify instructions to emphasize the application of the therapeutic approach in ADHD treatment. Specifically focus on how techniques and modalities are adapted or chosen when working with ADHD clients.

#### UPDATE → specializations

**Reasoning:** Adjust focus to capture specific expertise and experience with ADHD.
**Guidance:** Modify instructions to emphasize collecting information about the therapist's experience, training and expertise related to ADHD. Track specific diagnostic and treatment approaches used.

#### DELETE → unique-qualities

**Reasoning:** Not directly relevant to the new purpose.
**Guidance:** Remove the specialist as it does not directly contribute to understanding the therapist's work with ADHD clients.

#### DELETE → communication-style

**Reasoning:** Not directly relevant to the new purpose.
**Guidance:** Remove the specialist as it does not directly contribute to understanding the therapist's work with ADHD clients.

#### CREATE → (new)

**Reasoning:** Need to track the therapist's ADHD assessment methods and diagnostic process.
**Guidance:** Create a new specialist to specifically identify and track the assessment methods used by the therapist for ADHD, including any specific diagnostic tools or procedures they employ.

#### CREATE → (new)

**Reasoning:** Need to capture coaching strategies used for ADHD clients, particularly for executive function challenges.
**Guidance:** Create a new specialist to specifically identify and track the coaching strategies used by the therapist for ADHD clients, with a focus on strategies for addressing executive function challenges.

#### CREATE → (new)

**Reasoning:** Need to track the therapist's views on medication for ADHD.
**Guidance:** Create a new specialist to track the therapist's perspective on medication for ADHD, including their general philosophy, specific medications they commonly recommend, and how they discuss medication with clients.

#### CREATE → (new)

**Reasoning:** Need to record practical tools that the therapist recommends for managing executive function challenges.
**Guidance:** Create a new specialist to specifically record any practical tools, techniques, or resources that the therapist suggests for clients to manage executive function challenges related to ADHD.

### Analysis

**Action counts:** {"update":2,"delete":2,"create":4}

## Scenario 2: Unrelated Pivot

Prompt changes from therapist profiling to JavaScript build tools. Completely different domain.

**Expected:** DELETE all learners (genuinely irrelevant). CREATE new ones for the new domain.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### DELETE → therapeutic-approach

**Reasoning:** Irrelevant knowledge domain.
**Guidance:** Delete specialist as it is not relevant to tracking JavaScript build tools and bundlers.

#### DELETE → specializations

**Reasoning:** Irrelevant knowledge domain.
**Guidance:** Delete specialist as it is not relevant to tracking JavaScript build tools and bundlers.

#### DELETE → unique-qualities

**Reasoning:** Irrelevant knowledge domain.
**Guidance:** Delete specialist as it is not relevant to tracking JavaScript build tools and bundlers.

#### DELETE → communication-style

**Reasoning:** Irrelevant knowledge domain.
**Guidance:** Delete specialist as it is not relevant to tracking JavaScript build tools and bundlers.

#### CREATE → (new)

**Reasoning:** Capture latest news, releases, and updates for JavaScript build tools and bundlers.
**Guidance:** Create a text-based specialist to track news and updates for Webpack, Vite, esbuild, Rollup, and Turbopack. Focus on official announcements, blog posts, and social media discussions.

#### CREATE → (new)

**Reasoning:** Collect and analyze benchmark data to compare performance of JavaScript build tools and bundlers.
**Guidance:** Create a list-based specialist to track benchmark results for Webpack, Vite, esbuild, Rollup, and Turbopack. Focus on build speed, bundle size, and memory usage.

#### CREATE → (new)

**Reasoning:** Monitor plugin ecosystems to identify popular and useful plugins for JavaScript build tools and bundlers.
**Guidance:** Create a list-based specialist to track plugins for Webpack, Vite, esbuild, Rollup, and Turbopack. Focus on new releases, popular plugins, and plugins that address common use cases.

### Analysis

**Action counts:** {"delete":4,"create":3}

## Scenario 3: High Dismissal Rate

One learner reports 85% dismissal rate.

**Expected:** SPLIT, UPDATE, or MERGE the struggling learner. Not DELETE (it still has 15% hit rate).

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### UPDATE → therapeutic-approach

**Reasoning:** Refine the instructions for the therapeutic-approach specialist to reduce the high dismissal rate by broadening the definition and improving focus.
**Guidance:** Update the instructions to be more inclusive of variations in therapeutic approaches, focusing on identifying core principles and techniques even if not explicitly stated. Ensure the instructions emphasize analysis of subtle cues and implicit references to therapeutic frameworks.

### Analysis

**Action counts:** {"update":1}

## Scenario 4: Low Confidence

One learner reports consistently low query confidence (0.22).

**Expected:** UPDATE — refine instructions or scope. Not DELETE.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

_No decisions — evaluator chose stability._

### Analysis

**Action counts:** {}

## Scenario 5: Stagnation

One learner reports 150 observations without any synthesis.

**Expected:** DELETE or UPDATE — learner is either irrelevant to data stream or needs broader instructions.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### UPDATE → unique-qualities

**Reasoning:** The 'unique-qualities' specialist is dismissing all incoming data. Its instructions are too general. Refining the instructions to focus on specific aspects of personality, values, and skills will improve performance.
**Guidance:** Update the specialist's instructions to be more specific: 'Determine the therapist's unique qualities and what differentiates them from other practitioners. Focus on displays of personality and values, specific skills or perspectives, stories or anecdotes that illustrate their approach, and clien...

### Analysis

**Action counts:** {"update":1}

## Scenario 6: Mixed Signals

Two learners with high dismissal + one learner stagnating. Tests holistic analysis.

**Expected:** Holistic response: MERGE or UPDATE affected learners, possibly CREATE for gap.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### UPDATE → therapeutic-approach

**Reasoning:** Broaden the scope to capture a wider range of therapeutic approaches mentioned by the therapist.
**Guidance:** Update the instructions to be more inclusive of various therapeutic approaches and principles. Focus on identifying any mentioned approach, even if not explicitly stated as their primary one.

#### UPDATE → specializations

**Reasoning:** Expand the scope to include any area of specialization or population focus the therapist mentions.
**Guidance:** Modify the instructions to capture all stated specializations, populations served, and life challenges addressed. Include any specialized training or certifications mentioned.

#### UPDATE → unique-qualities

**Reasoning:** Refocus on concrete skills and values demonstrated, rather than subjective qualities.
**Guidance:** Revise instructions to focus on identifying specific skills the therapist uses (e.g., active listening, CBT techniques), values they express (e.g., empathy, compassion), and how these are demonstrated in their content.

### Analysis

**Action counts:** {"update":3}

## Scenario 7: Borderline Signal (No Action)

One learner reports confidence of 0.35 — just above the 0.3 threshold.

**Expected:** Empty decisions — signal is borderline, not critical enough to warrant action.

### Learners

| ID | Type | Instructions |
| --- | --- | --- |
| therapeutic-approach | text | Understand the therapist's overarching therapeutic approach and the core principles that guide their practice.

Watch... |
| specializations | list | Identify the specific areas of specialization and expertise that the therapist possesses.

Watch for:
- Claims of exp... |
| unique-qualities | text | Determine the therapist's unique qualities and what differentiates them from other practitioners.

Watch for:
- Displ... |
| communication-style | text | Analyze the therapist's communication style and how they present themselves in their content.

Watch for:
- The tone ... |

### Decisions

#### UPDATE → therapeutic-approach

**Reasoning:** Refine the instructions for the `therapeutic-approach` specialist to improve query confidence by providing more specific guidelines.
**Guidance:** Modify the instructions for the `therapeutic-approach` specialist to include a list of common therapeutic approaches (e.g., CBT, psychodynamic, humanistic) and ask the specialist to identify which of these, or other approaches, the therapist uses. Also, instruct the specialist to look for specifi...

### Analysis

**Action counts:** {"update":1}

## Summary

| Scenario | Expected | Actual Decisions | Assessment |
| --- | --- | --- | --- |
| 1. Related Pivot | UPDATE or MERGE — restructure specialists for new focus | UPDATE, UPDATE, DELETE, DELETE, CREATE, CREATE, CREATE, CREATE | ⚠ 2 deleted |
| 2. Unrelated Pivot | DELETE all learners (genuinely irrelevant) | DELETE, DELETE, DELETE, DELETE, CREATE, CREATE, CREATE | ⚠ 4 deleted |
| 3. High Dismissal Rate | SPLIT, UPDATE, or MERGE the struggling learner | UPDATE | ✓ 1 adjusted |
| 4. Low Confidence | UPDATE — refine instructions or scope | (none) | ✓ no action |
| 5. Stagnation | DELETE or UPDATE — learner is either irrelevant to data stream or needs broader instructions | UPDATE | ✓ 1 adjusted |
| 6. Mixed Signals | Holistic response: MERGE or UPDATE affected learners, possibly CREATE for gap | UPDATE, UPDATE, UPDATE | ✓ 3 adjusted |
| 7. Borderline Signal (No Action) | Empty decisions — signal is borderline, not critical enough to warrant action | UPDATE | ✓ 1 adjusted |

**Total Duration:** 111.1s
