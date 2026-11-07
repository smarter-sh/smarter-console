/**
 * semantic-release: each release of the console, from the conventional commits since the last one.
 *
 * A release builds the console and the deployed LLMClient page into dist/react/, packs that folder as
 * smarter-console-<version>.tar.gz, and attaches it to the GitHub release. The smarter repository pins a version,
 * and its Docker build unpacks that release's tarball into the backend's static folder. The console's own
 * package.json carries the version, which it sends to the backend as X-Smarter-ClientVersion.
 *
 * .github/workflows/release.yml runs it after the Tests workflow passes on main, alpha or beta.
 */
export default {
  branches: ["main", { name: "beta", prerelease: true }, { name: "alpha", prerelease: true }],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "docs", release: false },
          { type: "test", release: false },
          { type: "style", release: false },
          { type: "refactor", release: false },
        ],
        parserOpts: {
          noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
        },
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features", hidden: false },
            { type: "fix", section: "Bug Fixes", hidden: false },
            { type: "refactor", section: "Refactoring", hidden: false },
            { type: "perf", section: "Performance", hidden: false },
          ],
        },
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Change Log\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).\n",
      },
    ],
    [
      // the release's version in the console's package.json, then the production builds, packed.
      "@semantic-release/exec",
      {
        prepareCmd: [
          "npm version ${nextRelease.version} --no-git-tag-version --workspace=@smarter/console",
          "NODE_ENV=production npm run build",
          "mkdir -p release",
          "tar -czf release/smarter-console-${nextRelease.version}.tar.gz -C dist react",
        ].join(" && "),
      },
    ],
    [
      "@semantic-release/github",
      {
        // No comments or labels on the issues and pull requests that released commits mention: the history imported
        // from the smarter repository mentions that repository's numbers, which don't exist here, and the first
        // release failed in its success step on #923.
        successComment: false,
        releasedLabels: false,
        assets: [
          {
            path: "release/smarter-console-*.tar.gz",
            label: "The web console's build: react/@smarter/<package>/, for the backend's static folder",
          },
        ],
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "packages/smarter-console/package.json", "package-lock.json"],
        // No CI skip tag: GitHub would then run no Tests for a pull request whose head this commit is.
        message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
      },
    ],
  ],
};
