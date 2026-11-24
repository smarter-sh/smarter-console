# Smarter Apply Manifest

The web console's Apply Manifest page,
[http://localhost:9357/dashboard/dropzone/](http://localhost:9357/dashboard/dropzone/): a SAM manifest editor in
which you paste, type, open or drop any Smarter manifest, or start from a kind's example, and apply it.

- **Checks as you type**: YAML syntax, then the manifest's header (`apiVersion`, `kind` and `metadata.name`), then
  its SAM model, with the cli api's `validate` command. Problems are marked in the editor and listed under it.
- **Field help**: hovering over a field, or moving the cursor to it, shows what it is (its type, whether it is
  required, its description and its values) from its kind's JSON Schema, the cli api's `json-schema` command.
- **Apply** sends the manifest to the cli api's `apply` command, which creates its resource, or updates it if it
  exists.
- **File Open**, and **Start from an example** (the cli api's `example-manifest` command).
- **Drop Zone**: dragging a file over the page shows the drop zone over the editor; dropping the file there opens
  it. A manifest that would replace your text asks first.

The page's second tab, **From a GitHub repository**, applies every manifest of a public GitHub repository at
once, with the repository apply api, `/api/web/account/repository-apply/` (`src/lib/repositoryApply.ts`): POST
`{url}` starts a run (or returns the one in progress), and the page polls `<id>/` every two seconds until it has
finished or failed. It shows the run's stage and progress, and the manifests it discovered, in apply order, with
each one's status; the status counts filter them, and a failed or skipped manifest opens its message, its apply
output and its file on GitHub. Beside it, the user's recent runs. Every manifest is applied as the signed-in user,
in their account; the repository's scripts never run, folders that its `owners.yaml` assigns to other users are
skipped, and no LLMClient is deployed (`components/RepositoryApply/`).

The editor is `@smarter/manifest-editor`'s, in its `isNew` mode: the same editor as each resource's manifest
page, without locked fields, and without Clone and Delete.

In the web console, `@smarter/console` imports this package (`src/index.ts`) and renders `ApplyManifest` at
`/dashboard/dropzone`, with the session's SAM kinds and the cli api's urls (`routes/ToolPages.tsx`). The page shows
while the session's `manifestDropZone` flag is on. Django answers the path with the console's page,
`smarter.apps.dashboard.views.dropzone.view.DropzoneView`, a `ConsoleAppView` (ADR-035). The url and the flag keep
their names, which the backend owns.

## Development

The package has no build of its own: its `index.html` and `src/main.tsx` are a development page only. It calls the
Django dev server's api, through `vite.config.ts`'s proxy, as the signed-in user of localhost:9357.

```console
npm run dev -w @smarter/apply-manifest
npm run storybook -w @smarter/apply-manifest
npx vitest run packages/smarter-apply-manifest
```

Tests replace Monaco, which jsdom can't run, with `@smarter/manifest-editor/mocks/monaco`, a textarea.
