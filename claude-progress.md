# Progress Log

This file is the short cross-session progress log for coding agents. Keep detailed architecture and review notes in `docs/`.

## Current Verified State

- Workspace: `/home/matt/Programming/Projects/firebelly`
- Client: `firebelly-client`
- Server: `firebelly-server`
- Package manager: Yarn
- Client verification: `cd firebelly-client && yarn lint && yarn build`
- Server verification: `cd firebelly-server && yarn test`
- Current priority source: `feature_list.json`
- Detailed handoff: `docs/SESSION_HANDOFF.md`

## Current Blocker

- None recorded for docs work.
- Known environment caveat: backend integration tests using `mongodb-memory-server` may fail in restricted sandboxes with `listen EPERM`.

## Session Record

### 2026-06-08: Add harness documentation

- Goal: Create efficient agent-readable docs and README files based on harness engineering principles.
- Completed:
  - Added root `AGENTS.md`.
  - Added `init.sh`.
  - Added `feature_list.json`.
  - Added root progress log.
  - Added docs for project context, architecture, decisions, TODOs, feedback, handoff, clean state, evaluator rubric, and quality.
  - Replaced placeholder client/server READMEs with practical setup and architecture docs.
- Verification run:
  - `node -e "JSON.parse(require('fs').readFileSync('feature_list.json','utf8')); console.log('feature_list.json ok')"`
- Evidence:
  - `feature_list.json ok`
- Known risks:
  - Existing uncommitted client change in `firebelly-client/src/App.jsx` was not touched.
- Next best action:
  - Review the docs for accuracy, then update `feature_list.json` as priorities change.
