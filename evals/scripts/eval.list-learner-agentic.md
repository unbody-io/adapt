# ListLearner Agentic Understand
Semantic eval for ListLearner agentic understand phase. No assertions — logs output for human review.
## Scenarios
- Basic lifecycle (init → learn → query)
- Dedup via tools (feed duplicates, check agent searches before adding)
- Governance post-pass (exceed maxItems, check pruning)
- Dismissed (irrelevant observations produce no changes)
## Domain
Restaurant tracker
