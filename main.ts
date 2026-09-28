import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MAX_TAB_WIDTH, MIN_TAB_WIDTH, normalizeSettings } from './settings';
import type { ShrinkPinnedTabsSettings } from './settings';

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings = normalizeSettings(undefined);
	private styleEl?: HTMLStyleElement;
	private pendingSave: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadSettings();

		this.styleEl = document.createElement('style');
		this.styleEl.setAttribute('id', 'shrink-pinned-tabs-styles');
		document.head.appendChild(this.styleEl);

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
		this.styleEl?.remove();
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

	updateStyle = () => {
		if (!this.styleEl) return;

		const css = `
			.workspace-tab-header:has(.mod-pinned) {
				max-width: ${this.settings.tabWidth}px !important;
			}
			
			${this.settings.hideTitle ? `
			.workspace-tab-header:has(.mod-pinned) .workspace-tab-header-inner-title {
				display: none;
			}
			` : ''}
		`;

		this.styleEl.textContent = css;
	}
}

class ShrinkPinnedTabsSettingTab extends PluginSettingTab {
	plugin: ShrinkPinnedTabs;

	constructor(app: App, plugin: ShrinkPinnedTabs) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Hide tab title')
			.setDesc('Hide the title of pinned tabs.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideTitle)
					.onChange(async (value) => {
						this.plugin.settings.hideTitle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Maximum tab width')
			.setDesc('Maximum width of pinned tabs, in pixels. Default: 60.')
			.addSlider((slider) =>
				slider
					.setLimits(MIN_TAB_WIDTH, MAX_TAB_WIDTH, 10)
					.setValue(this.plugin.settings.tabWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.tabWidth = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
