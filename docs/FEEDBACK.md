# Feedback

## Current Review Notes

- The project is above tutorial level and shows real full-stack domain complexity.
- Strongest areas: auth refactor, feature API modules, workout/schedule decomposition, backend security tests, real scheduling/billing/training domain.
- Weakest areas: inconsistent backend validation, incomplete Socket.IO authorization, missing client tests, remaining large frontend files, and some production-hardening gaps.

## Recurring Failure Modes

- Large files hide missing imports and runtime regressions during decomposition.
- Backend write endpoints can drift if validation is added route-by-route instead of as a consistent policy.
- Realtime behavior is easy to make visually correct while leaving spoofing/authorization gaps.
- MUI major version migrations can produce DOM prop leakage if legacy props are not fully converted.

## Review Checklist

- Does the route/component follow the newer feature module pattern?
- Does every write path authenticate, authorize, validate, and allowlist?
- Is auth state using the centralized API client?
- Is there a test or a clearly recorded manual verification path?
- Did the change introduce a durable decision that belongs in `DECISIONS.md`?
