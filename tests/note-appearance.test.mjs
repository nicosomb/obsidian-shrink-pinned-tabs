import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { resolve } from 'node:path';

const result = await build({ entryPoints: ['note-appearance.ts', 'tab-state.ts'], bundle: true, write: false, outdir: 'unused', format: 'esm', alias: { obsidian: resolve('tests/obsidian-icons.mjs') } });
const modules = await Promise.all(result.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)));
const { NoteAppearance, headerForLeaf, noteIcon, noteColor } = modules[0];
const { TabState } = modules[1];

function host(t, paths = ['Projects/Home.md', 'Personal/Home.md', 'Projects/Home.md']) {
	const dom = new JSDOM('<div class="workspace"><div class="mod-root"><div class="workspace-tabs"><div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner"></div></div><div class="workspace-tab-container"></div></div></div></div>');
	const doc = dom.window.document;
	globalThis.document = doc;
	globalThis.MutationObserver = dom.window.MutationObserver;
	globalThis.CSS = { supports(property, value) { const el = doc.createElement('div'); el.style.setProperty(property, value); return !!el.style.getPropertyValue(property); } };
	doc.createSpan = ({ cls, attr }) => { const el = doc.createElement('span'); el.className = cls; for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v); return el; };
	const headers = [], leaves = [];
	const metadata = new Map(paths.map(path => [path, { icon: 'house', color: '#d97706' }]));
	const files = new Map(paths.map(path => [path, { path, extension: 'md' }]));
	for (const path of paths) {
		const header = doc.createElement('div'); header.className = 'workspace-tab-header'; header.setAttribute('aria-label', 'Home');
		header.innerHTML = '<div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-icon"><svg data-native="true"></svg></div><div class="workspace-tab-header-inner-title">Home</div><div class="workspace-tab-header-status-container"><div class="workspace-tab-header-status-icon mod-pinned"></div></div></div>';
		doc.querySelector('.workspace-tab-header-container-inner').append(header); headers.push(header);
		const panel = doc.createElement('div'); panel.className = 'workspace-leaf'; const view = doc.createElement('div'); panel.append(view); doc.querySelector('.workspace-tab-container').append(panel);
		const leaf = { path, type: 'markdown', view: { containerEl: view }, getViewState() { return { type: this.type, state: { file: this.path } }; } }; leaves.push(leaf);
	}
	const app = { workspace: { iterateAllLeaves(callback) { leaves.forEach(callback); } }, vault: { getAbstractFileByPath(path) { return files.get(path); } }, metadataCache: { getCache(path) { return { frontmatter: metadata.get(path) }; } } };
	const settings = { enabled: true, useNoteAppearance: true, tabWidth: 60, titleDisplay: 'always', pinDisplay: 'normal' };
	const appearance = new NoteAppearance(app, () => settings);
	const tabs = new TabState(doc, () => appearance.refresh());
	t.after(() => { tabs.dispose(); appearance.dispose(); dom.window.close(); delete globalThis.document; delete globalThis.CSS; delete globalThis.MutationObserver; });
	return { doc, headers, leaves, metadata, files, settings, appearance, tabs };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const icon = header => header.querySelector('.shrink-pinned-tabs-note-icon');
const color = header => header.style.getPropertyValue('--shrink-pinned-tabs-note-color');

test('matches same-name notes by their actual views, including duplicate and deferred tabs', t => {
	const h = host(t); h.metadata.set('Personal/Home.md', { icon: '📚', color: '#123456' }); h.leaves[2].isDeferred = true;
	h.appearance.refresh();
	assert.equal(icon(h.headers[0]).firstChild.getAttribute('data-icon'), 'house');
	assert.equal(icon(h.headers[1]).textContent, '📚');
	assert.equal(icon(h.headers[2]).firstChild.getAttribute('data-icon'), 'house');
	assert.equal(color(h.headers[1]), '#123456');
	const first = icon(h.headers[0]); h.appearance.refresh(); assert.equal(icon(h.headers[0]), first);
});

test('updates only the changed file and restores native nodes when properties are removed', t => {
	const h = host(t); h.appearance.refresh();
	const otherIcon = icon(h.headers[1]);
	h.metadata.set('Projects/Home.md', { icon: '🧑🏽‍💻', color: 'red' }); h.appearance.refresh('Projects/Home.md');
	assert.equal(icon(h.headers[0]).textContent, '🧑🏽‍💻'); assert.equal(icon(h.headers[2]).textContent, '🧑🏽‍💻'); assert.equal(icon(h.headers[1]), otherIcon);
	h.metadata.delete('Projects/Home.md'); h.appearance.refresh('Projects/Home.md');
	assert.equal(icon(h.headers[0]), null); assert.equal(color(h.headers[0]), ''); assert.ok(h.headers[0].querySelector('[data-native]'));
});

