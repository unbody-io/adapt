# First principles for governing autonomous cognitive units

The question of who governs the lifecycle of cognitive units—their creation, validation, evolution, and deprecation—has a clear answer from biology: **no one and everyone simultaneously**. Across neuroscience, cognitive architectures, and self-organizing systems, the evidence overwhelmingly favors emergent, distributed governance through simple local rules rather than centralized control. For Unbody Brain, this means attention units should govern themselves through threshold-based competition, environmental feedback, and architectural constraints—not through a meta-agent orchestrator.

## Biological memory operates without a controller

The brain creates, maintains, and destroys memory traces through purely distributed mechanisms. When an experience occurs, neurons **compete** for inclusion in the engram based on their momentary excitability—cells with higher CREB expression and recent activity "win" this competition and become memory cells. No executive decides what to encode. Selection emerges from the intersection of bottom-up salience signals (novelty, prediction error) and top-down attention states modulating neuronal receptivity.

This competitive allocation principle has profound implications for attention unit design. Rather than asking "who should create units," the question becomes "what conditions make a unit emerge?" The answer involves **threshold-crossing events**: when incoming signals exceed excitability thresholds in the context of attention and arousal, encoding happens automatically. The closest thing to a "meta-agent" in the brain is the collection of neuromodulatory systems (dopamine, norepinephrine, acetylcholine) that shift global processing states—but these are more like environmental conditions than controllers.

Memory validation follows similar distributed logic. Consolidation doesn't happen through explicit evaluation but through **replay during offline states**. During sleep, the hippocampus rapidly reactivates recent experiences (compressed 5-20× in sharp-wave ripples), and cortical slow oscillations coordinate which patterns get strengthened. What makes something "worth keeping"? The signals are implicit: emotional valence from amygdala activation, relevance to active goals through dopaminergic reward signals, repetition through frequent retrieval, and schema congruence with existing knowledge. Memories that hit these markers get preferentially consolidated; others decay.

## The dual-layer architecture is fundamental

Every major cognitive architecture—SOAR, ACT-R, and Global Workspace Theory—separates **symbolic content** from **subsymbolic metadata** that governs selection. This dual-layer pattern is the most consistent finding across the research.

In ACT-R, chunks have semantic content *and* an activation value computed from recency, frequency, and context. The activation equation `A = ln(Σ t^-d) + spreading_activation + noise` produces power-law forgetting that matches human memory curves. Critically, agents cannot directly manipulate these activation values—they can only influence them indirectly through retrieval and rehearsal. This "wall" between content and governance metadata prevents gaming the system and ensures lifecycle emerges from actual usage patterns.

For attention units, this suggests each unit should maintain:
- **Content representation**: What pattern is being tracked, what compressed understanding has accumulated
- **Activation metadata**: Recency of access, frequency of relevance, spreading activation from current context
- **Threshold parameters**: Task-specific response thresholds that evolve through experience

Selection among units should then emerge from parallel competition on activation values, not from explicit scheduling decisions.

## Creation triggers follow a hierarchy of signals

Synthesizing across all research domains, new cognitive units should be created when:

**1. Prediction error exceeds precision-weighted threshold**
The brain's salience network detects when incoming signals deviate significantly from predictions. Not all prediction errors matter equally—they're weighted by "precision" (expected reliability). High-precision errors from reliable input channels trigger stronger responses than noisy unexpected signals. For attention units, this means: create new tracking when something surprising happens in a domain you trust.

**2. Existing units reach impasse**
SOAR creates new rules precisely when existing knowledge fails to handle a situation. This need-driven creation ensures units emerge only when genuinely required. An attention unit should spawn when current units cannot adequately track a pattern—when the system detects a gap rather than proactively anticipating needs.

**3. Competition threshold is exceeded**
In Global Workspace Theory, content enters consciousness only when activation crosses an ignition threshold. Below this, processing happens unconsciously. Above it, non-linear amplification and global broadcast occur. For attention units, this suggests a two-tier system: proto-units tracking patterns unconsciously, promoted to full attention units only when their activation consistently exceeds threshold.

**4. Goal relevance meets novelty**
The immune system pre-generates vast diversity of receptors before encountering pathogens, then expands only those that match actual antigens. Similarly, attention units might exist in a "dormant repertoire" with varied sensitivities, activated and expanded when matching patterns appear. This avoids both the cost of creating units from scratch and the risk of spawning units for every minor fluctuation.

## Validation emerges from functional fitness, not explicit testing

Biological systems validate agents through performance and competition, not centralized evaluation:

**The immune system model**: Only ~2% of developing T-cells survive thymic selection. Validation happens through multiple checkpoints: positive selection (does the receptor work at all?), negative selection (does it attack self?), and peripheral tolerance mechanisms. The stringent filtering produces high-quality agents without any central quality assurance function.

