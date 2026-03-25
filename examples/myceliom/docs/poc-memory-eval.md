# POC: Mycelium

## Goal

Build a minimal working app that demonstrates the core Mycelium experience. Fake data, thin UI — but the actual product loop should work end-to-end: content goes in, threads emerge, the system contextualizes new saves, and user corrections reshape its understanding.

This is a product POC, not a test suite. The output should feel like a stripped-down version of the real thing.

## What Mycelium Is

Mycelium is a personal attention tracker. You save things from everywhere — bookmarks, articles, notes, conversations, products, images, code repos. You don't organize or tag anything. You just save.

The system watches what you save and discovers threads of attention running through your collection. It tells you what you're paying attention to, surfaces connections you can't see, and notices patterns in your behavior (like acceleration before burnout).

## The Four Product Loops

### A. Thread View — "What am I paying attention to?"

The landing screen. Shows the threads the system has discovered:
- List of current threads
- Each thread shows: name, summary, rough activity level
- This is the "three threads are pulling at you" moment

### B. Save & Contextualize — "What does this connect to?"

User pastes a URL or text. The system:
1. Ingests the new content
2. Immediately tells the user what the new thing means in context — which thread(s) it belongs to, whether it's continuation or something new, any patterns ("you've saved 4 of these this month")

This is the on-save moment — the system contextualizes in real time.

### C. Ask — "What have I been avoiding?"

Free-form question box. User types anything, system answers from accumulated understanding.

Example queries:
- "What have I been avoiding?"
- "What connects the wedding and the Daylight Computer?"
- "What threads are dormant?"
- "Am I at risk of burning out again?"

### D. Correct — "These are the same thing"

User can give the system feedback:
- "Merge X and Y — those are the same thread"
- "Split X — those are different interests"
- "Stop tracking X — that's not a real thread"

The system reshapes its understanding based on the correction.

## The Fake Dataset

~50 bookmark-like items spanning 4-5 thematic clusters, plus outliers. Each item has a type, title, context, optional source, and a timestamp spread across 3 months.

Themes:
1. **Building tools for thought** — bookmarking tools, PKM, cognitive exoskeletons, malleable software (~15 items)
2. **Wedding planning** — venues, rings, aesthetic references, planning notes (~10 items)
3. **Energy/recovery** — burnout, pacing, ADHD energy management (~5 items, clustered early then stopping)
4. **Local-first tech** — CRDTs, SQLite, sync engines, offline-first (~8 items)
5. **Misc outliers** — a Hesse quote, a random recipe, a travel article (~5 items)

Items within a theme should NOT share obvious keywords — we're testing semantic understanding, not keyword matching.

Temporal patterns:
- Theme 1: steady throughout
- Theme 2: steady but quieter
- Theme 3: active in month 1, silent after
- Theme 4: burst in month 2-3 (acceleration)
- Outliers: scattered randomly

## What We're Testing

| Loop | User action | System response |
|------|------------|-----------------|
| Discovery | Opens app | "Here are your active threads" |
| Contextualization | Saves new content | "This connects to X, you've been circling this topic" |
| Inquiry | Asks a question | Answers from accumulated understanding |
| Correction | "Merge these two" | Reshapes thread structure |

## What We're NOT Building

- No browser extension or real ingestion pipeline
- No user auth or multi-user support
- No production styling or design
- No real bookmark data
- No deployment — runs locally only
