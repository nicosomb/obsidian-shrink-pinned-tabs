import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, MAX_TAB_WIDTH, MIN_TAB_WIDTH, normalizeSettings } from './settings';
import type { ShrinkPinnedTabsSettings } from './settings';
import { TabState } from './tab-state';
import type { SettingDefinitionRender, SliderComponent } from 'obsidian';

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings = normalizeSettings(undefined);
	private documents = new Map<Document, TabState>();
	private pendingSave: Promise<void> = Promise.resolve();
	private unloaded = false;

	async onload() {
		await this.loadSettings();
		this.unloaded = false;

		const workspace = this.app.workspace;
		this.addDocument(workspace.containerEl.ownerDocument);
		this.registerEvent(workspace.on('window-open', (window) => {
			this.addDocument(window.doc);
		}));
		this.registerEvent(workspace.on('window-close', (window) => {
			this.removeDocument(window.doc);
		}));
		workspace.onLayoutReady(() => this.refreshDocuments());
		this.registerEvent(workspace.on('layout-change', () => this.refreshDocuments()));

		this.addSettingTab(new ShrinkPinnedTabsSettingTab(this.app, this));
		this.addCommand({
			id: 'toggle-tab-title',
			name: 'Toggle tab title display',
			callback: async () => {
				this.settings.titleDisplay = this.settings.titleDisplay === 'never' ? 'always' : 'never';
				await this.saveSettings();
			}
		});
		this.addCommand({
			id: 'toggle-compact-tabs',
			name: 'Toggle compact pinned tabs',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
			}
		});
	}

	onunload() {
		this.unloaded = true;
		for (const doc of this.documents.keys()) this.removeDocument(doc);
	}

	private refreshDocuments() {
		if (this.unloaded) return;
		this.app.workspace.iterateAllLeaves((leaf) => this.addDocument(leaf.getContainer().doc));
		for (const state of this.documents.values()) state.refresh();
	}

	private addDocument(doc: Document) {
		if (this.unloaded || this.documents.has(doc)) return;
		const state = new TabState(doc);
		this.documents.set(doc, state);
		state.configure(this.settings);
	}

	private removeDocument(doc: Document) {
		this.documents.get(doc)?.dispose();
		this.documents.delete(doc);
	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	saveSettings(): Promise<void> {
		this.settings = normalizeSettings(this.settings);
		for (const state of this.documents.values()) state.configure(this.settings);
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
				name: 'Compact pinned tabs',
				desc: 'Apply these settings to regular tabs on desktop, including detached windows.',
				render: (setting) => { setting.addToggle(toggle => toggle.setValue(this.plugin.settings.enabled).onChange(async value => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				})); },
			},
			{
				name: 'Tab title',
				desc: 'Choose when to show the title of pinned tabs.',
				render: (setting) => { setting.addDropdown(dropdown => dropdown
					.addOption('always', 'Always show').addOption('active', 'Show on active tab').addOption('never', 'Hide')
					.setValue(this.plugin.settings.titleDisplay).onChange(async value => {
						this.plugin.settings = normalizeSettings({ ...this.plugin.settings, titleDisplay: value });
						await this.plugin.saveSettings();
					})); },
			},
			{
				name: 'Pin icon',
				desc: 'With a non-clickable or hidden pin, use the tab menu to unpin.',
				render: (setting) => { setting.addDropdown(dropdown => dropdown
					.addOption('normal', 'Clickable').addOption('locked', 'Non-clickable').addOption('hidden', 'Hidden')
					.setValue(this.plugin.settings.pinDisplay).onChange(async value => {
						this.plugin.settings = normalizeSettings({ ...this.plugin.settings, pinDisplay: value });
						await this.plugin.saveSettings();
					})); },
			},
			{
				name: 'Maximum tab width',
				desc: 'Maximum width of pinned tabs, in pixels. Default: 60.',
				render: (setting) => {
					let widthSlider: SliderComponent;
					setting.addSlider(slider => {
						widthSlider = slider;
						slider.setLimits(MIN_TAB_WIDTH, MAX_TAB_WIDTH, 10).setValue(this.plugin.settings.tabWidth).onChange(async value => {
							this.plugin.settings.tabWidth = value;
							await this.plugin.saveSettings();
						});
					}).addExtraButton(button => button.setIcon('reset').setTooltip('Reset width').onClick(async () => {
						this.plugin.settings.tabWidth = DEFAULT_SETTINGS.tabWidth;
						widthSlider.setValue(DEFAULT_SETTINGS.tabWidth);
						await this.plugin.saveSettings();
					}));
				},
			},
		] satisfies SettingDefinitionRender[];
	}

	// Obsidian versions before 1.13 use display() instead of setting definitions.
	display(): void {
		this.containerEl.empty();
		for (const definition of this.getSettingDefinitions()) {
			definition.render(new Setting(this.containerEl).setName(definition.name).setDesc(definition.desc));
		}
	}
}
