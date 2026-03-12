# Mycelium Visualization — Visual Design

## Metaphor: Petri Dish Under a Microscope

The entire organism is the Brain. Each learner is a living cell within it. The audience watches biology happen in real-time.

---

## Cell Rendering (Two-Layer Blobs)

Each cell has two visual layers:

1. **Core (dark)** — the solid inner body of the cell. Always present while the cell is alive.
2. **Membrane (semi-transparent outer ring)** — a softer halo around the core. Its size is driven by metrics:
   - **Gaps** accumulated by the learner expand the membrane (the cell is "reaching out" for more data)
   - **Dismissal rate** shrinks the membrane (the cell is contracting, rejecting its environment)
   - A healthy, active learner has a proportional membrane. A struggling one looks visually different.

This gives each cell a visible "health aura" without needing labels or numbers.

---

## Lifecycle Phases

### Birth
- Cells nucleate from the center, one by one as `brain:learner:added` events arrive.
- Each starts as a tiny point that swells into existence over ~1s.
- First learner appears alone. As more emerge, they drift apart, finding space.
- The organism takes shape organically — not placed on a grid, but like cells settling in a culture.

### Idle
- The organism is always alive. Cells breathe at their own rhythms.
- Membranes ripple. Nothing is ever still.
- Even with zero data, the audience feels "this thing is alive."

### Data Injection — Nutrients in the Dish
- Energy ripples inward from the edges of the canvas toward the organism.
- Cells that absorb data (`learner:observed`) swell and brighten momentarily.
- Cells that reject data (`learner:observe:dismissed`) show a subtle contraction — a flinch.
- The effect is brief: you see which parts of the organism are "eating."

### Synthesis — "I Just Understood Something"
- When a learner synthesizes, its cell does a visible **heartbeat**: contracts, then expands larger than before.
- A pulse wave radiates outward through the membrane field.
- The more significant the synthesis (`significance` field), the bigger the pulse.

### Evolution — The Spectacle

- **Split = Mitosis.** The cell elongates, develops a pinch in the middle, then divides into two daughter cells that drift apart. Cell division — the audience immediately gets it.
- **Merge = Fusion.** Two cells drift toward each other, their membranes dissolve between them, they become one larger cell. Like two droplets joining.
- **Create = Spontaneous generation.** A new cell nucleates from empty space near the organism.
- **Delete = Apoptosis.** The cell shrinks, its membrane fades, it dissolves into the background. Programmed cell death.

---

## Health as Visual Intensity

| Signal | Visual Effect |
|--------|--------------|
| High activation | Larger cell, brighter core, wider membrane |
| Dormant | Smaller, dimmer, slower breathing — still alive, just sleeping |
| Distress (signals firing) | Membrane ripples aggressively, like stress |
| High dismissal rate | Membrane contracts (thin/tight aura) |
| Many gaps | Membrane expands (reaching out) |

---

## Architecture

- **Shader = dumb renderer.** Renders N blobs from uniforms: position, radius, life, pulse, activation, membrane size.
- **JS = choreographer.** Handles all animation logic:
  - Interpolating positions for merge/split transitions
  - Fading life in/out for create/delete
  - Decaying pulses after events
  - Computing membrane size from metrics
- This separation keeps the shader simple/fast and puts all intelligence in JS.

---

## Uniform Data Per Blob

```
vec4 u_blobs[MAX]:     x, y, radius, life (0-1 for birth/death fade)
vec4 u_blobData[MAX]:  activation (0-1), pulse (0-1), membrane (0-1), unused
```

- `life`: 0 = not yet born or fully dead, 1 = fully alive. Animated by JS.
- `activation`: from learner health. Controls brightness/size.
- `pulse`: event-triggered glow, decays over ~1s in JS.
- `membrane`: outer ring size, driven by gaps/dismissal metrics.
