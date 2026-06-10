# Architecture

## Workspace

```text
firebelly/
  firebelly-client/   React/Vite frontend
  firebelly-server/   Express/MongoDB backend
  docs/               Durable project and agent context
```

## Client

The client is a Vite React app using React Router, Redux, Material UI, Socket.IO, and feature API modules.

Important paths:

- `src/api/client.js`: central HTTP behavior, auth headers, credentials, refresh/retry.
- `src/api/*.js`: feature API modules.
- `src/features/schedule`: schedule page decomposition.
- `src/features/workout`: workout page decomposition.
- `src/Redux/actions`: legacy Redux action modules.
- `src/Pages`: route pages, including remaining legacy large files.
- `src/Components`: shared and legacy components.

Rules:

- New feature logic should prefer `src/features/<feature>`.
- Components should call feature API modules or Redux actions, not raw authenticated fetches.
- Access tokens stay in memory. Refresh tokens are server-managed httpOnly cookies.
- MUI v9 slot APIs should be used instead of legacy `*Props` passthrough props.

## Server

The server is an Express 5 app with Mongoose models and Socket.IO.

Important paths:

- `app.js`: middleware, route mounting, Socket.IO setup.
- `routes/`: route definitions and route-level validation.
- `controllers/`: request handlers.
- `controllers/training/`: split workout/training handlers.
- `controllers/groups/`: split group handlers.
- `middleware/auth.js`: access token verification.
- `middleware/ensureWriteAccess.js`: delegated/view-only write guard.
- `services/accessControl.js`: ownership and trainer/client authorization helpers.
- `services/refreshTokenService.js`: refresh token rotation and revocation.
- `models/`: Mongoose schemas.
- `tests/`: node test runner tests.

Rules:

- Route-level validation should exist for every write endpoint.
- Controllers must scope reads/writes by authenticated user, delegated account, relationship, or group membership.
- Mongo writes must use allowlisted fields.
- Socket.IO events that carry resource IDs must be authorized server-side.
- Do not serve the whole server directory as static assets.

## Data Model Areas

- Users and guardian links
- Relationships and trainer connections
- Trainings/workouts
- Schedule events and session types
- Session purchases and billing ledger entries
- Invoices and products
- Programs and group assignments
- Groups, memberships, invites, conversations
- Goals and metric entries
- Refresh tokens

## Verification Boundary

- Client: `yarn lint`, `yarn build`
- Server: `yarn test`
- Manual smoke tests are required for visual or workflow-heavy UI changes until client tests exist.
