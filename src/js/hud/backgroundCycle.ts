/**
 * The HUD's background button: cycles the page background for this tab only. The
 * color in settings stays the lasting default and is where every cycle starts.
 */

export type BackgroundState = 'saved' | 'checkerboard' | 'dark';

const CYCLE: readonly BackgroundState[] = ['saved', 'checkerboard', 'dark'];

/** The options popup's dark page color, so "dark" matches the extension's own dark theme. */
export const DARK_BACKGROUND = '#1b1c1e';

/** 16px squares in two neutral grays: the usual pattern behind transparent artwork. */
export const CHECKERBOARD_BACKGROUND = 'repeating-conic-gradient(#d4d4d4 0 25%, #f4f4f4 0 50%) 0 0 / 32px 32px';

const LABELS: Readonly<Record<BackgroundState, string>> = {
    saved: 'saved color',
    checkerboard: 'checkerboard',
    dark: 'dark',
};

export function nextBackground(state: BackgroundState): BackgroundState {
    return CYCLE[(CYCLE.indexOf(state) + 1) % CYCLE.length] ?? 'saved';
}

/** The CSS `background` for `state`; `saved` is the color from settings. */
export function backgroundCss(state: BackgroundState, savedColor: string): string {
    switch (state) {
    case 'saved':
        return savedColor;
    case 'checkerboard':
        return CHECKERBOARD_BACKGROUND;
    case 'dark':
        return DARK_BACKGROUND;
    }
}

/** The button's tooltip, which names what a click switches to. */
export function backgroundButtonTitle(state: BackgroundState): string {
    return `Background: ${LABELS[nextBackground(state)]}`;
}
