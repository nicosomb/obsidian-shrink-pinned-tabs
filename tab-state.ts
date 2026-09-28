import type { ShrinkPinnedTabsSettings } from './settings';

const prefix = 'shrink-pinned-tabs-';
const classes = ['enabled', 'title-active', 'title-never', 'pin-locked', 'pin-hidden'];
const barSelector = '.workspace-tab-header-container';

export class TabState {
	private observers = new Map<Element, MutationObserver>();
	private marked = new Set<Element>();
	private enabled = false;

	constructor(private doc: Document) {}

	configure(settings: ShrinkPinnedTabsSettings) {
		this.enabled = settings.enabled;
		for (const name of classes) {
			this.doc.body.classList.toggle(prefix + name, settings.enabled && (
				name === 'enabled' || name === `title-${settings.titleDisplay}` || name === `pin-${settings.pinDisplay}`
			));
		}
		this.doc.body.style.setProperty('--shrink-pinned-tabs-width', `${settings.tabWidth}px`);
		if (settings.enabled) this.refresh();
		else this.clearObservers();
	}

	refresh() {
		if (!this.enabled) return;
		for (const [bar, observer] of this.observers) {
			if (!this.doc.contains(bar)) {
				observer.disconnect();
				this.observers.delete(bar);
			}
		}
		for (const bar of this.doc.querySelectorAll(barSelector)) {
			if (!this.observers.has(bar)) {
				const observer = new MutationObserver((records) => {
					if (records.some(record => record.type === 'childList' ||
						(record.target as Element).classList.contains('workspace-tab-header-status-icon'))) {
						this.sync(bar);
					}
				});
				observer.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
				this.observers.set(bar, observer);
			}
			this.sync(bar);
		}
	}

	private sync(bar: Element) {
		for (const element of this.marked) {
			if (element.ownerDocument !== this.doc || !this.doc.contains(element) || !element.closest(barSelector)) {
				if (element.ownerDocument === this.doc) this.unmark(element);
				this.marked.delete(element);
			}
		}
		for (const header of bar.querySelectorAll('.workspace-tab-header')) {
			header.classList.toggle(prefix + 'pinned', !!header.querySelector('.mod-pinned'));
			this.marked.add(header);
			const status = header.querySelector('.workspace-tab-header-status-container');
			if (status) {
				status.classList.toggle(prefix + 'only-pin', status.children.length > 0 &&
					Array.from(status.children).every(child => child.classList.contains('mod-pinned')));
				this.marked.add(status);
			}
		}
	}

	private unmark(element: Element) {
		element.classList.remove(prefix + 'pinned', prefix + 'only-pin');
	}

	private clearObservers() {
		for (const observer of this.observers.values()) observer.disconnect();
		this.observers.clear();
		for (const element of this.marked) {
			if (element.ownerDocument === this.doc) this.unmark(element);
		}
		this.marked.clear();
	}

	dispose() {
		this.enabled = false;
		this.clearObservers();
		this.doc.body.classList.remove(...classes.map(name => prefix + name));
		this.doc.body.style.removeProperty('--shrink-pinned-tabs-width');
	}
}
