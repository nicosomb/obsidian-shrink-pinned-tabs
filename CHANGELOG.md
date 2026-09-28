# Changelog

## 1.1.0 (unreleased)

- Add clickable, non-clickable and hidden pin options (#5).
- Add a title mode that shows the title only on the active tab in each group.
- Show the note icon when the title is hidden.
- Apply settings to existing and newly opened detached windows.
- Add a command to toggle compact tabs and a button to reset the width.
- Keep stacked tabs, sidebar tabs and mobile layouts unchanged.
- Migrate existing title and width settings.
- Require Obsidian 1.1.9 or newer, with an installer supporting CSS `:has()`.
- Add browser tests for tab styles and interactions.

## 1.0.8

- Validate saved settings and limit tab widths to 20–160 px.
- Save setting changes in order and show a notice if saving fails.
- Stop rewriting the stylesheet on every layout change.
- Rename the width setting to "Maximum tab width" and remove unused CSS.
- Update dependencies and use Node.js 24 for development.
- Add tests and CI checks for builds and release versions.

Pin-button customization (#5) and detached-window support are not included.