test('keeps icon and color independent and rejects invalid properties', t => {
	const h = host(t);
	for (const value of [undefined, null, [], {}, 42, '<svg>bad</svg>', 'not-a-lucide-icon', 'hello 📚']) assert.equal(noteIcon(value), null);
	for (const value of ['house', 'lucide-house', '📚', '🇫🇷', '1️⃣', '🧑🏽‍💻']) assert.equal(noteIcon(value), value);
	for (const value of [undefined, [], {}, 'var(--text-normal)', 'currentColor', 'red; display:none', 'url(https://example.com)', 'notacolor']) assert.equal(noteColor(value), null);
	h.metadata.set('Projects/Home.md', { icon: 'invalid', color: '#123456' }); h.metadata.set('Personal/Home.md', { icon: 'house', color: 'invalid' }); h.appearance.refresh();
	assert.equal(icon(h.headers[0]), null); assert.equal(color(h.headers[0]), '#123456'); assert.ok(icon(h.headers[1])); assert.equal(color(h.headers[1]), '');
});

test('handles file changes, renames, deletes and reordered tabs', t => {
	const h = host(t); h.appearance.refresh();
	h.metadata.set('Personal/Home.md', { icon: '📚' }); h.leaves[0].path = 'Personal/Home.md'; h.appearance.refresh(); assert.equal(icon(h.headers[0]).textContent, '📚');
	const panel = h.leaves[0].view.containerEl.parentElement;
	panel.parentElement.append(panel); h.headers[0].parentElement.append(h.headers[0]);
	assert.equal(headerForLeaf(h.leaves[0]), h.headers[0]); h.appearance.refresh(); assert.equal(icon(h.headers[0]).textContent, '📚');
	h.files.set('Renamed.md', { path: 'Renamed.md', extension: 'md' }); h.metadata.set('Renamed.md', { icon: 'book-open' }); h.leaves[0].path = 'Renamed.md'; h.appearance.refresh(); assert.equal(icon(h.headers[0]).firstChild.getAttribute('data-icon'), 'book-open');
	h.files.delete('Renamed.md'); h.appearance.refresh(); assert.equal(icon(h.headers[0]), null);
});

test('skips mismatched layouts, stacked tabs, mobile and non-markdown views', t => {
	const h = host(t); h.appearance.refresh();
	h.doc.querySelector('.workspace-tabs').classList.add('mod-stacked'); h.appearance.refresh(); assert.equal(icon(h.headers[0]), null);
	h.doc.querySelector('.workspace-tabs').classList.remove('mod-stacked'); h.doc.body.classList.add('is-mobile'); h.appearance.refresh(); assert.equal(icon(h.headers[0]), null);
	h.doc.body.classList.remove('is-mobile'); h.leaves[0].type = 'canvas'; h.appearance.refresh(); assert.equal(icon(h.headers[0]), null);
	h.headers[2].remove(); h.appearance.refresh(); assert.equal(icon(h.headers[1]), null);
});

test('pin mutations update appearance without observer loops; disabling cleans up', async t => {
	const h = host(t); h.tabs.configure(h.settings); await tick();
	const pin = h.headers[0].querySelector('.mod-pinned'); const status = pin.parentElement;
	pin.remove(); await tick(); assert.equal(icon(h.headers[0]), null); assert.equal(color(h.headers[0]), '');
	status.append(pin); await tick(); assert.ok(icon(h.headers[0]));
	h.settings.useNoteAppearance = false; h.appearance.refresh(); await tick(); assert.equal(h.doc.querySelectorAll('.shrink-pinned-tabs-note-icon').length, 0);
	h.settings.useNoteAppearance = true; h.appearance.refresh(); h.settings.enabled = false; h.tabs.configure(h.settings); h.appearance.refresh(); assert.equal(icon(h.headers[0]), null);
});

test('does not decorate another group using a same-name label', t => {
	const h = host(t); const fake = h.headers[0].cloneNode(true); h.doc.body.append(fake); h.appearance.refresh();
	assert.equal(icon(fake), null); h.appearance.disposeDocument(h.doc); assert.equal(h.doc.querySelectorAll('.shrink-pinned-tabs-note-icon').length, 0);
});
