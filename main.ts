import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface ShrinkPinnedTabsSettings {
	hideTitle: boolean;
}

const DEFAULT_SETTINGS: ShrinkPinnedTabsSettings = {
	hideTitle: false,
}

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings;

	async onload() {
		await this.loadSettings();

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

		this.refresh()
	}

	onunload() {
		console.log('Unloading Shrink pinned tabs plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// refresh function for when we change settings
	refresh = () => {
		// re-load the style
		this.updateStyle()
	}

	// update the styles (at the start, or as the result of a settings change)
	updateStyle = () => {
		const tabs = document.querySelectorAll('.workspace-tab-header:has(.mod-pinned)');
		if (tabs != null) {
			for (var i = 0; i < tabs.length; i++) {
				const title = (tabs[i].querySelectorAll('.workspace-tab-header-inner-title'));
				console.log(title[0]);
				if (title != null) {
					title[0].toggleClass('mod-pinned-hide', this.settings.hideTitle);
				}
			}
		}
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
				.onChange((value) => {
					this.plugin.settings.hideTitle = value;
					this.plugin.saveData(this.plugin.settings);
					this.plugin.refresh();
				})
			);
	}
}
