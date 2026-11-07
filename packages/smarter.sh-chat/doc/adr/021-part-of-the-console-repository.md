# ADR-021: Part of the Web Console's Repository

## Status

Accepted

Supersedes [ADR-020](020-part-of-the-platform-repository.md)'s repository, releases and version. Its other decisions
(one workspace, the folder's name, dist-tags, trusted publishing) still apply.

## Context

Under ADR-020, Smarter Chat was a package of the platform's React workspace, in `smarter-sh/smarter`, published with
each platform release and with the platform's version (0.36 to 0.42). The platform then moved its whole web console,
the workbench that hosts the chat among it, into a repository of its own, `smarter-sh/smarter-console` (the platform's
ADR-035, phase 5). The workspace moved with its history, and this package with it.

## Decision

Smarter Chat is a package of the web console's workspace, in `smarter-sh/smarter-console`, at
`packages/smarter.sh-chat`.

- **Releases.** This repository's `.github/workflows/uiChatRelease.yml` publishes the package when semantic-release
  (`release.config.js`) publishes a console release, and only when the package changed since the version on the
  release's dist-tag. Its version is the console's, set from the release's tag before the build, as before.
- **The version jumps from 0.42 to 1.x**, the console's version line, which started at 1.0.0. jsDelivr's `@1` range
  follows the new versions; `@0` stays on the last 0.x version. The platform's embed snippet, which a deployed
  LLMClient's page shows, names `@1` once the first 1.x version is published.
- **The contract.** The platform owns the chat contract's JSON Schema. This repository's `make contracts`
  (`scripts/sync-contracts.sh`) copies it into `contract/`, and regenerates `src/contract.gen.ts`, and smarter-sh's
  weekly API Contract Sync proposes the copy when a platform release changes it. A contract change is no longer one
  commit: the platform's, then this repository's sync.
- **Trusted publishing** names this repository: on npmjs.com, the package's trusted publisher is
  `smarter-sh/smarter-console`, workflow `uiChatRelease.yml`, environment `npm`.

## Alternatives Considered

- **Keep publishing from the platform's repository**, from a copy of the package. Two copies drift, which ADR-020
  ended.
- **Keep the platform's version line** (0.43 and later), with a version line for this one package. It avoids the
  jump, but needs a release process per package, where one covers the console and both published packages.

## Consequences

- **Positive:**
  - The chat is released with the workbench that hosts it, and tested in the same workspace.
  - The version says which console release the chat came with.
- **Negative:**
  - Sites on `@0` must change to `@1` for new versions; the console's release notes and the chat's README say so.
  - A contract change takes two repositories again: the platform's, then a sync here.
