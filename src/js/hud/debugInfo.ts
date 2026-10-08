/**
 * What the debug card shows, and how: a snapshot type that `svgNavigator.ts` fills
 * in, plus pure formatting into titled sections and the plain text that Copy writes.
 */

import { SHORT_COMMIT_LENGTH, UNAVAILABLE, formatBuildTime } from '../../shared/provenance';
import type { ClickAndDragBehavior } from '../../shared/settings';
import type { Point, ViewBox } from '../viewBox';
import { zoomLabel } from './zoomLabel';

export type InteractionKind = 'idle' | 'zoomBox' | 'panReady' | 'panning';

export interface ElementSummary {
    localName: string;
    id: string;
    classNames: readonly string[];
}

export interface WheelSample {
    deltaY: number;
    deltaMode: number;
}

/** One entry of `navigator.userAgentData.brands` (Chromium only). */
export interface UaBrand {
    brand: string;
    version: string;
}

/** The SVG as authored, read before the navigator rewrites its size attributes. */
export interface DocumentFacts {
    viewBox: ViewBox;
    viewBoxSource: 'authored' | 'derivedFromSize';
    authoredWidth: string | null;
    authoredHeight: string | null;
    authoredPreserveAspectRatio: string | null;
    elementCount: number;
}

export interface DebugInfo {
    viewBox: ViewBox;
    zoomRatio: number;
    pointer: { client: Point, svg: Point, maybeElement: ElementSummary | null };
    document: DocumentFacts;
    input: {
        interaction: InteractionKind,
        maybeLastWheel: WheelSample | null,
        clickAndDragBehavior: ClickAndDragBehavior,
        scrollSensitivity: number,
        invertScroll: boolean,
    };
    environment: { browser: string, devicePixelRatio: number, windowWidth: number, windowHeight: number };
    build: { version: string, maybeCommit: string | null, timestamp: string };
}

export interface DebugSection {
    title: string;
    rows: readonly (readonly [name: string, value: string])[];
}

const SIGNIFICANT_DIGITS = 4;
const MAX_ELEMENT_LABEL = 48;
const DELTA_MODES = ['pixel', 'line', 'page'] as const;
// Chromium also lists its engine and a GREASE brand; the product name is the useful one.
const PREFERRED_BRANDS = ['Microsoft Edge', 'Opera', 'Brave', 'Google Chrome', 'Chromium'];
// Order matters: Edge and Opera user agents also say Chrome, and Chrome's also says Safari.
const USER_AGENT_PATTERNS: readonly (readonly [RegExp, string])[] = [
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Edg\/([\d.]+)/, 'Microsoft Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
];

/** Four significant figures, without exponent noise like `-0`. */
export function formatNumber(value: number): string {
    const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
    return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** A CSS-selector-like label, `path#coast.border`, at most 48 characters. */
export function describeElement({ localName, id, classNames }: ElementSummary): string {
    const label = `${localName}${id ? `#${id}` : ''}${classNames.map((name) => `.${name}`).join('')}`;
    return label.length <= MAX_ELEMENT_LABEL ? label : `${label.slice(0, MAX_ELEMENT_LABEL - 1)}…`;
}

export function describeBrowser(userAgent: string, maybeBrands: readonly UaBrand[] | null): string {
    const maybeBrand = maybeBrands === null
        ? undefined
        : PREFERRED_BRANDS.map((name) => maybeBrands.find(({ brand }) => brand === name)).find((brand) => brand !== undefined);
    if (maybeBrand) {
        return `${maybeBrand.brand} ${maybeBrand.version}`;
    }
    for (const [pattern, name] of USER_AGENT_PATTERNS) {
        const maybeVersion = pattern.exec(userAgent)?.[1];
        if (maybeVersion) {
            return `${name} ${maybeVersion}`;
        }
    }
    return 'Unknown';
}

function formatViewBoxNumbers({ x, y, width, height }: ViewBox): string {
    return [x, y, width, height].map(formatNumber).join(' ');
}

function describeWheel(maybeWheel: WheelSample | null): string {
    if (maybeWheel === null) {
        return 'none';
    }
    const mode = DELTA_MODES[maybeWheel.deltaMode] ?? String(maybeWheel.deltaMode);
    return `deltaY ${formatNumber(maybeWheel.deltaY)} (${mode})`;
}

/** The card's sections, in display order. */
export function debugSections(info: DebugInfo): DebugSection[] {
    const { viewBox, pointer, document: facts, input, environment, build } = info;
    return [
        {
            title: 'View',
            rows: [
                ['X', formatNumber(viewBox.x)],
                ['Y', formatNumber(viewBox.y)],
                ['Width', formatNumber(viewBox.width)],
                ['Height', formatNumber(viewBox.height)],
                ['Zoom', zoomLabel(info.zoomRatio)],
            ],
        },
        {
            title: 'Pointer',
            rows: [
                ['Client', `${Math.round(pointer.client.x)}, ${Math.round(pointer.client.y)} px`],
                ['SVG', `${formatNumber(pointer.svg.x)}, ${formatNumber(pointer.svg.y)}`],
                ['Element', pointer.maybeElement ? describeElement(pointer.maybeElement) : 'none'],
            ],
        },
        {
            title: 'Document',
            rows: [
                ['viewBox', `${formatViewBoxNumbers(facts.viewBox)} (${facts.viewBoxSource === 'authored' ? 'authored' : 'derived from size'})`],
                ['Authored width', facts.authoredWidth ?? 'none'],
                ['Authored height', facts.authoredHeight ?? 'none'],
                ['preserveAspectRatio', facts.authoredPreserveAspectRatio ?? 'none'],
                ['Elements', String(facts.elementCount)],
            ],
        },
        {
            title: 'Input',
            rows: [
                ['Interaction', input.interaction],
                ['Last wheel', describeWheel(input.maybeLastWheel)],
                ['Drag', input.clickAndDragBehavior === 'pan' ? 'pan' : 'zoom box'],
                ['Scroll sensitivity', formatNumber(input.scrollSensitivity)],
                ['Invert scroll', input.invertScroll ? 'yes' : 'no'],
            ],
        },
        {
            title: 'Environment',
            rows: [
                ['Browser', environment.browser],
                ['Pixel ratio', formatNumber(environment.devicePixelRatio)],
                ['Window', `${environment.windowWidth} × ${environment.windowHeight} px`],
            ],
        },
        {
            title: 'Build',
            rows: [
                ['Version', build.version],
                ['Commit', build.maybeCommit?.slice(0, SHORT_COMMIT_LENGTH) ?? UNAVAILABLE],
                ['Built', formatBuildTime(build.timestamp)],
            ],
        },
    ];
}

/** Plain text for a bug report: a heading per section, `Name: value` lines, blank lines between. */
export function debugText(sections: readonly DebugSection[]): string {
    return sections
        .map(({ title, rows }) => [title, ...rows.map(([name, value]) => `${name}: ${value}`)].join('\n'))
        .join('\n\n');
}
