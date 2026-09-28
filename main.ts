import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MAX_TAB_WIDTH, MIN_TAB_WIDTH, normalizeSettings } from './settings';
import type { ShrinkPinnedTabsSettings } from './settings';
import type { SettingDefinitionRender } from 'obsidian';

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings = normalizeSettings(undefined);
	private pendingSave: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new ShrinkPinnedTabsSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-tab-title',
			name: 'Toggle tab title display',
			callback: async () => {
				this.settings.hideTitle = !this.settings.hideTitle;
				await this.saveSettings();
			}
		});

		this.updateStyle();
	}

	onunload() {
		const { containerEl } = this.app.workspace;
		containerEl.classList.remove('shrink-pinned-tabs-enabled', 'shrink-pinned-tabs-hide-title');
		containerEl.style.removeProperty('--shrink-pinned-tabs-width');
	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	saveSettings(): Promise<void> {
		this.settings = normalizeSettings(this.settings);
		this.updateStyle();
		const snapshot = { ...this.settings };

		// Keep slider changes from being saved out of order.
		this.pendingSave = this.pendingSave
			.then(() => this.saveData(snapshot))
			.catch((error: unknown) => {
				console.error('Shrink pinned tabs: failed to save settings', error);
				new Notice('Shrink pinned tabs: settings could not be saved. Please try again.');
			});

		return this.pendingSave;
	}

	updateStyle() {
		const { containerEl } = this.app.workspace;
		containerEl.classList.add('shrink-pinned-tabs-enabled');
		containerEl.classList.toggle('shrink-pinned-tabs-hide-title', this.settings.hideTitle);
		containerEl.style.setProperty('--shrink-pinned-tabs-width', `${this.settings.tabWidth}px`);
	}
}

class ShrinkPinnedTabsSettingTab extends PluginSettingTab {
	plugin: ShrinkPinnedTabs;

	constructor(app: App, plugin: ShrinkPinnedTabs) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				name: 'Hide tab title',
				desc: 'Hide the title of pinned tabs.',
				render: (setting) => {
					setting.addToggle((toggle) => toggle
						.setValue(this.plugin.settings.hideTitle)
						.onChange(async (value) => {
							this.plugin.settings.hideTitle = value;
							await this.plugin.saveSettings();
						})
					);
				},
			},
			{
				name: 'Maximum tab width',
				desc: 'Maximum width of pinned tabs, in pixels. Default: 60.',
				render: (setting) => {
					setting.addSlider((slider) => slider
						.setLimits(MIN_TAB_WIDTH, MAX_TAB_WIDTH, 10)
						.setValue(this.plugin.settings.tabWidth)
						.onChange(async (value) => {
							this.plugin.settings.tabWidth = value;
							await this.plugin.saveSettings();
						})
					);
				},
			},
		] satisfies SettingDefinitionRender[];
	}

	// Obsidian versions before 1.13 use display() instead of setting definitions.
	display(): void {
		this.containerEl.empty();
		for (const definition of this.getSettingDefinitions()) {
			const setting = new Setting(this.containerEl)
				.setName(definition.name)
				.setDesc(definition.desc ?? '');
			definition.render(setting);
		}
	}
}