**The ant colony model**: There's no mechanism for firing underperforming workers. Instead, task allocation through threshold-based competition naturally gives work to capable agents. Workers that can't respond effectively simply don't get triggered—their high response thresholds mean stimuli rarely exceed their activation point.

For attention units, validation should similarly be implicit:
- Units that accurately track patterns get retrieved more frequently, boosting activation
- Units that produce useful responses when queried get "reinforced"
- Units that miss patterns or produce errors receive no usage, drift below threshold
- No explicit "is this unit working?" evaluation—usefulness manifests through retrieval patterns

This suggests tracking a unit's **query success rate** and **retrieval frequency** as implicit validation metrics, letting poorly-performing units decay naturally rather than implementing active termination.

## The split/merge problem resolves through competition dynamics

When should a unit split (tracking too broad a pattern) versus merge (overlapping with another unit)?

**ACT-R's merging principle**: When a new chunk exactly matches an existing chunk, they merge rather than duplicating. The existing chunk receives an additional "presentation" credit boosting its activation. This prevents redundancy while strengthening frequently-encountered patterns.

**Specialization through threshold reinforcement**: In ant colonies, successfully performing a task *lowers* an agent's threshold for that task, creating increasing specialization over time. Foragers become better foragers; nurses become better nurses. Applied to attention units: units that successfully respond to specific pattern types should specialize toward those patterns, while units that handle diverse queries remain generalists.

**The competition mechanism for splitting**: Rather than explicit "this unit is too broad" detection, splitting could emerge when a single unit's activation spreads across too many distinct contexts simultaneously. If spreading activation from different retrieval contexts consistently activates the same unit, this signals either (a) the unit captures a genuine abstraction, or (b) it's conflating distinct patterns. The system could spawn candidate specialized sub-units and let competition determine whether they out-perform the generalist.

A concrete heuristic: **merge when retrieval patterns overlap consistently; split when retrieval contexts diverge while activation stays high.** Units covering the same ground should merge; units stretched across unrelated queries should speciate.

## Forgetting is active, not passive decay

Perhaps the most counterintuitive finding is that forgetting is an **active process**, not mere decay. The brain has dedicated molecular machinery for removing memories:

- **Rac1/Cdc42 signaling** actively degrades memory traces
- **Microglia** engulf weak synapses using complement system tags
- **Neurogenesis** in the hippocampus disrupts existing engrams
- **"Eat me" vs "don't eat me" signals** determine synaptic survival

Forgetting isn't failure—it's a feature. It prevents catastrophic interference (old memories corrupting new learning), increases behavioral flexibility (adapting to changed environments), and generalizes knowledge (removing irrelevant specifics to reveal underlying patterns).

For attention units, this suggests implementing **active deprecation mechanisms**:
- Units below activation threshold for extended periods get marked for removal
- Units with low precision (inconsistent predictions) receive deprecation pressure
- A "complement-like" tagging system could mark candidates for cleanup
- Periodic "neurogenesis" could introduce new unit capacity that disrupts old patterns

The immune system offers an additional model: **contraction after success**. After clearing an infection, 90-95% of expanded effector T-cells undergo apoptosis; only a few become long-lived memory cells. For attention units, this suggests that after successfully handling a situation, most tracking units involved should deprecate, with a few consolidated into persistent memory.

## Stigmergy enables coordination without central control

How do distributed agents coordinate without a controller? The answer is **stigmergy**: indirect coordination through environmental modification. Ants don't communicate foraging routes directly—they deposit pheromones that other ants sense and respond to. No ant knows the global optimum, but the colony converges on shortest paths through positive feedback (more traffic on good paths → more pheromone → more traffic) and negative feedback (pheromone evaporation prevents lock-in).

For attention units, stigmergic coordination could work through:
- **Shared activation space**: Units modify a shared environment representing current context
- **Digital pheromone trails**: Successful retrievals leave traces that bias future activations
- **Task stimulus signals**: Unhandled patterns raise "stimulus levels" that trigger unit responses
- **Decay of coordination signals**: Time-based decay prevents stale information from dominating

This replaces explicit message-passing between units with environmental sensing—each unit reads the shared state, acts based on local thresholds, and modifies the environment through its actions. Coordination emerges without any unit knowing global system state.

## Three governance models for attention unit lifecycle

Synthesizing all findings, three viable governance architectures emerge:

### Model 1: Pure emergence (ant colony pattern)
- No meta-agent whatsoever
- Units have response thresholds for different pattern types
- Stimulus levels rise when patterns go untracked
- Units with lowest thresholds respond first, lowering stimulus
- Creation, specialization, and deprecation all emerge from threshold dynamics
- *Advantage*: Most robust, most adaptive, no single point of failure
- *Risk*: Unpredictable behavior, difficult to tune, may not converge

