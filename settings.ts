export type TitleDisplay = 'always' | 'active' | 'never';
export type PinDisplay = 'normal' | 'locked' | 'hidden';

export interface ShrinkPinnedTabsSettings {
	enabled: boolean;
	titleDisplay: TitleDisplay;
	pinDisplay: PinDisplay;
	tabWidth: number;
}

export const MIN_TAB_WIDTH = 20;
export const MAX_TAB_WIDTH = 160;

export const DEFAULT_SETTINGS: Readonly<ShrinkPinnedTabsSettings> = {
	enabled: true,
	titleDisplay: 'always',
	pinDisplay: 'normal',
	tabWidth: 60,
};

export function normalizeSettings(data: unknown): ShrinkPinnedTabsSettings {
	const saved = data !== null && typeof data === 'object' && !Array.isArray(data)
		? data as Record<string, unknown>
		: {};

	return {
		enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_SETTINGS.enabled,
		titleDisplay: saved.titleDisplay === 'always' || saved.titleDisplay === 'active' || saved.titleDisplay === 'never'
			? saved.titleDisplay
			: saved.hideTitle === true ? 'never' : DEFAULT_SETTINGS.titleDisplay,
		pinDisplay: saved.pinDisplay === 'normal' || saved.pinDisplay === 'locked' || saved.pinDisplay === 'hidden'
			? saved.pinDisplay
			: DEFAULT_SETTINGS.pinDisplay,
		tabWidth: typeof saved.tabWidth === 'number' && Number.isFinite(saved.tabWidth)
			? Math.min(MAX_TAB_WIDTH, Math.max(MIN_TAB_WIDTH, saved.tabWidth))
			: DEFAULT_SETTINGS.tabWidth,
	};
}
