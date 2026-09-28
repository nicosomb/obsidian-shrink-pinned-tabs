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

function host(t) {
	const elements = [];
	let writes = 0;
	const previousDocument = globalThis.document;
	globalThis.notices = [];
	globalThis.document = {
		createElement() {
			return {
				setAttribute() {},
				set textContent(value) {
					this.css = value;
					writes++;
				},
				remove() {
					elements.splice(elements.indexOf(this), 1);
				},
			};
		},
		head: { appendChild(element) { elements.push(element); } },
	};
	t.after(() => {
		globalThis.document = previousDocument;
		delete globalThis.notices;
	});
	return { elements, writes: () => writes };
}

test('loads settings, toggles titles and removes styles on unload', async (t) => {
	const { elements } = host(t);
	const plugin = new Plugin();
	plugin.saved = { hideTitle: true, tabWidth: 90 };
	await plugin.onload();
	assert.equal(elements.length, 1);
	assert.match(elements[0].css, /max-width: 90px/);
	assert.match(elements[0].css, /display: none/);
	await plugin.commands[0].callback();
	assert.deepEqual(plugin.saved, { hideTitle: false, tabWidth: 90 });
	assert.doesNotMatch(elements[0].css, /display: none/);
	plugin.onunload();
	assert.equal(elements.length, 0);
});

test('saves rapid changes in order', async (t) => {
	const { elements, writes } = host(t);
	const plugin = new Plugin();
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
	assert.deepEqual(snapshots, [{ hideTitle: false, tabWidth: 70 }]);
	releaseFirst();
	await Promise.all([first, second]);
	assert.deepEqual(snapshots.map(s => s.tabWidth), [70, 80]);
	plugin.onunload();
});

test('reports save errors and allows retrying', async (t) => {
	host(t);
	const log = mock.method(console, 'error', () => {});
	t.after(() => log.mock.restore());
	const plugin = new Plugin();
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
