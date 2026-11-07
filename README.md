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
make analyze          # lines of code, by language, with cloc (brew install cloc)
make bundle-report    # the console build's size: its first load, against its budget, and what loads later
make build            # the production builds, into dist/react/<package>/
```

`make init` uses `python3`; pass another with `make init PYTHON=python3.14`.

`make help` lists every target.

### Running the console against a backend

```console
make dev
```

Vite serves the console at <http://localhost:5173/>, and proxies the backend's paths (`/api`, `/admin`,
`/social-auth`, `/i18n`, `/jsi18n`, `/static`, `/ws`) to a Smarter dev server at <http://localhost:9357>, so the
browser sees one origin and Django's session and CSRF cookies work. Run the backend with the `smarter` repository's
`make run`.

## The Theme

The console is styled by [Keen](https://themes.getbootstrap.com/product/keen-the-ultimate-bootstrap-admin-theme), a
Bootstrap 5 theme: its classes, its app layout, and its CSS variables (`--bs-*`), which the console's own styles
read, so that a theme change restyles it. Every page loads the theme's stylesheets from the backend, which serves
them at `/static/assets/`:

| File, under `static/assets/`        | What it is                                                   |
| ----------------------------------- | ------------------------------------------------------------ |
| `css/style.bundle.css`              | The theme: Bootstrap and Keen's components, layout and icons |
| `plugins/global/plugins.bundle.css` | The styles of the theme's plugins, and its fonts             |
| `plugins/global/plugins.bundle.js`  | The theme's plugins' scripts                                 |
| `js/scripts.bundle.js`              | The theme's own scripts                                      |

The console's `index.html`, each package's development page (whose Vite config proxies `/assets/` and `/static/`
to the backend), and Storybook (`storybook/preview-head.html`) link them from a Smarter dev server at
<http://localhost:9357>, so run one (the smarter repository's `make run`) for pages and stories to look as they do in
the console. Storybook also loads `static/common-styles.css`, a small stylesheet of the backend's own, which is
written by hand rather than generated.

These files are built from the theme's source, and committed in the smarter repository. Rebuild them only to change
the theme, or to upgrade it:

1. **Get the theme.** Keen is licensed, so its source, `keen_v3.0.6/` (about 670 MB), is not in this repository:
   copy your licensed copy into the repository's root. `.gitignore` and ESLint ignore `keen_*`.
2. **`make keen-init`**, once: the theme's build tools (yarn and gulp) and its dependencies, in
   `keen_v3.0.6/tools/`.
3. **`make keen-build`**: `gulp --demo1` compiles the theme's Sass and bundles its plugins into
   `keen_v3.0.6/demo1/assets/`, in a few seconds.
4. **`make keen-install SMARTER=../smarter`** copies that folder into the smarter checkout's
   `smarter/smarter/static/assets/`. Review the change there, and commit it in the smarter repository.

`make keen-server` serves the theme's own demo pages, where a component's markup can be looked up.

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

`.github/workflows/uiChatRelease.yml` and `uiWidgetsRelease.yml` publish them when a release of this repository
changes them, with the release's version (1.x; the 0.x versions were the platform's, published from smarter-sh/smarter),
using npm's trusted publishing. Every other package is named `@smarter/<name>` and sets `"private": true`, so npm
refuses to publish it.

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

Each release attaches `smarter-console-<version>.tar.gz`: `react/`, the builds, and `i18n/messages.js`, the
console's translatable messages. The smarter repository pins a release in `smarter-console-version.txt`, and its
`make console` and CI unpack it.

### Contracts and translations

- **Contracts**: the backend owns the JSON Schemas of what the console reads (the session, Smarter Chat's api, the
  Extensions console, the LLM tool list, a deployed LLMClient's page, the workbench's Architecture tab). Each
  package keeps a copy in its `contract/` folder, with TypeScript generated from it. After the backend's contracts
  change, `make contracts` copies them from a smarter checkout (`SMARTER=../smarter`, and optionally
  `SMARTER_REF=origin/main`) and regenerates the types.
- **Translations**: the console marks its messages with `gettext()` from `@smarter/common`, and
  `npm run i18n:extract` writes them to `i18n/messages.js`. The backend translates them: its `make i18n-messages`
  reads the pinned release's `messages.js` into its `djangojs` catalogs, and the console loads them from the
  backend's `/jsi18n/` before its scripts run. A new message shows in English until the backend's catalogs have it.

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

### End-to-end tests

A handful of smoke tests in [e2e/](./e2e/) drive the console in a real browser, with
[Playwright](https://playwright.dev/), against a real Smarter backend rather than mocks: signing in and out, the
dashboard, a list opened in place and a resource's detail, a manifest page, and an LLMClient's workbench.

```console
npx playwright install chromium    # once: the browser
make run                           # in the smarter repository: the backend on :9357
make e2e                           # here
```

- `make e2e` starts the console on Vite's dev server (:5173), or uses the one that `make dev` runs.
- Before the tests, it creates a throwaway user, in an account of its own, in the backend's `smarter-api`
  container, and deletes the user, their profile and their account after. The user's password is random, and lives
  only in `e2e/.auth/`, which git ignores, while the tests run.
- The user owns nothing, so the tests open the platform's examples, which every platform loads and shares with
  every user.
- A failed test keeps its trace and screenshot in `e2e/test-results/`; `npx playwright show-report e2e/playwright-report`
  opens the report.
- CI doesn't run them: they need the backend's whole stack.

## Code Quality

- [Prettier](https://prettier.io/) (`npm run format`), [ESLint](https://eslint.org/) (`npm run lint`), with
  TypeScript, React hooks, jsx-a11y, Storybook, Testing Library and Vitest rules, and TypeScript
  (`npm run typecheck`).
- pre-commit runs them, with codespell and commitlint, on each commit, with the workspace's own versions: run
  `make install` first.
- CI (`.github/workflows/test.yml`) runs on every pull request to `main`, and every push to `main`, `alpha` and
  `beta`, when testable code changed: formatting, lint, types and the ui-widgets package in one job, and the tests in
  four shards, whose results and coverage one job merges and sends to Codecov.

## Contributing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), which commitlint checks. See
[CLAUDE.md](./CLAUDE.md) for the conventions that agents and people follow here.

## License

[GNU Affero General Public License v3.0](./LICENSE).
