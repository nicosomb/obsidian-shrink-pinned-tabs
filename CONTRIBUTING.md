# Development and releases

Use Node.js 24 LTS (`nvm use` if you use nvm).

```sh
npm ci
npm run check
```

`check` runs lint (including the official Obsidian rules), tests, the build, and version checks. Lint warnings fail the check. Unit tests use a stub of the Obsidian API and DOM mutation observers. Run browser checks with `npx playwright install chromium` followed by `npm run test:browser`. CI runs both suites. CSS is checked with the official Obsidian Stylelint rules.

Compact styling applies to regular desktop tabs. Mobile, stacked tabs and sidebar tabs retain their native appearance. Themes that force their own styles may affect the result.

Use `npm run dev` for watch mode. To test manually, copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/shrink-pinned-tabs/` in a test vault, then reload the plugin.

## Before a release

- Check pin/unpin, changing settings, and the title command.
- Restart Obsidian and confirm settings still apply.
- Disable the plugin and confirm the original tab appearance returns.
- Verify that unpinned tabs are unchanged (regression #3).
- Check the default theme and a community theme, stacked tabs, detached windows, and mobile.

Manual checks in Obsidian, including detached windows and the minimum supported version (1.1.9), remain part of release validation.

Use `npm version patch` to update package, manifest, and compatibility metadata together. Pushing the resulting version tag runs the checks and creates a **draft** GitHub release with the three plugin files; publish it after manual verification.

Release assets are attested by GitHub Actions before the draft release is created. After downloading an asset, its provenance can be checked with:

```sh
gh attestation verify main.js --repo nicosomb/obsidian-shrink-pinned-tabs
gh attestation verify styles.css --repo nicosomb/obsidian-shrink-pinned-tabs
```

The Obsidian ESLint package currently declares older Obsidian and `@eslint/js` dependencies. The overrides in `package.json` keep it on the versions used by this project.

## README screenshots

Use a separate demo vault with fictional notes and the default light theme. Keep the same window size, active note and tab order for both images.

- `docs/before.jpg`: compact tabs disabled; Home, Projects and Reading list pinned; Meeting notes and Today unpinned.
- `docs/compact.jpg`: compact tabs enabled, titles hidden, pin icons hidden, maximum width 60 px.

- `docs/note-appearance.jpg`: note appearance enabled, Home active with its `icon` and `color` properties visible; Lucide icons and an emoji in the pinned tabs.

All images show real Obsidian 1.13.7 windows. The before/after pair uses plugin version 1.1.0; the note appearance screenshot uses 1.2.0.
