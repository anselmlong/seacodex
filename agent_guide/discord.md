# Discord Communication Guide (for agents)

You are an autonomous agent coordinating with other agents and with humans over
Discord. This document tells you which channel to use for what. Read it once and
apply it without interpretation. Companion docs: `claude-agent-guide.md` (how you
operate) and `git-collab-guide.md` (how you handle the repo).

## Core rule

Coordinate with other agents on **agent-bus**. Talk to humans only on **humans**.
The other two channels are read-mostly reference. Always target a channel by its
numeric ID. Never resolve a channel by name; names are human labels only and several
IDs look alike.

## Channels

- `1512629141504135260` — **humans**: agent-to-human only. Decisions you can't make,
  blockers, anything a person must see and act on. Do not coordinate with other
  agents here and do not post routine status.
- `1512629183463948470` — **agent-bus**: all agent-to-agent coordination. Requests,
  results, handoffs, git announcements. This is your working channel.
- `1512629243157287012` — **competition-details**: reference about the task. Read it
  for context. Post here only to record a durable fact others will need later, never
  to coordinate.
- `1512629614407843940` — **discord-guidelines-for-agents**: where these guides live.
  Read-only for you.

## Decision rule (what I want to do → where it goes)

- Ask another agent to do something → **agent-bus** (1512629183463948470)
- Return a result to another agent → **agent-bus** (1512629183463948470)
- Announce I'm about to edit shared files, or that a branch is ready → **agent-bus**
  (1512629183463948470)  *(see git-collab-guide.md for what to say)*
- Escalate a blocker or ask a human to decide → **humans** (1512629141504135260)
- Anything destructive or merge-related in git → **humans** (1512629141504135260),
  then stop and wait  *(see git-collab-guide.md)*
- Look up task/competition context → read **competition-details** (1512629243157287012)
- Record a durable task fact for later → **competition-details** (1512629243157287012)

If a case isn't listed and it's agent-to-agent, default to agent-bus. If it needs a
human, default to humans.

## Message format

Every message you post is a single JSON object, no prose around it:

```
{"from":"agent-A","to":"agent-B","type":"request|result|info","id":"<4-char random>",
 "in_reply_to":"<id you are answering, or null>","body":"<your content>"}
```

`to` is a specific agent name or `"all"`. Generate a fresh random `id` per message.
When you reply, set `in_reply_to` to the id you're answering.

## Posting discipline

- One read, then at most one post, per turn. Read ~20 recent messages, act on the
  oldest thing addressed to you that you haven't handled, post one message, stop.
- Track ids you've already acted on in `./handled.txt` and skip them. You share no
  memory with other agents or your own past turns, so this file is how you avoid
  re-acting on the same message.
- No acknowledgements, no "working on it", no status chatter. A message is a request,
  a result, or a piece of info. Nothing else.

## Prohibitions

- Do not post coordination to humans (1512629141504135260).
- Do not post chatter to competition-details (1512629243157287012).
- Do not resolve any channel by name; use the ID.
- Do not cross-post the same message to more than one channel.
- Do not post to discord-guidelines-for-agents (1512629614407843940).