import { getIcon } from 'obsidian';
import type { App, WorkspaceLeaf } from 'obsidian';
import type { ShrinkPinnedTabsSettings } from './settings';

const iconClass = 'shrink-pinned-tabs-note-icon';
const colorProperty = '--shrink-pinned-tabs-note-color';
const emoji = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u;

export function noteIcon(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const icon = value.trim();
	if (!icon || icon.length > 64) return null;
	return emoji.test(icon) || getIcon(icon) ? icon : null;
}

export function noteColor(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const color = value.trim();
	if (!color || color.length > 100 || /\b(?:var|env|currentcolor|inherit|initial|unset|revert|revert-layer)\b/i.test(color)) return null;
	return CSS.supports('color', color) ? color : null;
}

// Obsidian renders regular tab headers and their leaf containers in the same order.
// If the DOM does not match that structure, leave the native appearance alone.
export function headerForLeaf(leaf: WorkspaceLeaf): HTMLElement | null {
	const view = leaf.view.containerEl;
	const panel = view.closest('.workspace-leaf');
	const group = panel?.closest('.workspace-tabs');
	if (!panel || !group || group.classList.contains('mod-stacked') ||
		!group.closest('.mod-root') || view.ownerDocument.body.classList.contains('is-mobile')) return null;
	const panels = Array.from(group.querySelectorAll(':scope > .workspace-tab-container > .workspace-leaf'));
	const headers = group.querySelectorAll<HTMLElement>(':scope > .workspace-tab-header-container > .workspace-tab-header-container-inner > .workspace-tab-header');
	const index = panels.indexOf(panel);
	if (index < 0 || panels.length !== headers.length) return null;
	return headers[index] ?? null;
}

interface Decoration {
	icon: string | null;
	element: HTMLElement | null;
}

export class NoteAppearance {
	private decorated = new Map<HTMLElement, Decoration>();

	constructor(private app: App, private settings: () => ShrinkPinnedTabsSettings) {}

	refresh(changedPath?: string) {
		const settings = this.settings();
		if (!settings.enabled || !settings.useNoteAppearance) {
			this.dispose();
			return;
		}
		const seen = new Set<HTMLElement>();
		this.app.workspace.iterateAllLeaves(leaf => {
			const header = headerForLeaf(leaf);
			if (!header || !header.querySelector('.mod-pinned')) return;
			const state = leaf.getViewState();
			// getViewState also identifies notes whose background views are deferred.
			const path: unknown = state.state?.file;
			if (state.type !== 'markdown' || typeof path !== 'string') return;
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!file || !('extension' in file) || file.extension !== 'md') return;
			seen.add(header);
			if (changedPath !== undefined && path !== changedPath) return;
			const metadata = this.app.metadataCache.getCache(path)?.frontmatter;
			this.apply(header, noteIcon(metadata?.icon), noteColor(metadata?.color));
		});
		for (const header of this.decorated.keys()) {
			if (!seen.has(header)) this.clear(header);
		}
	}

	private apply(header: HTMLElement, icon: string | null, color: string | null) {
		if (!icon && !color) {
			this.clear(header);
			return;
		}
		let decoration = this.decorated.get(header);
		if (!decoration) {
			decoration = { icon: null, element: null };
			this.decorated.set(header, decoration);
		}
		const inner = header.querySelector('.workspace-tab-header-inner');
		if (icon !== decoration.icon || (icon && decoration.element?.parentElement !== inner)) {
			decoration.element?.remove();
			decoration.element = null;
			decoration.icon = null;
			if (icon && inner) {
				const element = header.ownerDocument.createSpan({ cls: iconClass, attr: { 'aria-hidden': 'true' } });
				const svg = getIcon(icon);
				if (svg) element.appendChild(svg);
				else element.textContent = icon;
				inner.prepend(element);
				decoration.element = element;
				decoration.icon = icon;
			}
		}
		header.classList.toggle('shrink-pinned-tabs-custom-icon', !!decoration.element);
		header.classList.toggle('shrink-pinned-tabs-custom-color', !!color);
		if (color) {
			if (header.style.getPropertyValue(colorProperty) !== color) header.style.setProperty(colorProperty, color);
		} else header.style.removeProperty(colorProperty);
	}

	private clear(header: HTMLElement) {
		this.decorated.get(header)?.element?.remove();
		header.classList.remove('shrink-pinned-tabs-custom-icon', 'shrink-pinned-tabs-custom-color');
		header.style.removeProperty(colorProperty);
		this.decorated.delete(header);
	}

	disposeDocument(doc: Document) {
		for (const header of this.decorated.keys()) {
			if (header.ownerDocument === doc) this.clear(header);
		}
	}

	dispose() {
		for (const header of this.decorated.keys()) this.clear(header);
	}
}
