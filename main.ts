import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS, MAX_TAB_WIDTH, MIN_TAB_WIDTH, normalizeSettings } from './settings';
import type { ShrinkPinnedTabsSettings } from './settings';
import { getTabStyles } from './tab-styles';

export default class ShrinkPinnedTabs extends Plugin {
	settings: ShrinkPinnedTabsSettings = normalizeSettings(undefined);
	private styles = new Map<Document, HTMLStyleElement>();
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
		workspace.onLayoutReady(() => {
			if (this.unloaded) return;
			workspace.iterateAllLeaves((leaf) => this.addDocument(leaf.getContainer().doc));
		});

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
			id: 'toggle-shrink-pinned-tabs',
			name: 'Toggle compact pinned tabs',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
			}
		});
	}

	onunload() {
		this.unloaded = true;
		for (const doc of this.styles.keys()) this.removeDocument(doc);
	}

	private addDocument(doc: Document) {
		if (this.unloaded || this.styles.has(doc)) return;

		const style = doc.createElement('style');
		style.id = 'shrink-pinned-tabs-styles';
		style.textContent = getTabStyles(this.settings);
		doc.head.appendChild(style);
		this.styles.set(doc, style);
	}

	private removeDocument(doc: Document) {
		this.styles.get(doc)?.remove();
		this.styles.delete(doc);
	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	saveSettings(): Promise<void> {
		this.settings = normalizeSettings(this.settings);
		const css = getTabStyles(this.settings);
		for (const style of this.styles.values()) style.textContent = css;
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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Compact pinned tabs')
			.setDesc('Apply these settings to regular tabs on desktop, including detached windows.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Tab title')
			.setDesc('Choose when to show the title of pinned tabs.')
			.addDropdown((dropdown) => dropdown
				.addOption('always', 'Always show')
				.addOption('active', 'Show on active tab')
				.addOption('never', 'Hide')
				.setValue(this.plugin.settings.titleDisplay)
				.onChange(async (value) => {
					this.plugin.settings = normalizeSettings({ ...this.plugin.settings, titleDisplay: value });
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Pin icon')
			.setDesc('With a non-clickable or hidden pin, use the tab menu to unpin.')
			.addDropdown((dropdown) => dropdown
				.addOption('normal', 'Clickable')
				.addOption('locked', 'Non-clickable')
				.addOption('hidden', 'Hidden')
				.setValue(this.plugin.settings.pinDisplay)
				.onChange(async (value) => {
					this.plugin.settings = normalizeSettings({ ...this.plugin.settings, pinDisplay: value });
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Maximum tab width')
			.setDesc('Maximum width of pinned tabs, in pixels. Default: 60.')
			.addSlider((slider) => slider
				.setLimits(MIN_TAB_WIDTH, MAX_TAB_WIDTH, 10)
				.setValue(this.plugin.settings.tabWidth)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.tabWidth = value;
					await this.plugin.saveSettings();
				})
			)
			.addExtraButton((button) => button
				.setIcon('reset')
				.setTooltip('Reset width')
				.onClick(async () => {
					this.plugin.settings.tabWidth = DEFAULT_SETTINGS.tabWidth;
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}
