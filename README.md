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

- **Compact pinned tabs** enables or disables the plugin's styling without losing your settings.
- **Tab title** can be shown on all pinned tabs, only on the active tab in each group, or hidden. When hidden, the note icon stays visible.
- **Pin icon** can be clickable, non-clickable, or hidden. Use the tab's right-click menu to unpin when the icon is non-clickable or hidden. Other status icons, such as linked tabs, remain usable.
- **Maximum tab width** caps the width between 20 and 160 pixels (default: 60). The reset button restores 60 pixels. Available space and your theme can make tabs narrower.

These settings apply to regular desktop tabs, including detached windows. Stacked tabs, sidebar tabs and mobile layouts keep their native appearance. Existing width and hidden-title settings are preserved when updating from 1.0.8.

The command palette includes **Toggle compact pinned tabs** and **Toggle tab title display**. The title command switches between hidden and always visible; it keeps the shortcut assigned in earlier versions.

Requires Obsidian 1.1.9 or newer and an installer that supports CSS `:has()` (installer 1.1.9 or newer). If styles do not apply on an old installation, update Obsidian using the latest installer.

## Development

Use Node.js 24 LTS (`nvm use` if you use nvm).

```sh
npm ci
npm run check
```

`check` runs lint, tests, the build, and version checks. Tests use a stub of the Obsidian API for settings and window lifecycle behavior.

CSS and click behavior are also tested in Chromium:

```sh
npx playwright install chromium
npm run test:browser
```

The browser tests use a small tab fixture. They do not replace testing in Obsidian with your themes and plugins.

Use `npm run dev` for watch mode. To test manually, copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/shrink-pinned-tabs/` in a test vault, then reload the plugin.

### Before a release

- Check pin/unpin, changing settings, and the title command.
- Restart Obsidian and confirm settings still apply.
- Disable the plugin and confirm the original tab appearance returns.
- Verify that unpinned tabs are unchanged (regression #3).
- Check the default theme and a community theme, stacked tabs, detached windows, and mobile.

- Open a detached window before enabling the plugin and another one afterward. Check that settings update in both, and that disabling the plugin restores both windows.
- Try each pin option, including a linked tab. The link indicator and right-click menu should remain usable.
- In "Show on active tab" mode, switch between pinned tabs in each group.

Use `npm version patch` to update package, manifest, and compatibility metadata together. Pushing the resulting version tag runs the checks and creates a **draft** GitHub release with the three plugin files; publish it after manual verification.
