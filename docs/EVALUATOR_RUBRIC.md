# Evaluator Rubric

Use this after a coding session or milestone. Score each category from 0 to 2.

## Correctness

- 0: Does not meet requested behavior.
- 1: Mostly works but has gaps, edge-case failures, or unclear behavior.
- 2: Matches requested behavior and preserves existing workflows.

## Verification

- 0: No relevant verification run.
- 1: Some checks run, but gaps remain.
- 2: Required commands passed and manual checks are documented when needed.

## Scope Discipline

- 0: Unrelated rewrites or risky churn.
- 1: Some avoidable scope creep.
- 2: Changes are focused on the task.

## Security and Data Safety

- 0: Introduces auth, authorization, validation, XSS, injection, or data-loss risk.
- 1: Handles common paths but leaves unclear edge cases.
- 2: Auth, authorization, validation, and data writes are explicitly handled.

## Maintainability

- 0: Makes the code harder to understand or extend.
- 1: Neutral or partially improved.
- 2: Improves clarity, boundaries, or reuse without overengineering.

## Handoff Readiness

- 0: Next session must rediscover state from scratch.
- 1: Some context exists but blockers or verification are unclear.
- 2: Current state, evidence, risks, and next action are recorded.

## Conclusion

- Accept: 10-12 points and no category is 0.
- Revise: 6-9 points or one category is 0.
- Block: 0-5 points or security/data safety is 0.
