---
name: commits
description: >-
  Use whenever you write a git commit message in this repo — before running
  `git commit`, drafting a message for the user, or squashing/rewording. Commit
  subjects MUST use a Conventional Commits type prefix (feat, fix, chore,
  refactor, docs, style, test, perf, ci, build, revert). Covers the allowed
  types, when each applies, and the subject/body format. Invoke before composing
  any commit message.
---

# Commit messages

For consistency, every commit message subject starts with one of the types
below, in the form:

```text
<type>: <short imperative summary>
```

Keep the summary in the imperative mood ("add", not "added"/"adds") and under
~72 characters. Add a blank line and a body when the change needs explanation
(what and why, not how); bullet points are fine for multi-part changes.

## Commit message types

```text
feat:       a new feature is introduced with the changes
fix:        a bug fix has occurred
chore:      changes that do not relate to a fix or feature and don't modify src or test files (for example updating dependencies)
refactor:   refactored code that neither fixes a bug nor adds a feature
docs:       updates to documentation such as the README or other markdown files
style:      changes that do not affect the meaning of the code, likely related to code formatting such as white-space, missing semi-colons, and so on.
test:       including new or correcting previous tests
perf:       performance improvements
ci:         continuous integration related
build:      changes that affect the build system or external dependencies
revert:     reverts a previous commit
```

## Picking the type

- Pick the type that matches the **primary intent** of the change.
- A new user-facing capability is `feat:`; correcting broken behavior is `fix:`.
- Dependency bumps that don't touch `src`/tests are `chore:`; if they change the
  build system or bundling, prefer `build:`.
- Pure formatting (Prettier, whitespace) is `style:`; moving/renaming code with
  no behavior change is `refactor:`.
- Markdown/README-only changes are `docs:`.

## Examples

```text
feat: add email/password auth with token refresh
fix: prevent sign-out when refresh token is still valid
chore: bump expo to SDK 56
docs: document env-driven app identity in README
style: format repo with prettier
```
