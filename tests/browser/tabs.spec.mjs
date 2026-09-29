import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const result = await build({ stdin: { contents: "export { TabState } from './tab-state'; export { NoteAppearance } from './note-appearance';", resolveDir: process.cwd() }, alias: { obsidian: resolve('tests/obsidian-icons.mjs') }, bundle: true, write: false, format: 'iife', globalName: 'TabModule' });
const defaults = { enabled: true, titleDisplay: 'always', pinDisplay: 'normal', tabWidth: 60 };

function tab(id, { pinned = true, active = false, linked = false } = {}) {
	return `<div id="${id}" class="workspace-tab-header ${active ? 'is-active' : ''}" data-type="markdown" role="tab" aria-label="${id}" tabindex="0">
		<div class="workspace-tab-header-inner">
			<div class="workspace-tab-header-inner-icon">📄</div>
			<div class="workspace-tab-header-inner-title">${id}</div>
			<div class="workspace-tab-header-status-container">
				${linked ? '<div class="workspace-tab-header-status-icon mod-linked">↔</div>' : ''}
				${pinned ? '<div class="workspace-tab-header-status-icon mod-pinned"><span>📌</span></div>' : ''}
			</div>
		</div>
	</div>`;
}

async function fixture(page, settings = {}) {
	await page.setContent(`<body class="theme-light is-focused"><div class="workspace">
		<div class="mod-root">
			<div class="workspace-tabs"><div class="workspace-tab-header-container">
				${tab('pinned')}${tab('active', { active: true })}${tab('linked', { linked: true })}${tab('unpinned', { pinned: false })}
			</div></div>
			<div class="workspace-tabs mod-stacked"><div class="workspace-tab-header-container">${tab('stacked')}</div></div>
		</div>
		<div class="mod-left-split"><div class="workspace-tabs"><div class="workspace-tab-header-container">${tab('sidebar')}</div></div></div>
	</div></body>`);
	// A local Obsidian stylesheet can be supplied for an additional compatibility run.
	if (process.env.OBSIDIAN_TEST_CSS) await page.addStyleTag({ content: readFileSync(process.env.OBSIDIAN_TEST_CSS, 'utf8') });
	await page.addStyleTag({ content: `
		.workspace-tab-header-container { display: flex; padding: 0; height: 40px; }
		.workspace-tab-header { flex: 0 0 200px; max-width: 200px; height: 36px; padding: 0; }
		.workspace-tab-header-inner { display: flex; width: 100%; height: 100%; padding: 0; }
		.workspace-tab-header-inner-title { flex: 1; min-width: 0; overflow: hidden; }
		.mod-root .workspace-tab-header[data-type="markdown"] .workspace-tab-header-inner-icon { display: none; }
		.workspace-tab-header-status-container { display: flex; }
		.workspace-tab-header-status-icon { width: 20px; }
	` });
	await page.evaluate(() => {
		window.clicks = { tab: 0, pin: 0, linked: 0, menu: 0 };
		document.querySelector('#pinned').addEventListener('click', () => window.clicks.tab++);
		document.querySelector('#pinned').addEventListener('contextmenu', e => { e.preventDefault(); window.clicks.menu++; });
		document.querySelectorAll('.mod-pinned').forEach(el => el.addEventListener('click', () => window.clicks.pin++));
		document.querySelector('.mod-linked').addEventListener('click', () => window.clicks.linked++);
	});
	await page.addStyleTag({ content: readFileSync('styles.css', 'utf8') });
	await page.addScriptTag({ content: result.outputFiles[0].text });
	await page.evaluate(settings => {
		window.settings = settings;
		document.createSpan = ({ cls, attr }) => { const el = document.createElement('span'); el.className = cls; for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v); return el; };
		window.leaves = [];
		window.metadata = { 'pinned.md': { icon: 'house', color: '#d97706' }, 'linked.md': { icon: '📚', color: '#123456' } };
		for (const group of document.querySelectorAll('.workspace-tabs')) {
			const bar = group.querySelector('.workspace-tab-header-container');
			const inner = document.createElement('div'); inner.className = 'workspace-tab-header-container-inner'; inner.style.display = 'flex';
			const panels = document.createElement('div'); panels.className = 'workspace-tab-container';
			for (const header of [...bar.children]) {
				inner.append(header);
				const panel = document.createElement('div'); panel.className = 'workspace-leaf'; const view = document.createElement('div'); panel.append(view); panels.append(panel);
				window.leaves.push({ view: { containerEl: view }, getViewState() { return { type: 'markdown', state: { file: header.id + '.md' } }; } });
			}
			bar.append(inner); group.append(panels);
		}
		const app = { workspace: { iterateAllLeaves(cb) { window.leaves.forEach(cb); } }, vault: { getAbstractFileByPath(path) { return { path, extension: 'md' }; } }, metadataCache: { getCache(path) { return { frontmatter: window.metadata[path] }; } } };
		window.appearance = new window.TabModule.NoteAppearance(app, () => window.settings);
		window.state = new window.TabModule.TabState(document, () => window.appearance.refresh()); window.state.configure(settings);
	}, { ...defaults, ...settings });
}

test('only regular pinned desktop tabs are reduced', async ({ page }) => {
	await fixture(page);
	await expect(page.locator('#pinned')).toHaveCSS('max-width', '60px');
	for (const id of ['unpinned', 'stacked', 'sidebar']) {
		await expect(page.locator(`#${id}`)).toHaveCSS('max-width', '200px');
	}
	await page.locator('body').evaluate(el => el.classList.add('is-mobile'));
	await expect(page.locator('#pinned')).toHaveCSS('max-width', '200px');
});

