import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
	{ ignores: ['main.js', 'node_modules/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{ languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
