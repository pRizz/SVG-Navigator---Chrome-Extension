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
/** The minimap stays at the bottom, across from the pill. */
export type MinimapCorner = 'bottom-left' | 'bottom-right';

export interface HudLayout {
    orientation: Orientation;
    popoverDirection: PopoverDirection;
    debugCorner: DebugCorner;
    minimapCorner: MinimapCorner;
}

const LAYOUTS: Readonly<Record<ToolbarPosition, HudLayout>> = {
    'top-left': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right', minimapCorner: 'bottom-right' },
    'top': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right', minimapCorner: 'bottom-left' },
    'top-right': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-left', minimapCorner: 'bottom-left' },
    'left': { orientation: 'vertical', popoverDirection: 'right', debugCorner: 'top-right', minimapCorner: 'bottom-right' },
    'right': { orientation: 'vertical', popoverDirection: 'left', debugCorner: 'top-left', minimapCorner: 'bottom-left' },
    'bottom-left': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left', minimapCorner: 'bottom-right' },
    'bottom': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left', minimapCorner: 'bottom-left' },
    'bottom-right': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left', minimapCorner: 'bottom-left' },
};

export function hudLayout(position: ToolbarPosition): HudLayout {
    return LAYOUTS[position];
}
