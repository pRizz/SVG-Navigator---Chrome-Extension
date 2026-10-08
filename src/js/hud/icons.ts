/** The HUD's icons: 24×24 stroked paths drawn inline, so there's no icon font to load. */

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
    minus: 'M5 12h14',
    plus: 'M12 5v14M5 12h14',
    background: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 3v18M12 8h7M12 12h9M12 16h7',
    maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    minimize: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    check: 'M5 12l4 4 10-10',
} as const;

export type IconName = keyof typeof PATHS;

/** A decorative icon; its button carries the accessible name. */
export function icon(htmlDoc: Document, name: IconName): SVGSVGElement {
    const svg = htmlDoc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = htmlDoc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', PATHS[name]);
    svg.append(path);
    return svg;
}
