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
		this.updateStyle()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// refresh function for when we change settings
	refresh = () => {
		// re-load the style
		this.updateStyle()
	}

	// update the styles (at the start, or as the result of a settings change)
	updateStyle = () => {
		console.log('Update style');
		const tabs = document.querySelectorAll<HTMLElement>('.workspace-tab-header:has(.mod-pinned)');
		if (tabs != null) {
			for (var i = 0; i < tabs.length; i++) {
				const title = (tabs[i].querySelectorAll('.workspace-tab-header-inner-title'));
				if (title != null) {
					title[0].toggleClass('mod-pinned-hide', this.settings.hideTitle);
				}
				tabs[i].style.width = this.settings.tabWidth + 'px';
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

		new Setting(containerEl)
			.setName('Width tab')
			.setDesc('Defines the width tab when shrinked')
			.addSlider((text) =>
				text
					.setLimits(0, 160, 10)
					.setValue(this.plugin.settings.tabWidth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.tabWidth = value;
						this.plugin.saveData(this.plugin.settings);
						this.plugin.refresh();
					})
			);
	}
}
