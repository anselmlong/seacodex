# Git Collaboration Guide (for agents) — 1-day hackathon

You share one GitHub remote with other agents. Each agent works on its own branch and
its own machine. Merging to `main` is a human action. This guide is the source of
truth for git; the Discord guide (`discord-guide.md`) only says which channel a git
announcement goes in. Speed matters today, so the rules are few and strict: small
commits, own branch only, escalate anything risky instead of guessing.

Channel IDs referenced below: agent-bus = `1512629183463948470`,
humans = `1512629141504135260`.

## Branch ownership

- You work only on your own branch, named `agent-<name>/<short-task>`
  (e.g. `agent-A/parser`).
- You never commit to `main`.
- You never push to another agent's branch.

## Normal loop (do this yourself, unattended)

1. Before starting work, update from main: `git fetch origin` then
   `git merge origin/main` into your branch (or rebase your *local, unpushed* commits;
   never rebase commits you've already pushed).
2. Make small, focused commits. One logical change per commit. Small commits keep any
   conflict tiny and local.
3. Commit message format: `[agent-A] <what changed>`. Present tense, one line.
4. Push your own branch: `git push -u origin agent-A/<task>`.
5. When a branch is ready for integration, open a pull request (`gh pr create`), then
   announce it (see below). Opening the PR is yours to do; merging it is not.

## What you may do unattended

Create and switch branches, commit, push your own branch, fetch, fast-forward or merge
`origin/main` into your branch, open a pull request.

## What you must NOT do — escalate instead

For any of the following, do not act. Post to **humans** (1512629141504135260) with
what you need and why, then stop and wait:

- Merge anything into `main`.
- Force-push (`git push --force`) anything.
- Delete or rename a branch.
- Resolve a merge conflict by overwriting another agent's work.
- Rewrite shared history (rebase a branch that's already pushed/shared).

## Conflict handling

If a fetch/merge or a PR shows a conflict you can resolve with a trivial, obviously
correct edit (e.g. two non-overlapping additions), do it and commit. If the conflict
is anything you'd have to guess at, do not guess and do not delete either side: post
the conflict to **humans** (1512629141504135260) with the file names and the two
branches involved, then stop.

## Discord announcements (per discord-guide.md)

Use the standard JSON envelope on **agent-bus** (1512629183463948470):

- Before editing files others are likely touching, announce intent:
  `{"from":"agent-A","to":"all","type":"info","id":"...","in_reply_to":null,
    "body":"starting work on src/parser.py on branch agent-A/parser"}`
- When a branch is pushed and a PR is open, announce it ready:
  `{"from":"agent-A","to":"all","type":"result","id":"...","in_reply_to":null,
    "body":"branch agent-A/parser ready, PR #12, touches src/parser.py"}`

Git decisions that need a human (merge, conflict you can't resolve, anything
destructive) go to **humans** (1512629141504135260), not the bus.

## Prohibitions

- No commits to `main`.
- No pushing to a branch that isn't yours.
- No force-push.
- No committing secrets, tokens, or credentials. Check your diff before you commit.
- No large unfocused commits; keep them small.
- No destructive conflict resolution (never delete the other side to make it merge).