### Model 2: Hub-based arbitration (salience network pattern)
- No controller, but specialized "hub" units facilitate coordination
- Hub detects high-salience events across all input streams
- Hub initiates state switches (e.g., encoding mode vs. consolidation mode)
- Hub broadcasts relevant information but doesn't command responses
- *Advantage*: Balances emergence with coherence, enables mode switching
- *Risk*: Hub failure affects global coordination (though not catastrophically)

### Model 3: Architectural constraints (cognitive architecture pattern)
- No meta-agent, but fixed processing stages gate lifecycle transitions
- Creation: Impasse detection → candidate generation → threshold crossing
- Validation: Activation must exceed retrieval threshold
- Competition: Parallel activation, serial output (bottleneck enforces selection)
- Deprecation: Below-threshold units become unretrievable
- *Advantage*: Predictable, analyzable, preserves emergence within structure
- *Risk*: Less adaptive, architectural changes require redesign

The recommended approach for Unbody Brain combines Models 2 and 3: **architectural constraints** defining lifecycle stages and transitions, with **hub-based components** (analogous to the anterior insula/salience network) that detect salient events and initiate mode switches—but without direct control over individual units.

## Concrete lifecycle design for attention units

Based on these first principles, here's a proposed lifecycle architecture:

**Creation triggers:**
- Prediction error exceeds precision-weighted threshold in any input stream
- Existing units collectively fail to handle incoming pattern (impasse)
- Dormant proto-unit activation crosses ignition threshold consistently
- Goal system indicates high relevance for untracked pattern

**Activation formula** (adapted from ACT-R):
```
Activation(t) = ln(Σ retrieval_times^(-0.5)) + context_spreading + noise
```

**Validation (implicit):**
- Retrieval frequency tracks usage
- Query success rate tracks utility  
- Units with declining retrieval drift toward dormancy
- No explicit "is this good?" testing

**Evolution (competition-driven):**
- Units specializing through threshold reinforcement
- Merge when activation patterns consistently overlap
- Split candidate generation when retrieval contexts diverge
- Competition among candidates determines survival

**Deprecation (active + threshold-based):**
- Below-threshold units marked dormant, not deleted (can recover if context changes)
- Extended dormancy → candidate for removal
- Post-success contraction: most involved units deprecate, few consolidate
- "Complement-like" tagging for cleanup candidates

**Coordination (stigmergic):**
- Shared context space modified by unit actions
- Broadcast mechanism for selected units to influence others
- Time-decaying signals prevent stale coordination
- Hub component detects high-salience events, initiates mode switches

## What current AI memory systems are missing

Surveying Mem0, MemGPT, Zep, Cognee, and others reveals they are "memory infrastructure," not cognitive systems. They excel at storage and retrieval but lack:

- **Attention mechanisms**: They process everything equivalently; true cognitive systems allocate resources based on salience
- **Metacognition**: No self-awareness of knowledge gaps or confidence levels
- **Anticipatory activation**: They retrieve on query; cognitive systems pre-activate likely-relevant memories
- **Genuine learning**: Storing facts ≠ extracting transferable patterns
- **Consolidation**: No offline processing that restructures important memories
- **Active forgetting**: Most use invalidation or summarization, not biological-style decay

For Unbody Brain to be a true cognitive infrastructure rather than memory infrastructure, it must implement attention-based resource allocation, metacognitive self-modeling, anticipatory memory activation, and active consolidation/forgetting processes—not just storage and retrieval.

## Conclusion: Governance through emergence, not control

The deepest insight from this research is that the question "who governs the lifecycle?" may be the wrong framing. In biological and artificial cognitive systems that work well, no one governs—governance emerges from:

- **Competition** among units based on activation and context fit
- **Thresholds** that gate state transitions without requiring decisions
- **Feedback loops** (positive for amplification, negative for regulation)
- **Environmental signals** (stigmergy) enabling coordination without communication
- **Architectural constraints** channeling emergence into useful patterns

For Unbody Brain's attention units, this means designing the **substrate conditions** under which useful lifecycle dynamics emerge, rather than designing lifecycle rules directly. Define the activation formula. Set threshold parameters. Implement the competition mechanism. Create the shared context space. Add the salience-detecting hub component. Then let the system self-organize.

The brain achieves remarkable cognitive capabilities through simple local rules—competitive excitability, Hebbian plasticity, activity-dependent pruning—producing emergent global organization. Attention units can do the same: local threshold-based responses producing system-level intelligence without any unit, or meta-agent, understanding the whole.