# AGENTS.md

## Project Overview

Firebelly Fitness is a full-stack personal training platform. The client is a React/Vite app and the server is an Express/MongoDB API with Socket.IO collaboration.

This repository is the system of record. If project behavior, architecture, commands, or priorities matter for future work, document them here or in `docs/`.

## Repositories

- Client: `firebelly-client/`
- Server: `firebelly-server/`
- Shared project docs: `docs/`

Use Yarn in both repos.

## Startup

```bash
cd firebelly-server && yarn install && yarn dev
cd firebelly-client && yarn install && yarn dev
```

Default local frontend: `http://localhost:3000`.

The client Vite proxy targets `VITE_PROXY_TARGET` or `http://localhost:6969`. Keep server `PORT` aligned.

## Verification

Client:

```bash
cd firebelly-client
yarn lint
yarn build
```

Server:

```bash
cd firebelly-server
yarn test
```

If `mongodb-memory-server` fails in a sandbox with `listen EPERM`, note that as an environment limitation and rerun locally.

## Hard Constraints

- Do not persist access tokens in `localStorage`.
- Use `firebelly-client/src/api/client.js` and feature API modules for authenticated HTTP.
- Do not add direct authenticated `fetch()` calls in React components.
- All backend write endpoints must authenticate, authorize, validate input, and avoid mass assignment.
- Use controller/service allowlists before writing request bodies to MongoDB.
- Keep Socket.IO rooms and relayed events authorized by resource ownership or relationship.
- Do not expose secrets or commit real `.env` values.
- Do not serve arbitrary server source files as static assets.
- Preserve user changes in the working tree; do not revert unrelated edits.
- Run the relevant verification command before claiming completion.

## Design Context

Frontend/UI work is governed by two root files (created via the `impeccable` design skill):

- `PRODUCT.md`: strategic design context — register (the app is `product`, the marketing site is a co-equal `brand` surface), users, brand personality (professional, inviting, customizable; **not corporate**), anti-references, design principles, and the WCAG 2.1 AA target.
- `DESIGN.md`: the visual system — North Star "The Coach's Fire", the emerald + flame palette on slate, Montserrat/Roboto type, tonal-first elevation, and component specs. `.impeccable/design.json` is its machine-readable sidecar.

Read both before designing or restyling any screen. The app is MUI today and is migrating gradually to shadcn/Tailwind; new UI work should prefer shadcn+Tailwind while never visually regressing a working MUI flow.

## Topic Docs

- `docs/PROJECT_CONTEXT.md`: product domain, roles, major workflows.
- `docs/ARCHITECTURE.md`: client/server architecture and boundaries.
- `docs/DECISIONS.md`: durable architecture decisions and rationale.
- `docs/TODO.md`: prioritized technical debt and next work.
- `docs/FEEDBACK.md`: review notes and quality observations.
- `docs/SESSION_HANDOFF.md`: current state for long-running work.
- `docs/CLEAN_STATE_CHECKLIST.md`: end-of-session checklist.
- `docs/EVALUATOR_RUBRIC.md`: review rubric for agent output.
- `docs/QUALITY.md`: current codebase quality snapshot.

## Definition of Done

- The implementation matches the requested behavior.
- Existing patterns are followed unless a documented decision says otherwise.
- Client changes pass `yarn lint` and `yarn build`, or the exception is documented.
- Server changes pass `yarn test`, or the environment blocker is documented.
- Security-sensitive changes include authorization and validation review.
- Any durable new decision is added to `docs/DECISIONS.md`.
- Any remaining risk or manual verification is added to `docs/SESSION_HANDOFF.md`.
