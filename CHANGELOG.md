# Changelog

## 1.2.0

- Add an optional setting to read pinned note icons and colors from `icon` and `color` properties.
- Support Lucide icons and emojis while preserving native icons when properties are removed.
- Keep separate files with the same name distinct and update every pinned view of a note.

## 1.1.0

- Choose clickable, non-clickable or hidden pin icons (#5).
- Show pinned tab titles always, only on active tabs, or never.
- Toggle compact tabs from settings or the command palette, and reset the width.
- Apply settings to detached windows and preserve existing title preferences.
- Keep mobile, stacked tabs and sidebar tabs unchanged.
- Replace `:has()` with classes updated by observers limited to tab bars.
- Remove `!important` and check CSS with the official Obsidian Stylelint rules.
- Add browser tests for tab appearance and pin interactions.
- Require Obsidian 1.1.9 or newer.

## 1.0.9

- Load CSS through `styles.css` instead of injecting a style element.
- Make settings searchable in Obsidian 1.13 while keeping the settings tab available on older versions.
- Remove the deprecated slider tooltip call.
- Check the source with the official Obsidian ESLint rules.
- Generate provenance attestations for release assets in GitHub Actions.

## 1.0.8

- Validate saved settings and limit tab widths to 20–160 px.
- Save setting changes in order and show a notice if saving fails.
- Stop rewriting the stylesheet on every layout change.
- Rename the width setting to "Maximum tab width" and remove unused CSS.
- Update dependencies and use Node.js 24 for development.
- Add tests and CI checks for builds and release versions.

Pin-button customization (#5) and detached-window support are not included.
