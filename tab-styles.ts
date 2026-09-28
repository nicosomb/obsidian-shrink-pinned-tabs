import type { ShrinkPinnedTabsSettings } from './settings';

export function getTabStyles(settings: ShrinkPinnedTabsSettings): string {
	if (!settings.enabled) return '';

	// Stacked tabs and mobile use a different layout for their headers.
	const tab = 'body:not(.is-mobile) .mod-root .workspace-tabs:not(.mod-stacked) > .workspace-tab-header-container .workspace-tab-header:has(.workspace-tab-header-status-icon.mod-pinned)';
	const pin = `${tab} .workspace-tab-header-status-icon.mod-pinned`;
	const rules = [`${tab} { max-width: ${settings.tabWidth}px !important; }`];

	if (settings.titleDisplay !== 'always') {
		const compactTab = settings.titleDisplay === 'active' ? `${tab}:not(.is-active)` : tab;
		rules.push(`${compactTab} .workspace-tab-header-inner-title { display: none; }`);
		rules.push(`${compactTab} .workspace-tab-header-inner-icon { display: flex; }`);
	}

	if (settings.pinDisplay === 'locked') {
		rules.push(`${pin}, ${pin} * { pointer-events: none; }`);
	} else if (settings.pinDisplay === 'hidden') {
		rules.push(`${pin} { display: none; }`);
		// Remove the empty container's spacing, but keep other status indicators.
		rules.push(`${tab} .workspace-tab-header-status-container:not(:has(> :not(.mod-pinned))) { display: none; }`);
	}

	return rules.join('\n');
}
