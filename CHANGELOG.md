# @iskl/dev-journal

## 0.2.0

### Minor Changes

- [`fc83a2b`](https://github.com/sklme/skill_dev_journal/commit/fc83a2bce9af5c34818260dd4dbd685df41af1c6) Thanks [@sklme](https://github.com/sklme)! - Adopt Changesets for version management. Day-to-day flow: `npm run changeset` to record a change → merge to `main` → a "Version Packages" PR is opened automatically. Merging that PR auto-tags `v<version>`, which triggers the existing `release.yml` to publish to npm with OIDC + provenance. The tag-driven publish pipeline is unchanged.

### Patch Changes

- [`47c1241`](https://github.com/sklme/skill_dev_journal/commit/47c12415f27dba4a8b066b0f8770dbeade07c53c) Thanks [@sklme](https://github.com/sklme)! - 增加发布流程
