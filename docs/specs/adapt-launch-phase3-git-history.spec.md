# Adapt Launch — Phase 3: Git History

## Decisions

- **Target branch**: `launch-prep` (fresh branch off `spec/playground`, history rewritten there — original branches untouched)
- **Preserve real dates**: each squashed commit uses the **author date of the first commit** in its group (reflects when work started)
- **Commit messages**: short one-liners, no AI/collaboration attribution
- **After launch**: force-push `launch-prep` as `main`, delete all old branches from remote before making repo public — old SHAs become unreachable and GitHub GCs them

## Squash Plan — 12 Milestones

| # | Commit Message | First Commit | Date | Commits Squashed |
|---|---|---|---|---|
| 1 | `feat: implement TextLearner with cognitive framework` | `cc9ed43` | 2026-01-28 | `cc9ed43..a5a471a` (5 commits) |
| 2 | `feat: implement Brain orchestrator and event system` | `89324b9` | 2026-01-29 | `89324b9..760cb33` (7 commits) |
| 3 | `feat: add two-phase observe/synthesize pipeline` | `9226a07` | 2026-02-01 | `9226a07..0e7cc8c` (7 commits) |
| 4 | `feat: implement evolution system` | `0819825` | 2026-02-03 | `0819825..9140c8a` (30 commits) |
| 5 | `feat: add ListLearner and BaseLearner abstraction` | `22f4afd` | 2026-02-18 | `22f4afd..9384f96` (7 commits) |
| 6 | `feat: implement store persistence layer` | `ef31e38` | 2026-02-19 | `ef31e38..26e1eb6` (18 commits) |
| 7 | `feat: add brain store, restore flow, and state unification` | `b3f1d02` | 2026-02-26 | `b3f1d02..ce4f647` (18 commits) |
| 8 | `feat: add query system and streaming` | `22ee077` | 2026-03-04 | `22ee077..b9260dc` (22 commits) |
| 9 | `feat: implement playground visualization` | `472aa0f` | 2026-03-12 | `472aa0f..ea53ba8` (18 commits) |
| 10 | `feat: add inspect, custom schemas, and pre-launch polish` | `755d529` | 2026-03-25 | `755d529..c62243f` (7 commits) |
| 11 | `refactor: rename Learner → Neuron, rebrand to @unbody/adapt` | `1aaf954` | 2026-04-01 | 1 commit (keep as-is) |
| 12 | `chore: configure package for publishing` | `0974f36` | 2026-04-01 | 1 commit (keep as-is) |

## Tasks

1. **Create `launch-prep` branch from `spec/playground`**

2. **Run squash rebase**
   - Use `git rebase -i --root` on `launch-prep`
   - Mark first commit of each group as `pick`, rest as `squash`/`fixup`
   - For each squashed commit, set author date: `GIT_AUTHOR_DATE="<first commit date>" GIT_COMMITTER_DATE="<first commit date>"`
   - Apply the commit messages from the table above

3. **Verify result**
   - `git log --oneline` shows exactly 12 commits
   - `git log --format="%ai %s"` confirms correct dates
   - `git diff spec/playground` confirms tree is identical (no code changes)

4. **Replace main and clean up remote**
   - Force-push clean history to main: `git push --force origin launch-prep:main`
   - Rename local branch: `git branch -m launch-prep main`
   - Delete all other remote branches (`spec/playground`, feature branches, PR branches)
   - Verify: `git branch -r` shows only `origin/main`
