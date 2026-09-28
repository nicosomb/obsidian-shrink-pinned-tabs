import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = readJson('../package.json');
const manifest = readJson('../manifest.json');
const versions = readJson('../versions.json');
assert.equal(pkg.version, manifest.version, 'Package and manifest versions must match');
assert.equal(versions[manifest.version], manifest.minAppVersion, 'versions.json must match the manifest');
if (process.env.GITHUB_REF_TYPE === 'tag') {
	assert.equal(process.env.GITHUB_REF_NAME, manifest.version, 'Release tag must match the manifest version');
}
console.log(`Release metadata is consistent (${manifest.version}).`);
