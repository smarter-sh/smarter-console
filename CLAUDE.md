# CLAUDE.md

Guidance for Claude Code (and other coding agents) working in this repository.

This is the Smarter web console: an npm workspace whose single-page app, `@smarter/console`, imports the
other packages in `packages/`. The backend is the [smarter](https://github.com/smarter-sh/smarter)
repository; the two meet only over HTTP and through the console's build, which the backend serves
(ADR-035 there).

Detailed know-how lives in the Agent Skills under `skills/` (symlinked to `.claude/skills`). **Load
`smarter-console-development` first for any change.** Its table says which narrower skill covers each
kind of work.

## Hard rules

1. **Never run git write commands.** "Write a git commit" means print the command as text. Never run
   `git commit`, `git add`, `git reset`, `git push` or anything else that changes the index or history.
   Format and authorship are in `smarter-git-commits`.
2. **Run the tests yourself** after any change (`make test`, or `npx vitest run packages/<name>`).
   Never ask the user to re-run them. Report failures honestly, including pre-existing ones.
3. **The pre-commit hooks are the lint standard** (Prettier, ESLint, codespell, commitlint).
   `make lint` runs what CI runs.
4. **This repository is public.** No API keys, tokens, account ids, private hostnames or customer data
   in code, tests, stories, fixtures, docs or skills.
5. **Community open source.** There is no company and nothing for sale: never write pricing, "talk to
   us" or sales copy into the console.
6. **Tests never reach a real server.** Every request in a test or story is answered by MSW; an
   unhandled request fails the test.
7. **Coverage:** at least 95% per package, where that takes moderate effort.

## Repository map

| Path                       | Contents                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| `packages/smarter-console` | The single-page console: routes, frame, docs pages, `lib/`           |
| `packages/smarter-common`  | `@smarter/common`: shared components, the api client, i18n, cookies  |
| `packages/smarter-*`       | The console's pages and widgets, each import-only                    |
| `packages/smarter.sh-*`    | `@smarter.sh/ui-chat` and `@smarter.sh/ui-widgets`, published to npm |
| `storybook/`, `test/`      | Storybook's and Vitest's shared configuration                        |
| `i18n/`                    | The extractor of the console's translatable messages                 |
| `skills/`                  | Agent Skills for developing this repository                          |

## The theme

The console is styled by the Keen Bootstrap theme, whose bundles (`style.bundle.css`, `plugins.bundle.css` and
their scripts) the backend serves at `/static/assets/`. Its licensed source, `keen_v3.0.6/` (about 670 MB), may be
in this checkout's root, but is never committed: `.gitignore` and ESLint ignore `keen_*`. Don't edit, format, lint
or search it; look up a component's markup there, or with `make keen-server`. `make keen-build` and
`make keen-install SMARTER=../smarter` rebuild the bundles into the smarter repository. See README.md, The Theme.

## Common commands

```bash
make init                          # once: venv with pre-commit, npm install, the hooks
make install                       # npm install
make test                          # every package's tests, with coverage
npx vitest run packages/<name>     # one package
make e2e                           # end-to-end tests: Playwright, against a backend on :9357 (smarter's make run)
make lint                          # formatting, lint and types, as CI does
make analyze                       # lines of code, by language, with cloc
make build                         # production builds into dist/react/<package>/
make contracts                     # the backend's api contracts, from ../smarter, and their types
make dev                           # the console on :5173, against a Smarter dev server on :9357
```

## Conventions

- **Pattern first.** Find two or three packages that do the same kind of thing and copy their
  structure, naming, comments and tests. Reuse `@smarter/common`; don't copy code between packages.
- **Text is translatable.** Mark every message the console shows with `gettext()` and friends from
  `@smarter/common`, as whole sentences with named placeholders, then `npm run i18n:extract`.
- **Theme variables.** The console uses the theme's classes and CSS variables (`--bs-*`), not fixed
  colors and sizes.
- **No hard-coded `/static/`** in a built script: the backend may serve the console's files from a CDN.

## Definition of done

- The change follows an existing pattern.
- Tests and stories cover it, and you ran them.
- `make lint` passes.
- Your summary says what changed, what you verified, and what you skipped.
