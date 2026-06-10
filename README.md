# Firebelly Fitness

Firebelly Fitness is a full-stack personal training platform for trainers, clients, guardians, and groups. It combines workout programming, workout logging, realtime trainer/client collaboration, scheduling, goals, progress metrics, groups, billing, invoices, and program management.

This repository contains both the frontend and backend projects.

## Applications

```text
firebelly/
  firebelly-client/   React/Vite frontend
  firebelly-server/   Express/MongoDB API and Socket.IO server
  docs/               Project context, architecture notes, decisions, and TODOs
```

Detailed setup lives in each app README:

- [Client README](./firebelly-client/README.md)
- [Server README](./firebelly-server/README.md)

## Core Features

- Secure login, refresh-token rotation, delegated trainer/client access, and guardian access.
- Workout creation, editing, templates, history, comments, strength sets, and cardio details.
- Realtime workout collaboration through Socket.IO.
- Weekly schedule calendar, session types, bookings, availability, and session tracking.
- Goals, progress metrics, latest metric summaries, and trainer review workflows.
- Trainer/client relationship management.
- Groups, group memberships, invitations, group programs, group chat, and group analytics.
- Programs and program builder workflows.
- Billing ledger, session purchases, products, invoices, payments, PDFs, and invoice email delivery.

## Tech Stack

### Frontend

- React 19
- Vite 8
- React Router 7
- Redux 5 with thunk actions
- Material UI 9
- Socket.IO client
- Recharts
- Yarn

### Backend

- Node.js
- Express 5
- MongoDB with Mongoose 9
- Socket.IO
- JWT access tokens
- httpOnly refresh cookies with server-side rotation and revocation
- Joi via `express-validation`
- Node test runner, Supertest, MongoDB Memory Server
- Yarn

## Quick Start

Install dependencies:

```bash
cd firebelly-server
yarn install

cd ../firebelly-client
yarn install
```

Start the backend:

```bash
cd firebelly-server
yarn dev
```

Start the frontend in a second terminal:

```bash
cd firebelly-client
yarn dev
```

The frontend runs on `http://localhost:3000`.

The client proxies API and Socket.IO traffic through `VITE_PROXY_TARGET` or `http://localhost:6969`. Keep the backend `PORT` aligned with the client proxy target.

## Environment

Client environment files:

- `firebelly-client/.env.development`
- `firebelly-client/.env.live`

Common client variables:

```bash
VITE_PROXY_TARGET=http://localhost:6969
VITE_API_URL=https://firebellyfitness.herokuapp.com
```

Server environment file:

- `firebelly-server/.env`

Common server variables:

```bash
PORT=6969
DBURL=mongodb://127.0.0.1:27017/firebelly
ACCESS_TOKEN_SECRET=replace-me
SALT_WORK_FACTOR=10
CORS_ORIGINS=http://localhost:3000
CLIENT_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
EMAIL_USER=
EMAIL_PASS=
EXERCISE_ADMIN_IDS=
```

Do not commit real secrets.

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

The server integration tests use `mongodb-memory-server`. In restricted sandbox environments, they may fail with `listen EPERM`; rerun locally in a normal shell if that happens.

## Documentation

- [Project Context](./docs/PROJECT_CONTEXT.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Decisions](./docs/DECISIONS.md)
- [TODO](./docs/TODO.md)
- [Feedback](./docs/FEEDBACK.md)
- [Quality Snapshot](./docs/QUALITY.md)
- [Agent Instructions](./AGENTS.md)

## Development Principles

- Use Yarn for both apps.
- Keep access tokens out of `localStorage`; use the centralized API client and secure refresh-cookie flow.
- Add backend validation and authorization to every write endpoint.
- Scope data access by authenticated user, delegated account, trainer/client relationship, or group membership.
- Prefer feature modules for new frontend work.
- Keep durable architecture decisions in `docs/DECISIONS.md`.
- Run the relevant verification commands before committing.

## Current Priorities

The active project backlog is tracked in [feature_list.json](./feature_list.json) and [docs/TODO.md](./docs/TODO.md).

Top priorities:

1. Finish backend write-route validation coverage.
2. Harden Socket.IO authorization for relayed events.
3. Continue decomposing large frontend files.
4. Add a client test foundation.
5. Review database indexes and schema constraints against real query patterns.
