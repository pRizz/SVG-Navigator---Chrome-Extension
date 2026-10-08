/**
 * How the HUD arranges itself for each toolbar position. Anchoring to the window
 * edges is CSS (`[data-position]` in `styles.ts`); this decides the rest.
 */

import type { ToolbarPosition } from '../../shared/settings';

export type Orientation = 'horizontal' | 'vertical';
/** The side of the pill the shortcuts popover opens on: always toward the window's interior. */
export type PopoverDirection = 'top' | 'bottom' | 'left' | 'right';
/** The debug card stays at the top, on whichever side the pill leaves free. */
export type DebugCorner = 'top-left' | 'top-right';

export interface HudLayout {
    orientation: Orientation;
    popoverDirection: PopoverDirection;
    debugCorner: DebugCorner;
}

const LAYOUTS: Readonly<Record<ToolbarPosition, HudLayout>> = {
    'top-left': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right' },
    'top': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right' },
    'top-right': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-left' },
    'left': { orientation: 'vertical', popoverDirection: 'right', debugCorner: 'top-right' },
    'right': { orientation: 'vertical', popoverDirection: 'left', debugCorner: 'top-left' },
    'bottom-left': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
    'bottom': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
    'bottom-right': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
};

export function hudLayout(position: ToolbarPosition): HudLayout {
    return LAYOUTS[position];
}
