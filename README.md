# Smarter Web Console

[![Tests](https://github.com/smarter-sh/smarter-console/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/smarter-sh/smarter-console/actions/workflows/test.yml)
[![Release](https://github.com/smarter-sh/smarter-console/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/smarter-sh/smarter-console/actions/workflows/release.yml)
[![Coverage](https://img.shields.io/codecov/c/github/smarter-sh/smarter-console/main?flag=react&label=coverage&logo=codecov)](https://codecov.io/gh/smarter-sh/smarter-console)
[![Latest Release](https://img.shields.io/github/v/release/smarter-sh/smarter-console?label=release)](https://github.com/smarter-sh/smarter-console/releases)
[![npm @smarter.sh/ui-chat](https://img.shields.io/npm/v/@smarter.sh/ui-chat?label=%40smarter.sh%2Fui-chat&logo=npm)](https://www.npmjs.com/package/@smarter.sh/ui-chat)
[![npm @smarter.sh/ui-widgets](https://img.shields.io/npm/v/@smarter.sh/ui-widgets?label=%40smarter.sh%2Fui-widgets&logo=npm)](https://www.npmjs.com/package/@smarter.sh/ui-widgets)
[![Docs](https://img.shields.io/badge/Read%20the%20Docs-smarter.sh-blue?logo=readthedocs)](https://docs.smarter.sh/)
[![Website](https://img.shields.io/badge/official%20web%20site-smarter.sh-blue?logo=google-chrome)](https://smarter.sh)
[![License: GNU AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Slack](https://img.shields.io/badge/Slack-The%20Smarter%20Project-4A154B?logo=slack&logoColor=white)](https://join.slack.com/t/thesmarterproject/shared_invite/zt-4f0t6v46q-e2c5Of4hS4fBr_XwfQARCw)

The web console of [Smarter](https://github.com/smarter-sh/smarter), the open source platform for building and
running LLM applications: a single-page React app, `@smarter/console`, and the packages it is built from, as one npm
workspace. Smarter Chat, the chat UI that the console's workbench uses and that any web page can embed, is here too,
and published to npm.

The console talks to the Smarter backend only over HTTP: the web console api (`/api/web/`), the public api
(`/api/v1/`), and the session (`GET /api/web/session/`). The backend serves the console's page, and its static files,
from each release's build. See [ADR-035](https://github.com/smarter-sh/smarter/blob/main/docs/source/adr/035-single-page-app.rst).

## Getting Started

You need Node.js 24 and npm, and Python 3 for pre-commit.

```console
make init             # once: a Python venv with pre-commit, npm install, and the pre-commit hooks
make test             # every package's tests, with a coverage report in coverage/
make lint             # formatting, lint and types, as CI checks them
make build            # the production builds, into dist/react/<package>/
```

`make init` uses `python3`; pass another with `make init PYTHON=python3.14`.

`make help` lists every target.

### Running the console against a backend

```console
npm run dev -w @smarter/console
```

Vite serves the console at <http://localhost:5173/>, and proxies the backend's paths (`/api`, `/admin`,
`/social-auth`, `/i18n`, `/jsi18n`, `/static`, `/ws`) to a Smarter dev server at <http://localhost:9357>, so the
browser sees one origin and Django's session and CSRF cookies work. Run the backend with the `smarter` repository's
`make run`.

## Workspace Layout

| Path                      | Contents                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `packages/`               | One package per app or library; see below                                  |
| `packages/smarter-common` | `@smarter/common`: shared components, the Django api client, i18n, cookies |
| `storybook/`              | Storybook's shared configuration                                           |
| `test/`                   | Vitest's shared setup and MSW server                                       |
| `i18n/`                   | The extractor of the console's translatable messages                       |
| `scripts/`                | Shared scripts, e.g. the generation of TypeScript types from a JSON Schema |
| `dist/`                   | The production builds (not committed): `dist/react/<package>/`             |

### The packages

- **The console**, `smarter-console`: the single-page app, its routes, its frame (sidebar, header, user menu) and
  its docs pages. It imports most other packages.
- **Pages the console renders**: the resource lists (`smarter-<kind>-list`), the dashboard, the workbench, the
  manifest editor and drop zone, the Prompt Passthrough, the Terminal, the Extensions console, and the frame's
  widgets (user menu, welcome, onboarding, Did you know?, doodle). Each is import-only: no build of its own, and a
  development page (`npm run dev` in the package) that renders its fixtures.
- **A page the backend renders**: `smarter-llmclient-deployment`, the page that a deployed LLMClient's own host
  shows. Its build is served by Django's template tag.
- **Published to npm**, under the `@smarter.sh` scope, in folders named `smarter.sh-<name>`:

| Package                                                                        | Folder                        |
| ------------------------------------------------------------------------------ | ----------------------------- |
| [@smarter.sh/ui-chat](https://www.npmjs.com/package/@smarter.sh/ui-chat)       | `packages/smarter.sh-chat`    |
| [@smarter.sh/ui-widgets](https://www.npmjs.com/package/@smarter.sh/ui-widgets) | `packages/smarter.sh-widgets` |

Every other package is named `@smarter/<name>` and sets `"private": true`, so npm refuses to publish it.

### Build order

`@smarter/common`, and the libraries that other packages import as builds (`@smarter/didyouknow`,
`@smarter/onboarding`, `@smarter.sh/ui-widgets`, `@smarter.sh/ui-chat`), are built first: `npm run build:deps`.
`make test`, `make lint` and CI run it before anything else.

## How the Backend Gets the Console

`make build` writes the console and the deployed LLMClient page into `dist/react/@smarter/<package>/`, the layout
of the backend's `static/react/`. Each build has a `manifest.json`, which Django reads to find the hashed file
names. The backend serves the console's `index.html` at every console path, and, while
`SMARTER_STATIC_FILES_ON_CDN` is on, rewrites its script and style urls to the environment's CDN. The console's
scripts load their chunks relative to themselves, so they work from either host.

## Stories (Storybook)

Every app documents its components as [Storybook](https://storybook.js.org/) stories, in
[Component Story Format 3](https://storybook.js.org/docs/api/csf): a `Component.stories.tsx` next to each
component, and an `App.stories.tsx` for the whole app.

```console
make storybook APP=smarter-secret-list    # or: cd packages/smarter-secret-list && npm run storybook
```

- Each package's `.storybook/main.ts` and `preview.ts` delegate to [storybook/main.ts](./storybook/main.ts) and
  [storybook/preview.ts](./storybook/preview.ts).
- Stories that call the backend declare its responses as [MSW](https://mswjs.io/) handlers, from the package's
  `src/mocks/`. No backend is needed.
- A story's `play` function scripts a user interaction. It runs in Storybook, and in the tests.

## Testing

The packages are tested with [Vitest](https://vitest.dev/) and
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), in jsdom.

- Tests are `*.test.ts(x)` files next to the code they test. They find elements as a user does, by role and
  accessible name, and act as a user does, with `user-event`.
- Api requests are answered by MSW, with the same handlers as the stories. A request without a handler fails the
  test, so a test never reaches a real server.
- Every story is also a test: each package's `src/stories.test.tsx` renders all of its stories.
- The shared setup, [vitest.shared.ts](./vitest.shared.ts) and [test/](./test/), pins `NODE_ENV`, the time zone and
  the locale, so tests behave the same on every machine and in CI.

## Code Quality

- [Prettier](https://prettier.io/) (`npm run format`), [ESLint](https://eslint.org/) (`npm run lint`), with
  TypeScript, React hooks, jsx-a11y, Storybook, Testing Library and Vitest rules, and TypeScript
  (`npm run typecheck`).
- pre-commit runs them, with codespell and commitlint, on each commit, with the workspace's own versions: run
  `make install` first.
- CI (`.github/workflows/test.yml`) checks formatting, lint, types, the ui-widgets package and the tests on every
  pull request to `main`, and every push to `main` and `alpha`.

## Contributing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), which commitlint checks. See
[CLAUDE.md](./CLAUDE.md) for the conventions that agents and people follow here.

## License

[GNU Affero General Public License v3.0](./LICENSE).
