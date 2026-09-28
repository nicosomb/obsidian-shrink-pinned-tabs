import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
	{ ignores: ['main.js', 'node_modules/**'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{ languageOptions: { globals: { ...globals.node, ...globals.browser } } },
	{
		files: ['*.ts'],
		plugins: { obsidianmd },
		languageOptions: { parserOptions: { projectService: true } },
		rules: {
			...obsidianmd.ruleConfigs.recommended,
			...obsidianmd.ruleConfigs.recommendedTypeChecked,
		},
	},
];
