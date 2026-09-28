export interface ShrinkPinnedTabsSettings {
	hideTitle: boolean;
	tabWidth: number;
}

export const MIN_TAB_WIDTH = 20;
export const MAX_TAB_WIDTH = 160;

export const DEFAULT_SETTINGS: Readonly<ShrinkPinnedTabsSettings> = {
	hideTitle: false,
	tabWidth: 60,
};

export function normalizeSettings(data: unknown): ShrinkPinnedTabsSettings {
	const saved = data !== null && typeof data === 'object' && !Array.isArray(data)
		? data as Record<string, unknown>
		: {};

	return {
		hideTitle: typeof saved.hideTitle === 'boolean' ? saved.hideTitle : DEFAULT_SETTINGS.hideTitle,
		tabWidth: typeof saved.tabWidth === 'number' && Number.isFinite(saved.tabWidth)
			? Math.min(MAX_TAB_WIDTH, Math.max(MIN_TAB_WIDTH, saved.tabWidth))
			: DEFAULT_SETTINGS.tabWidth,
	};
}
