---
"@iskl/dev-journal": minor
---

Adopt Changesets for version management. Day-to-day flow: `npm run changeset` to record a change → merge to `main` → a "Version Packages" PR is opened automatically. Merging that PR auto-tags `v<version>`, which triggers the existing `release.yml` to publish to npm with OIDC + provenance. The tag-driven publish pipeline is unchanged.
