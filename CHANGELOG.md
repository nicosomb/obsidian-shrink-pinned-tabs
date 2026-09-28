# Changelog

## 1.0.9 (unreleased)

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
