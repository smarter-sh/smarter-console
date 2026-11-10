---
name: smarter-console-development
description: Start here for any change to the Smarter web console's npm workspace (this repository, smarter-sh/smarter-console) - the single-page console @smarter/console, the resource list packages (smarter-<kind>-list), the workbench, the frame's widgets, the docs pages, @smarter/common, and the published @smarter.sh/ui-chat and ui-widgets. Gives the rules, how the console meets the Smarter backend, the package patterns (list packages, importable packages, public pages), the build that the backend serves, and an index of the narrower skills.
---

# Smarter Web Console Development

This repository is the Smarter web console: one npm workspace, `packages/*`, whose single-page app,
`@smarter/console`, imports the others. The backend is the
[smarter](https://github.com/smarter-sh/smarter) repository, a Django platform. The two meet only over
HTTP, and through the console's build, which the backend serves (ADR-035).

## Rules

1. **Never run git write commands.** "Write a git commit" means print the command. See
   `smarter-git-commits`.
2. **Run the tests yourself** after any change (`make test`, or `npx vitest run packages/<name>`), and
   report failures honestly. Read the "Test Files" line, not only "Tests". See `smarter-react-testing`.
3. **The pre-commit hooks are the lint standard**: Prettier, ESLint, codespell, commitlint.
   `make lint` runs what CI runs.
4. **This repository is public.** No keys, tokens, account ids, private hostnames or customer data.
   **No secrets, credentials or PII in a `console.*` call or a logged error either**: no api key,
   token, CSRF token, cookie, Secret value, email address, name or prompt text, and no whole session,
   response, headers or form object. In DEBUG mode the console shows Smarter's log to ordinary users,
   so a leaked value there is as bad as one pushed to this repository. Log ids and counts instead.
5. **Community open source.** No sales language in the console's text.
6. **Pattern first.** Find two or three packages that do the same thing (prefer the newest: the
   guardrail and secret lists, the console's docs pages) and copy their structure. Reuse
   `@smarter/common` rather than copying code between packages; the third copy is the signal to move it
   there.
7. **Coverage** of at least 95% for each package, where that takes moderate effort.

## How the console meets the backend

- **The session**, `GET /api/web/session/`: who the user is, the account, branding, flags, languages,
  the sidebar's links, the SAM kinds. Its types, `src/contract.gen.ts`, are generated from the
  backend's JSON Schema (`npm run contract:types -w @smarter/console`).
- **The web console api**, `/api/web/<app>/`, and the public api, `/api/v1/`. Calls carry the session
  cookie, and POSTs the CSRF token (`src/lib/api.ts`, or `fetchDjangoUrl` in `@smarter/common`).
- **Contracts**: a package that reads a backend model has the model's JSON Schema in its `contract/`
  folder, and TypeScript generated from it (`npm run contract:types`). The backend owns the schema:
  after it changes, `make contracts` (`scripts/sync-contracts.sh`) copies all six from a smarter
  checkout, optionally at a git ref, and regenerates their types. Never edit a copy by hand.
- **Translations**: messages are marked with `gettext()` and friends from `@smarter/common`;
  `npm run i18n:extract` writes `i18n/messages.js`, and a test fails when it is out of date. Each
  release's tarball carries it, and the backend translates it: its catalogs (the `djangojs` domain)
  are built from the pinned release's `messages.js`, and loaded from `/jsi18n/` before the console's
  scripts run, which is why module-level constants may call `gettext()`.
- **The build**: `make build` writes the console and the deployed LLMClient page into
  `dist/react/@smarter/<package>/`, the layout of the backend's `static/react/`. The backend serves the
  console's `index.html` at every console path.
- **Local development**: `npm run dev -w @smarter/console` on port 5173 proxies the backend's paths to a
  Smarter dev server on port 9357 (the `smarter` repository's `make run`).

## Which skill to load

| Task                                             | Skill                      |
| ------------------------------------------------ | -------------------------- |
| Stories, tests, MSW, ESLint, Prettier, coverage  | `smarter-react-testing`    |
| Smarter Chat (`@smarter.sh/ui-chat`): any change | `smarter-chat-development` |
| Smarter Chat's tests and stories                 | `smarter-chat-testing`     |
| Smarter Chat's embed script                      | `smarter-chat-embed`       |
| Writing a commit                                 | `smarter-git-commits`      |

## The React side

- **A list package is import-only**: its `src/index.ts` exports `<Kind>List`, its `App`,
  which takes `sessionContext` (and may take `onboarding`). Its `main.tsx` is a development
  page that renders it from `src/mocks/fixtures.ts`, and it has no build. A page that Django
  still hosts has a `main.tsx` that reads its root element's attributes, throws if a
  required one is missing, builds a `SessionContext`, and renders `<App>`.
- **`fetchDjangoUrl(sessionContext, url, requestJson)`**
  (`@smarter/common`, `lib/django.tsx`) POSTs with the `X-CSRFToken` header,
  read from the CSRF cookie, plus `X-Smarter-Client`,
  `X-Smarter-ClientVersion`, `X-Smarter-ClientType`, `X-Smarter-RequestId`, and
  `X-Smarter-Capabilities`. A new custom header must also be added to Django's
  `CORS_ALLOW_HEADERS` in the `smarter` repository's `smarter/smarter/settings/base.py`.
- **`load()`** (`lib/load.tsx`) fetches `<ApiUrl>/<owned|shared|all>/?invalidate_cache=...`
  and reads `objects`; it is the query function of `TabbedListView`'s pages.
  Each page is a TanStack Query query (`lib/query.tsx`), keyed by
  `listQueryKey(apiUrl)`, the tab, and the page's number, search, ordering and
  narrowing. A page seen before shows at once, with a "Refreshing" spinner,
  while it is fetched again. The console's QueryClient lives in memory, and
  starts empty for each user and account (`lib/queryCache.ts`); outside the
  console, `SmarterQueryProvider` and `useSmarterQueryClient()` give a package
  a client of its own. Invalidate a list with
  `queryClient.invalidateQueries({ queryKey: listQueryKey(apiUrl) })`.
- **`actionUrl(sessionContext, "clone/12/new_name/")`** turns the list URL into
  its sibling action URL.
- **`TabbedListView`** (`@smarter/common`) gives the owned/shared tabs. A list
  is a `ListView` (table) and a `DetailView`, with a `Toolbar` and a
  `StatusBar`. There is no card view.
- **Choosing a row opens its detail.** `TabbedListView` listens for clicks and
  Enter on the ListView's rows, and opens `ResourceDetail`, a dialog whose tabs
  are the list's `DetailView` (one object), the resource's manifest, the
  hierarchy of what it uses, and what uses it. The last three come from the
  row's `detailUrl`, which `MetaDataWithOwnershipModelSerializer` adds
  (`smarter.apps.dashboard.resource_detail`); a row without one, e.g. an
  Extension's, has the Details tab only. The rules for a ListView: exactly one
  `<tr>` per object, directly in `<tbody>`, loading rows with class `ghost`
  (the row's index among `tbody > tr:not(.ghost)` is its object's), and the Name
  cell is plain text, not a link. Clicks on a row's links, buttons and chips do
  what they do instead.
- **A `DetailView`** is built from `DetailOverview` (description, status,
  Toolbar), `DetailSection`s of `DetailField`s (typed: `text`, `code`, `url`,
  `dateTime`, `number`, `bool`, `json`, `list`), and `ResourceMetadataSection`
  (owner, account, version, ids, dates, tags, annotations), all from
  `@smarter/common`. Never copy a `renderDetail` helper into a package.
  See `smarter-guardrail-list/src/components/DetailView/`.
- **Tags and annotations**: a `DetailView` gets them from
  `ResourceMetadataSection`, and a ListView may render `TagChips` and
  `AnnotationChips`, passing the `filtering` prop that `TabbedListView` gives
  it, so that clicking a chip narrows the list. Its props interface declares
  `filtering?: Filtering`. `TabbedListView` sends `?tag=` and
  `?annotation=` (each repeatable), and `SmarterListApiView` applies them, so a
  new list api needs nothing for them. A new list api is also searched by the
  dashboard's global search (`smarter.apps.dashboard.search`), through
  `listview_registry()`, which pairs it with the `<Kind>ListView` page of the same
  urlconf: keep that naming, or `test_every_list_api_has_its_page` fails. Set
  `listview_label` when the model's plural verbose name is a poor label.
- **A list's `Toolbar` is `ResourceToolbar`** (`@smarter/common`): Edit (the
  manifest page), and Clone, Rename and Delete through the list api's actions,
  as a TanStack Query mutation, with its dialogs. The package's
  `Toolbar/Component.tsx` only passes it the resource and the kind's
  `ToolbarMessages`: whole sentences with `gettext()`, e.g.
  `gettext("Rename guardrail %(name)s.")`, never assembled from the kind's name.
  `links` adds the list's own links before Edit (the LLMClient's workbench), and
  `messages.deleteWarning` says what a deletion destroys (Vector Stores). Copy
  `smarter-guardrail-list/src/components/Toolbar/Component.tsx`; never copy the
  toolbar's code. The custom domain and LLM Host Compute lists, whose actions
  differ, keep toolbars of their own.
- The list API's serializer sends `can_delete`, which arrives camel-cased as
  `canDelete`. `ResourceToolbar` disables its Delete button when
  `canDelete === false`, with the title `deleteForbiddenTitle`, which explains
  why. The server still enforces deletion, and the toolbar shows its error
  message when a delete fails.
  Budgets aren't owned resources: their list shows Delete only when the API
  reports `isSuperuser`.
- The API camel-cases every field (`manifest_url` → `manifestUrl`). Search the
  React code for the camelCase name.

## Creating a new list package

Copy the closest existing list package, then rename it everywhere.
`smarter-guardrail-list` is the reference.

1. `cp -R packages/smarter-guardrail-list packages/smarter-<kind>-list`
   (without `node_modules`, `dist`, `CHANGELOG.md`, or `.DS_Store`).
2. Rename it in `package.json` (`name` and `description`; keep `"private": true`, `main`
   and `exports`), `index.html`, `main.tsx` (the root id), `src/index.ts` (the export's
   name), `lib/const.tsx`, and `README.md`.
3. Replace the `Types.tsx` object type, and the table columns and the
   DetailView's sections, with the new serializer's fields.
4. Update the stories, the MSW fixtures and handlers, and the tests. See
   `smarter-react-testing`.
5. Add it to the console's `src/lib/lists.ts` (`LIST_PAGES`): its path (the backend's page path
   without its trailing slash), its list api, and a lazy `load()`, and add the package to the
   console's `package.json`. The backend adds the list api and the page that serves the console at
   that path (the `smarter` repository's `smarter-django-react` skill). Then `make install` and
   `make test`.

## One package that imports another

A console app can render another package's component. For example, the Prompt Engineer's Workbench
(`smarter-workbench`) renders the manifest editor, the LLMClient architecture and the LLMClient deployment
page in its Console's tabs, and imports Smarter Chat. The workbench and the Prompt Passthrough both render the
server log viewer, `smarter-serverlogs`, in their Server Logs tabs: one package, rather than a copy in each. A package that exists only to be imported, such as
`smarter-llmclient-architecture`, has no `build` script: `npm run dev` renders its fixtures, and the importing
package's build bundles it. The workspace's shared configuration maps `@/` to the _importing_
package's `src/`, so a package whose source another package imports follows these rules:

- **Its source uses relative imports**, not `@/`, as `@smarter/common`'s does. Its tests, stories and
  mocks may keep `@/`, because they run only in their own package. `smarter-manifest-editor`,
  `smarter-llmclient-architecture`, `smarter-llmclient-deployment` and `smarter-serverlogs` do this.
- **Its `package.json` exports its source**: `"main"` and `"exports": {".": "./src/index.ts"}`.
  `src/index.ts` exports the component and its props type. Fixtures that other packages' tests
  use are exported as a subpath, e.g. `"./mocks"` in `smarter-llmclient-deployment`.
- **A component that was a page takes callbacks** in place of whatever it did to its page or a
  framing page, e.g. the manifest editor's `onSaved` and `onDeleted`.
- **Smarter Chat is the exception.** It is a published npm library (`@smarter.sh/ui-chat`), with
  `@/` imports, so the workbench imports its built library (`packages/smarter.sh-chat/dist/`), as
  npm users do. `npm run build:deps` builds it and `@smarter/common`; `make test`,
  `make lint` and CI run it first.

Don't frame a console page in an iframe to reuse it: export its component instead.

## A public page: the docs

The docs pages (`/docs/...`) are the console's routes outside `RequireAuth`, in their own frame,
`routes/DocsLayout`, so a visitor reads them without signing in. Their data must be public too: the
session's `samKinds`, the cli api's `example-manifest` and `json-schema` commands, and
`/api/v1/openapi.json`. Django serves the console at each path with a `ConsoleAppView` subclass
(`smarter.apps.docs.views`); a path with an argument, such as a kind, checks it and answers 404 for
one that doesn't exist. Show code with `@smarter/common`'s `CodeBlock` and its highlighters
(`highlightYaml`, `highlightJson`, `asYaml`, `prettyJson`). A large third-party script, such as Scalar
on the OpenAPI page, goes in the console's `public/` and is loaded by the one page that uses it
(`lib/scalar`), so the other pages never download it.

## Static files on the CDN

With `SMARTER_STATIC_FILES_ON_CDN` on (AWS only, off locally), `STATIC_URL` is `cdn.<platform>/static/`,
and `ConsoleAppView` rewrites the console page's `/static/` urls to it once `initialize_platform` has
uploaded that build (`smarter.lib.django.static_storage`, `mark_console_uploaded()`). Until then the
pods serve it. So a console's scripts must never hard-code `/static/`: Vite's `renderBuiltUrl` makes
chunks, styles and fonts load relative to the script, and a file in the console's `public/` is found
with `new URL("../<file>", import.meta.url)` in a build (see `SCALAR_SCRIPT_URL` in `lib/docs.ts`). Never
upload to the bucket from a test: `initialize_platform`'s `collectstatic` is patched in its tests.
