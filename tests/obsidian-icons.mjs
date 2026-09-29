// Only the icon lookup is stubbed; DOM updates and cleanup use real nodes.
export function getIcon(name) {
	if (!['house', 'lucide-house', 'book-open'].includes(name)) return null;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('data-icon', name);
	return svg;
}