test('the normal pin remains clickable', async ({ page }) => {
	await fixture(page);
	await page.locator('#pinned .mod-pinned').click();
	expect(await page.evaluate(() => window.clicks.pin)).toBe(1);
});

test('a non-clickable pin selects the tab and leaves linked controls usable', async ({ page }) => {
	await fixture(page, { pinDisplay: 'locked' });
	const pin = await page.locator('#pinned .mod-pinned').boundingBox();
	await page.mouse.click(pin.x + pin.width / 2, pin.y + pin.height / 2);
	expect(await page.evaluate(() => window.clicks)).toEqual({ tab: 1, pin: 0, linked: 0, menu: 0 });
	await page.locator('#linked .mod-linked').click();
	expect(await page.evaluate(() => window.clicks.linked)).toBe(1);
});

test('hidden pins preserve linked indicators, icons, labels and the tab menu', async ({ page }) => {
	await fixture(page, { pinDisplay: 'hidden', titleDisplay: 'never' });
	await expect(page.locator('#pinned .mod-pinned')).toBeHidden();
	await expect(page.locator('#pinned .workspace-tab-header-status-container')).toBeHidden();
	await expect(page.locator('#linked .mod-linked')).toBeVisible();
	await expect(page.locator('#pinned .workspace-tab-header-inner-icon')).toBeVisible();
	await expect(page.locator('#pinned')).toHaveAttribute('aria-label', 'pinned');
	await page.locator('#pinned').click({ button: 'right' });
	expect(await page.evaluate(() => window.clicks.menu)).toBe(1);
});

test('titles follow the active class without rewriting styles', async ({ page }) => {
	await fixture(page, { titleDisplay: 'active' });
	await expect(page.locator('#pinned .workspace-tab-header-inner-title')).toBeHidden();
	await expect(page.locator('#active .workspace-tab-header-inner-title')).toBeVisible();
	await page.locator('#pinned').evaluate(el => el.classList.add('is-active'));
	await expect(page.locator('#pinned .workspace-tab-header-inner-title')).toBeVisible();
});

test('unpinning restores the normal tab appearance', async ({ page }) => {
	await fixture(page, { titleDisplay: 'never', pinDisplay: 'hidden' });
	await page.locator('#pinned .mod-pinned').evaluate(el => el.remove());
	await expect(page.locator('#pinned')).toHaveCSS('max-width', '200px');
	await expect(page.locator('#pinned .workspace-tab-header-inner-title')).toBeVisible();
});

test('disabling compact tabs restores titles and pin interactions', async ({ page }) => {
	await fixture(page, { enabled: false, titleDisplay: 'never', pinDisplay: 'hidden' });
	await expect(page.locator('#pinned')).toHaveCSS('max-width', '200px');
	await expect(page.locator('#pinned .workspace-tab-header-inner-title')).toBeVisible();
	await page.locator('#pinned .mod-pinned').click();
	expect(await page.evaluate(() => window.clicks.pin)).toBe(1);
});


test('note icons and colors remain visible in all title modes without changing native content', async ({ page }) => {
	await fixture(page, { useNoteAppearance: true });
	await expect(page.locator('#pinned .shrink-pinned-tabs-note-icon')).toBeVisible();
	await expect(page.locator('#pinned .workspace-tab-header-inner-icon')).toBeHidden();
	await expect(page.locator('#pinned .workspace-tab-header-inner-title')).toHaveCSS('color', 'rgb(217, 119, 6)');
	await expect(page.locator('#linked .shrink-pinned-tabs-note-icon')).toHaveText('📚');
	for (const titleDisplay of ['never', 'active']) {
		await page.evaluate(titleDisplay => { window.settings.titleDisplay = titleDisplay; window.state.configure(window.settings); }, titleDisplay);
		await expect(page.locator('#pinned .workspace-tab-header-inner-icon')).toBeHidden();
		await expect(page.locator('#pinned .shrink-pinned-tabs-note-icon')).toBeVisible();
	}
	await page.evaluate(() => { delete window.metadata['pinned.md']; window.appearance.refresh('pinned.md'); });
	await expect(page.locator('#pinned .shrink-pinned-tabs-note-icon')).toHaveCount(0);
	await expect(page.locator('#pinned .workspace-tab-header-inner-icon')).toBeVisible();
});

test('note decorations disappear on unpin, disabling and unload', async ({ page }) => {
	await fixture(page, { useNoteAppearance: true });
	await page.locator('#pinned .mod-pinned').evaluate(el => el.remove());
	await expect(page.locator('#pinned .shrink-pinned-tabs-note-icon')).toHaveCount(0);
	await page.evaluate(() => { window.settings.useNoteAppearance = false; window.appearance.refresh(); });
	await expect(page.locator('.shrink-pinned-tabs-note-icon')).toHaveCount(0);
	await page.evaluate(() => { window.settings.useNoteAppearance = true; window.appearance.refresh(); window.state.dispose(); window.appearance.dispose(); });
	await expect(page.locator('.shrink-pinned-tabs-note-icon')).toHaveCount(0);
	await expect(page.locator('#linked')).not.toHaveClass(/shrink-pinned-tabs/);
});
