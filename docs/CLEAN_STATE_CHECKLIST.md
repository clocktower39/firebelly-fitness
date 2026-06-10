# Clean State Checklist

Run this before ending a long coding session.

- [ ] `git status --short` reviewed in both `firebelly-client` and `firebelly-server`.
- [ ] Unrelated user changes were not reverted or overwritten.
- [ ] Client changes verified with `yarn lint` and `yarn build`, or blocker documented.
- [ ] Server changes verified with `yarn test`, or blocker documented.
- [ ] Manual verification recorded for UI-heavy changes.
- [ ] `feature_list.json` status reflects reality.
- [ ] `docs/SESSION_HANDOFF.md` contains the current verified state and next best action.
- [ ] `docs/DECISIONS.md` updated for durable architecture decisions.
- [ ] No secrets were added to tracked files.
- [ ] No feature is marked done without evidence.
