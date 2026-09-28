import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
	entryPoints: ['settings.ts'],
	bundle: true,
	write: false,
	format: 'esm',
});
const { normalizeSettings } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('uses defaults for missing or invalid settings', () => {
	for (const data of [undefined, null, false, 42, 'text', [], {}]) {
		assert.deepEqual(normalizeSettings(data), { hideTitle: false, tabWidth: 60 });
	}
});

test('preserves valid saved settings', () => {
	const saved = { hideTitle: true, tabWidth: 73.5 };
	assert.deepEqual(normalizeSettings(saved), saved);
	assert.notEqual(normalizeSettings(saved), saved);
	assert.deepEqual(normalizeSettings({ hideTitle: true }), { hideTitle: true, tabWidth: 60 });
});

test('rejects invalid types and non-finite widths', () => {
	for (const tabWidth of ['80', '20px; color:red', null, NaN, Infinity, -Infinity, {}, []]) {
		assert.deepEqual(normalizeSettings({ hideTitle: 'false', tabWidth }), {
			hideTitle: false, tabWidth: 60,
		});
	}
});

test('clamps widths without modifying the saved data', () => {
	for (const [tabWidth, expected] of [[-1, 20], [0, 20], [20, 20], [160, 160], [1000, 160]]) {
		const saved = { hideTitle: false, tabWidth, extra: 'ignored' };
		assert.deepEqual(normalizeSettings(saved), { hideTitle: false, tabWidth: expected });
		assert.equal(saved.tabWidth, tabWidth);
	}
});
