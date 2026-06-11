# Session Handoff

## Current Verified State

- Client package manager: Yarn
- Server package manager: Yarn
- Client verification: `yarn lint`, `yarn build`
- Server verification: `yarn test`
- Known sandbox limitation: `mongodb-memory-server` may fail with `listen EPERM` in restricted environments.

## Latest Context

- Root harness docs were added to reduce repeated project rediscovery.
- Client/server READMEs document setup, commands, environment variables, structure, and verification.
- Priority technical debt is tracked in `TODO.md` and `feature_list.json`.
- Product write routes now have route-level Joi validation, negative integration coverage, and ownership tests.
- Invoice write routes now have route-level Joi validation, negative integration coverage, and ownership tests.
- Integration tests no longer assume `/usr/bin/mongod`; they use that binary only when present and guard MongoMemoryServer teardown.

## Known Risks

- `firebelly-client/src/App.jsx` had existing uncommitted changes when these docs were created. Do not overwrite them without review.
- Backend production hardening still needs work around static serving and Socket.IO event authorization.
- Client still lacks automated tests.

## Next Best Action

Pick one item from `feature_list.json` with the lowest priority number that is not passing. Work on one feature at a time and update this handoff before stopping.

## Commands

```bash
cd firebelly-client && yarn lint && yarn build
cd firebelly-server && yarn test
```
