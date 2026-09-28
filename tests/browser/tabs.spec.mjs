import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const result = await build({ entryPoints: ['tab-state.ts'], bundle: true, write: false, format: 'iife', globalName: 'TabModule' });
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
	await page.evaluate(settings => { window.state = new window.TabModule.TabState(document); window.state.configure(settings); }, { ...defaults, ...settings });
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
