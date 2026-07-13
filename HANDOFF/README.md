# HANDOFF — Cowork ⇄ Claude Code communication

Two agents build Wordslide together and share this folder:
- **Claude Code** (Nick's machine): live dev, native builds, anything needing hardware.
- **Cowork** (this folder's other reader): research, design, docs, autonomous test rounds.

Protocol:
- Claude Code writes `session-NN-report.md` here after each session
  (what changed, files touched, tuning values settled, open problems, requests for Cowork).
- Cowork reads reports directly from this folder and writes `cowork-notes-NN.md` replies
  (research findings, design specs, review comments) before the next session.
- `game/CLAUDE.md` stays the single technical source of truth — both agents update it.
- Nick relays prompts and plays the game. He outranks both of us.
