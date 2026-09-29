import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const result = await build({
	entryPoints: ['main.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
	plugins: [{ name: 'obsidian-test-host', setup(build) {
		build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'test' }));
		build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
			export function getIcon() { return null; }
			export class Plugin {
				commands = []; events = [];
				async loadData() { return this.saved; }
				async saveData(value) { this.saved = value; }
				addSettingTab(tab) { this.settingTab = tab; }
				addCommand(command) { this.commands.push(command); }
				registerEvent(event) { this.events.push(event); }
			}
			export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
			export class Setting {
				constructor(container) { container.rows.push(this); }
				setName(value) { this.name = value; return this; }
				setDesc(value) { this.desc = value; return this; }
				addToggle(callback) { this.control = new Control(); callback(this.control); return this; }
				addDropdown(callback) { return this.addToggle(callback); }
				addSlider(callback) { return this.addToggle(callback); }
				addExtraButton(callback) { this.button = new Control(); callback(this.button); return this; }
			}
			class Control {
				setValue(value) { this.value = value; return this; }
				setLimits() { return this; }
				addOption() { return this; }
				setIcon() { return this; }
				setTooltip() { return this; }
				onClick(callback) { this.click = callback; return this; }
				onChange(callback) { this.change = callback; return this; }
			}
			export class Notice { constructor(message) { globalThis.notices.push(message); } }
		` }));
	} }],
});
const { default: Plugin } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const markup = '<div class="workspace"><div class="workspace-tab-header-container"><div class="workspace-tab-header"><div class="workspace-tab-header-status-container"><div class="workspace-tab-header-status-icon mod-pinned"></div></div></div></div></div>';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function host(t) {
	const dom = new JSDOM(markup);
	globalThis.MutationObserver = dom.window.MutationObserver;
	globalThis.notices = [];
	const doc = dom.window.document;
	const events = new Map();
	const leaves = [];
	let ready;
	const plugin = new Plugin();
	plugin.app = { metadataCache: { on() {} }, vault: { on() {} }, workspace: {
		containerEl: doc.querySelector('.workspace'),
		on(name, callback) { events.set(name, callback); return name; },
		onLayoutReady(callback) { ready = callback; },
		iterateAllLeaves(callback) { leaves.forEach(callback); },
	} };
	t.after(() => { plugin.onunload(); dom.window.close(); delete globalThis.MutationObserver; delete globalThis.notices; });
	return { plugin, doc, events, leaves, ready: () => ready() };
}

test('migrates settings, updates pin mutations and cleans up', async t => {
	const { plugin, doc } = host(t);
	plugin.saved = { hideTitle: true, tabWidth: 90 };
	await plugin.onload();
	assert.ok(doc.body.classList.contains('shrink-pinned-tabs-title-never'));
	assert.equal(doc.body.style.getPropertyValue('--shrink-pinned-tabs-width'), '90px');
	const header = doc.querySelector('.workspace-tab-header');
	assert.ok(header.classList.contains('shrink-pinned-tabs-pinned'));
	const pin = doc.querySelector('.mod-pinned');
	pin.remove(); await tick();
	assert.ok(!header.classList.contains('shrink-pinned-tabs-pinned'));
	doc.querySelector('.workspace-tab-header-status-container').append(pin); await tick();
	assert.ok(header.classList.contains('shrink-pinned-tabs-pinned'));
	await plugin.commands[0].callback();
	assert.equal(plugin.saved.titleDisplay, 'always');
	plugin.onunload();
	assert.equal(doc.querySelectorAll('[class*="shrink-pinned-tabs"]').length, 0);
	assert.equal(doc.body.style.length, 0);
});

test('handles restored, new and closed windows and late layout callbacks', async t => {
	const { plugin, events, leaves, ready } = host(t);
	const restored = new JSDOM(markup);
	const opened = new JSDOM(markup);
	t.after(() => { restored.window.close(); opened.window.close(); });
	leaves.push({ getContainer: () => ({ doc: restored.window.document }) });
	await plugin.onload(); ready();
	events.get('window-open')({ doc: opened.window.document });
	plugin.settings.tabWidth = 110; await plugin.saveSettings();
	for (const dom of [restored, opened]) assert.equal(dom.window.document.body.style.getPropertyValue('--shrink-pinned-tabs-width'), '110px');
	events.get('window-close')({ doc: opened.window.document });
	assert.equal(opened.window.document.body.style.length, 0);
	plugin.onunload(); ready();
	assert.equal(restored.window.document.body.style.length, 0);
});

test('discovers new bars on layout change and restores state when re-enabled', async t => {
	const { plugin, doc, events } = host(t);
	await plugin.onload();
	const newBar = doc.querySelector('.workspace-tab-header-container').cloneNode(true);
	doc.body.append(newBar);
	events.get('layout-change')();
	newBar.querySelector('.mod-pinned').remove(); await tick();
	assert.ok(!newBar.querySelector('.workspace-tab-header').classList.contains('shrink-pinned-tabs-pinned'));
	await plugin.commands[1].callback();
	assert.equal(doc.querySelectorAll('.shrink-pinned-tabs-pinned').length, 0);
	await plugin.commands[1].callback();
	assert.equal(doc.querySelectorAll('.shrink-pinned-tabs-pinned').length, 1);
});

test('serializes rapid saves without delaying visual updates', async t => {
	const { plugin, doc } = host(t);
	await plugin.onload();
	const snapshots = []; let release;
	plugin.saveData = async value => { snapshots.push(value); if (snapshots.length === 1) await new Promise(resolve => { release = resolve; }); };
	plugin.settings.tabWidth = 70; const first = plugin.saveSettings(); await Promise.resolve();
	plugin.settings.tabWidth = 80; const second = plugin.saveSettings();
	assert.equal(doc.body.style.getPropertyValue('--shrink-pinned-tabs-width'), '80px');
	assert.equal(snapshots.length, 1); release(); await Promise.all([first, second]);
	assert.deepEqual(snapshots.map(s => s.tabWidth), [70, 80]);
});

test('renders searchable settings with the same legacy controls and resets width', async t => {
	const { plugin } = host(t); await plugin.onload();
	const tab = plugin.settingTab;
	tab.containerEl = { rows: [], empty() { this.rows = []; } };
	tab.display();
	const rows = tab.containerEl.rows;
	assert.deepEqual(rows.map(r => r.name), tab.getSettingDefinitions().map(d => d.name));
	await rows[1].control.change('active'); await rows[2].control.change('hidden'); await rows[3].control.change(120);
	assert.equal(plugin.saved.titleDisplay, 'active'); assert.equal(plugin.saved.pinDisplay, 'hidden');
	await rows[3].button.click();
	assert.equal(plugin.saved.tabWidth, 60); assert.equal(rows[3].control.value, 60);
});
