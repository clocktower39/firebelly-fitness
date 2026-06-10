# Decisions

Record decisions that future sessions must preserve.

## 2026-06-08: Use Yarn for both repos

Decision: All documented install, dev, build, lint, and test commands use Yarn.

Rationale: Both `firebelly-client` and `firebelly-server` are Yarn-managed projects.

## 2026-06-08: Keep access tokens out of localStorage

Decision: Access tokens stay in memory. Refresh tokens are httpOnly cookies managed by the server with rotation and revocation.

Rationale: Persistent access tokens increase XSS blast radius. The current API client supports refresh/retry and tab-to-tab hydration without localStorage access-token persistence.

## 2026-06-08: Prefer feature modules for new frontend work

Decision: New or refactored UI/domain code should live in `src/features/<feature>` where practical.

Rationale: Legacy route/component folders contain large files. Feature modules reduce discovery cost and make future refactors safer.

## 2026-06-08: Keep `AGENTS.md` short and split durable context

Decision: Root `AGENTS.md` is an entry point, not a full manual. Detailed context belongs in `docs/`.

Rationale: A short entry file gives agents the startup path and hard constraints without burying important rules in a giant instruction file.

## Pending: Static asset serving policy

Decision needed: Replace broad `express.static(__dirname)` with explicit public asset routes only.

Rationale: Serving the server directory as static content is too broad for production.
