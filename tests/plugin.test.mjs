import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { build } from 'esbuild';

// Obsidian is not available in Node; stub its API for these tests.
const result = await build({
	entryPoints: ['main.ts'],
	bundle: true,
	write: false,
	format: 'esm',
	platform: 'node',
	plugins: [{
		name: 'obsidian-test-host',
		setup(build) {
			build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'test' }));
			build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
				export class Plugin {
					commands = [];
					async loadData() { return this.saved; }
					async saveData(value) { this.saved = value; }
					addSettingTab(tab) { this.settingTab = tab; }
					addCommand(command) { this.commands.push(command); }
				}
				export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
				export class Setting {
					constructor(container) { container.rows.push(this); }
					setName(value) { this.name = value; return this; }
					setDesc(value) { this.desc = value; return this; }
					addToggle(callback) { this.control = new Control(); callback(this.control); return this; }
					addSlider(callback) { this.control = new Control(); callback(this.control); return this; }
				}
				class Control {
					setValue(value) { this.value = value; return this; }
					setLimits(...limits) { this.limits = limits; return this; }
					onChange(callback) { this.change = callback; return this; }
				}
				export class Notice { constructor(message) { globalThis.notices.push(message); } }
			` }));
		},
	}],
});
const { default: Plugin } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

function host(t) {
	const classes = new Set();
	const properties = new Map();
	let writes = 0;
	const containerEl = {
		classList: {
			add(name) { classes.add(name); },
			remove(...names) { for (const name of names) classes.delete(name); },
			toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
		},
		style: {
			setProperty(name, value) { properties.set(name, value); writes++; },
			removeProperty(name) { properties.delete(name); },
		},
	};
	const plugin = new Plugin();
	plugin.app = { workspace: { containerEl } };
	globalThis.notices = [];
	t.after(() => { delete globalThis.notices; });
	return { plugin, classes, properties, writes: () => writes };
}

test('loads settings, toggles titles and removes CSS state on unload', async (t) => {
	const { plugin, classes, properties } = host(t);
	plugin.saved = { hideTitle: true, tabWidth: 90 };
	await plugin.onload();
	assert.ok(classes.has('shrink-pinned-tabs-enabled'));
	assert.ok(classes.has('shrink-pinned-tabs-hide-title'));
	assert.equal(properties.get('--shrink-pinned-tabs-width'), '90px');
	await plugin.commands[0].callback();
	assert.deepEqual(plugin.saved, { hideTitle: false, tabWidth: 90 });
	assert.equal(classes.has('shrink-pinned-tabs-hide-title'), false);
	plugin.onunload();
	assert.equal(classes.size, 0);
	assert.equal(properties.size, 0);
});

test('saves rapid changes in order', async (t) => {
	const { plugin, properties, writes } = host(t);
	await plugin.onload();
	const snapshots = [];
	let releaseFirst;
	plugin.saveData = async (value) => {
		snapshots.push(value);
		if (snapshots.length === 1) await new Promise(resolve => { releaseFirst = resolve; });
	};
	plugin.settings.tabWidth = 70;
	const first = plugin.saveSettings();
	await Promise.resolve();
	plugin.settings.tabWidth = 80;
	const second = plugin.saveSettings();
	assert.equal(properties.get('--shrink-pinned-tabs-width'), '80px');
	assert.equal(writes(), 3);
	assert.deepEqual(snapshots, [{ hideTitle: false, tabWidth: 70 }]);
	releaseFirst();
	await Promise.all([first, second]);
	assert.deepEqual(snapshots.map(s => s.tabWidth), [70, 80]);
	plugin.onunload();
});

test('reports save errors and allows retrying', async (t) => {
	const { plugin } = host(t);
	const log = mock.method(console, 'error', () => {});
	t.after(() => log.mock.restore());
	await plugin.onload();
	plugin.saveData = async () => { throw new Error('disk unavailable'); };
	await plugin.saveSettings();
	assert.equal(globalThis.notices.length, 1);
	assert.equal(log.mock.callCount(), 1);
	plugin.saveData = async (value) => { plugin.saved = value; };
	plugin.settings.tabWidth = 100;
	await plugin.saveSettings();
	assert.equal(plugin.saved.tabWidth, 100);
	plugin.onunload();
});


test('settings definitions and the legacy tab use the same controls', async (t) => {
	const { plugin, classes, properties } = host(t);
	await plugin.onload();
	const tab = plugin.settingTab;
	const definitions = tab.getSettingDefinitions();
	assert.deepEqual(definitions.map(d => d.name), ['Hide tab title', 'Maximum tab width']);
	const container = { rows: [], empty() { this.rows = []; } };
	tab.containerEl = container;
	tab.display();
	assert.deepEqual(container.rows.map(row => row.name), definitions.map(d => d.name));
	await container.rows[0].control.change(true);
	await container.rows[1].control.change(120);
	assert.ok(classes.has('shrink-pinned-tabs-hide-title'));
	assert.equal(properties.get('--shrink-pinned-tabs-width'), '120px');
	assert.deepEqual(plugin.saved, { hideTitle: true, tabWidth: 120 });

	const controls = [];
	const row = {
		addToggle(callback) { const c = control(); controls.push(c); callback(c); return this; },
		addSlider(callback) { const c = control(); controls.push(c); callback(c); return this; },
	};
	function control() {
		return {
			setValue(value) { this.value = value; return this; },
			setLimits(...limits) { this.limits = limits; return this; },
			onChange(callback) { this.change = callback; return this; },
		};
	}
	for (const definition of definitions) definition.render(row);
	assert.equal(controls[0].value, true);
	assert.equal(controls[1].value, 120);
	await controls[0].change(false);
	await controls[1].change(80);
	assert.deepEqual(plugin.saved, { hideTitle: false, tabWidth: 80 });
	assert.equal(classes.has('shrink-pinned-tabs-hide-title'), false);
	assert.equal(properties.get('--shrink-pinned-tabs-width'), '80px');
});
