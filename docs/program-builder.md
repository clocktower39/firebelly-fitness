# Program Builder

Program Builder lets trainers build multi-week training cycles, save drafts, and publish for future marketplace use.

## Draft Workflow
- Creating a program immediately saves a draft (status `DRAFT`).
- Drafts can be updated with title, description, weeks/days, and per-day workouts.
- Draft autosave runs every 10 seconds while there are unsaved changes.

## Publishing Flow
- Publish validates:
  - Title must be present.
  - Weeks and days-per-week must be set.
  - At least one workout must be assigned.
- On success, the program is marked `PUBLISHED` and `publishedAt` is set.
- Publishing errors return a clear list of validation messages.

## Marketplace Readiness
Published programs are queryable by `status = PUBLISHED` and include fields needed for future listings:
`price`, `coverImage`, `tags`, and `category`.

## Tests
- `buildProgramWeeks` preserves existing workout assignments when the grid changes.
- `validatePublish` enforces draft vs publish validation rules.

