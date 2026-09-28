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
					registerEvent() {}
					async loadData() { return this.saved; }
					async saveData(value) { this.saved = value; }
					addSettingTab() {}
					addCommand(command) { this.commands.push(command); }
				}
				export class PluginSettingTab {}
				export class Setting {}
				export class Notice { constructor(message) { globalThis.notices.push(message); } }
			` }));
		},
	}],
});
const { default: Plugin } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

function makeDocument() {
	const elements = [];
	let writes = 0;
	const doc = {
		createElement() {
			return {
				set textContent(value) { this.css = value; writes++; },
				remove() { elements.splice(elements.indexOf(this), 1); },
			};
		},
		head: { appendChild(element) { elements.push(element); } },
	};
	return { doc, elements, writes: () => writes };
}

function host(t, { restored = [], ready = true } = {}) {
	const main = makeDocument();
	const events = new Map();
	const readyCallbacks = [];
	globalThis.notices = [];
	const workspace = {
		containerEl: { ownerDocument: main.doc },
		on(name, callback) { events.set(name, callback); return { name, callback }; },
		onLayoutReady(callback) { if (ready) callback(); else readyCallbacks.push(callback); },
		iterateAllLeaves(callback) {
			for (const doc of [main.doc, ...restored]) callback({ getContainer: () => ({ doc }) });
		},
	};
	const plugin = new Plugin();
	plugin.app = { workspace };
	t.after(() => { plugin.onunload(); delete globalThis.notices; });
	return {
		...main, plugin,
		open(doc) { events.get('window-open')({ doc }, { document: doc }); },
		close(doc) { events.get('window-close')({ doc }, { document: doc }); },
		ready() { for (const callback of readyCallbacks) callback(); },
	};
}

test('loads settings, toggles titles and removes styles on unload', async (t) => {
	const { elements, plugin } = host(t);
	plugin.saved = { hideTitle: true, tabWidth: 90 };
	await plugin.onload();
	assert.equal(elements.length, 1);
	assert.match(elements[0].css, /max-width: 90px/);
	assert.match(elements[0].css, /display: none/);
	await plugin.commands[0].callback();
	assert.deepEqual(plugin.saved, { enabled: true, titleDisplay: 'always', pinDisplay: 'normal', tabWidth: 90 });
	assert.doesNotMatch(elements[0].css, /display: none/);
	plugin.onunload();
	assert.equal(elements.length, 0);
});

test('saves rapid changes in order', async (t) => {
	const { elements, writes, plugin } = host(t);
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
	assert.match(elements[0].css, /max-width: 80px/);
	assert.equal(writes(), 3);
	assert.deepEqual(snapshots, [{ enabled: true, titleDisplay: 'always', pinDisplay: 'normal', tabWidth: 70 }]);
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


test('updates restored and new windows and cleans up closed ones', async (t) => {
	const restored = makeDocument();
	const later = makeDocument();
	const h = host(t, { restored: [restored.doc, restored.doc] });
	await h.plugin.onload();
	assert.equal(restored.elements.length, 1);
	h.open(later.doc);
	h.open(later.doc);
	assert.equal(later.elements.length, 1);
	h.plugin.settings.tabWidth = 110;
	await h.plugin.saveSettings();
	for (const doc of [h, restored, later]) assert.match(doc.elements[0].css, /max-width: 110px/);
	h.close(later.doc);
	assert.equal(later.elements.length, 0);
	const writes = later.writes();
	await h.plugin.saveSettings();
	assert.equal(later.writes(), writes);
	h.plugin.onunload();
	assert.equal(h.elements.length, 0);
	assert.equal(restored.elements.length, 0);
});

test('does not add styles if layout becomes ready after unloading', async (t) => {
	const restored = makeDocument();
	const h = host(t, { restored: [restored.doc], ready: false });
	await h.plugin.onload();
	h.plugin.onunload();
	h.ready();
	assert.equal(h.elements.length, 0);
	assert.equal(restored.elements.length, 0);
});

test('the compact command disables styles in every window without losing options', async (t) => {
	const restored = makeDocument();
	const h = host(t, { restored: [restored.doc] });
	await h.plugin.onload();
	h.plugin.settings.pinDisplay = 'hidden';
	const command = h.plugin.commands.find(c => c.id === 'toggle-shrink-pinned-tabs');
	await command.callback();
	assert.equal(h.elements[0].css, '');
	assert.equal(restored.elements[0].css, '');
	assert.equal(h.plugin.saved.enabled, false);
	await command.callback();
	assert.match(restored.elements[0].css, /max-width/);
	assert.equal(h.plugin.saved.pinDisplay, 'hidden');
});
