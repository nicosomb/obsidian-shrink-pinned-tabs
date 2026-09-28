# Shrink pinned tabs plugin for Obsidian

This plugin enables you to shrink pinned tabs in Obsidian UI. You can also show or hide the tab title in the plugin settings. 

This plugin is inspired by [a snippet from woofy31 on Obsidian's forum](https://forum.obsidian.md/t/shrink-the-size-of-pinned-tabs/71914/2).

## How does it look? 

### Default display in Obsidian

![Default display with unshrinked tabs](docs/default.png)

### Shrinked tabs 

![Display with shrinked tabs](docs/shrinked.png)

### Shrinked tabs with no title

![Display with shrinked tabs and hidden title](docs/shrinked-no-title.png)

## Settings

- **Hide tab title** hides the title of pinned tabs. You can also toggle it from the command palette with **Shrink pinned tabs: Toggle tab title display**.
- **Maximum tab width** caps the width of pinned tabs between 20 and 160 pixels (default: 60). Available space and your theme can make tabs narrower.

On Obsidian 1.13 and newer, both settings are available in settings search. Older versions use the same controls in the plugin settings tab.

Changes take effect immediately and are saved for the next session. If saving fails, a notice asks you to retry.

## Development

Use Node.js 24 LTS (`nvm use` if you use nvm).

```sh
npm ci
npm run check
```

`check` runs lint (including the official Obsidian rules), tests, the build, and version checks. Lint warnings fail the check. Tests use a stub of the Obsidian API; layout checks need to be done in Obsidian.

Use `npm run dev` for watch mode. To test manually, copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/shrink-pinned-tabs/` in a test vault, then reload the plugin.

### Before a release

- Check pin/unpin, changing settings, and the title command.
- Restart Obsidian and confirm settings still apply.
- Disable the plugin and confirm the original tab appearance returns.
- Verify that unpinned tabs are unchanged (regression #3).
- Check the default theme and a community theme, stacked tabs, detached windows, and mobile.

Detached windows and the minimum supported Obsidian version still need testing.

Use `npm version patch` to update package, manifest, and compatibility metadata together. Pushing the resulting version tag runs the checks and creates a **draft** GitHub release with the three plugin files; publish it after manual verification.

Release assets are attested by GitHub Actions before the draft release is created. After downloading an asset, its provenance can be checked with:

```sh
gh attestation verify main.js --repo nicosomb/obsidian-shrink-pinned-tabs
gh attestation verify styles.css --repo nicosomb/obsidian-shrink-pinned-tabs
```

The Obsidian ESLint package currently declares older Obsidian and `@eslint/js` dependencies. The overrides in `package.json` keep it on the versions used by this project.
