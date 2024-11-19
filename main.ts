import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface ShrinkPinnedTabsSettings {
	hideTitle: boolean;
	tabWidth: number;
}

const DEFAULT_SETTINGS: ShrinkPinnedTabsSettings = {
	hideTitle: false,
	tabWidth: 60,
}

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings;
	private styleEl: HTMLStyleElement;

	async onload() {
		await this.loadSettings();

		// Create a style element to hold our CSS
		this.styleEl = document.createElement('style');
		this.styleEl.setAttribute('id', 'shrink-pinned-tabs-styles');
		document.head.appendChild(this.styleEl);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ShrinkPinnedTabsSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-tab-title',
			name: 'Toggle tab title display',
			callback: () => {
				this.settings.hideTitle = !this.settings.hideTitle;
				this.saveData(this.settings);
				this.refresh();
			}
		});

		// Register for workspace layout change events
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.refresh();
			})
		);

		this.refresh()
	}

	onunload() {
		console.log('Unloading Shrink pinned tabs plugin');
		// Remove our custom styles when unloading
		this.styleEl?.remove();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// refresh function for when we change settings
	refresh = () => {
		// re-load the style
		this.updateStyle()
	}

	// update the styles using CSS rules instead of direct DOM manipulation
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
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Hide tab title')
			.setDesc('Defines if you want to hide the tab title')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.hideTitle)
				.onChange(async (value) => {
					this.plugin.settings.hideTitle = value;
					await this.plugin.saveData(this.plugin.settings);
					this.plugin.refresh();
				})
			);

		new Setting(containerEl)
			.setName('Width tab')
			.setDesc('Defines the width tab when shrinked')
			.addSlider((text) =>
				text
					.setLimits(20, 160, 10)
					.setValue(this.plugin.settings.tabWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.tabWidth = value;
						await this.plugin.saveData(this.plugin.settings);
						this.plugin.refresh();
					})
			);
	}
}
