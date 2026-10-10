/**
 * The HUD's stylesheet, adopted inside its shadow root. Colors follow the options
 * popup (`src/options/options.css`), light or dark by the OS setting.
 */
export const HUD_CSS = `
:host {
    all: initial;
    --surface: #fff;
    --text: #1f2328;
    --muted: #656d76;
    --border: #e1e4e8;
    --hover: rgb(0 0 0 / 6%);
    --active: rgb(0 0 0 / 12%);
    --accent: #1a73e8;
    --shadow: 0 1px 2px rgb(0 0 0 / 8%), 0 4px 12px rgb(0 0 0 / 10%);
    --edge: 16px;
    --radius: 10px;
    --mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    color-scheme: light dark;
}

/* Declared on the roots inside the shadow tree: a page rule like "* { font-size: 40px }"
   matches the host and would beat the same declarations on :host. */
.dock, .debug, .debug-chip {
    color: var(--text);
    font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
    letter-spacing: normal;
    text-transform: none;
}

@media (prefers-color-scheme: dark) {
    :host {
        --surface: #26282b;
        --text: #e8eaed;
        --muted: #9aa0a6;
        --border: #3c4043;
        --hover: rgb(255 255 255 / 8%);
        --active: rgb(255 255 255 / 16%);
        --accent: #8ab4f8;
        --shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 4px 12px rgb(0 0 0 / 35%);
    }
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.icon {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

/* The dock holds the pill and its popover, pinned to an edge or corner. */
.dock { position: fixed; pointer-events: auto; transition: opacity 200ms ease; }
.dock[data-hidden] { opacity: 0; pointer-events: none; }
.dock[data-position^="top"] { top: calc(var(--edge) + env(safe-area-inset-top, 0px)); }
.dock[data-position^="bottom"] { bottom: calc(var(--edge) + env(safe-area-inset-bottom, 0px)); }
.dock[data-position$="left"] { left: calc(var(--edge) + env(safe-area-inset-left, 0px)); }
.dock[data-position$="right"] { right: calc(var(--edge) + env(safe-area-inset-right, 0px)); }
.dock:is([data-position="top"], [data-position="bottom"]) { left: 50%; transform: translateX(-50%); }
.dock:is([data-position="left"], [data-position="right"]) { top: 50%; transform: translateY(-50%); }

.pill {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
}
.pill[data-orientation="vertical"] { flex-direction: column; }
.pill button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--muted);
    cursor: pointer;
}
.pill button:hover { background: var(--hover); color: var(--text); }
.pill button:active { background: var(--active); }
.pill .zoom-label {
    min-width: 56px;
    padding: 0 8px;
    color: var(--text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.separator { flex: none; width: 1px; height: 18px; margin: 0 3px; background: var(--border); }
.pill[data-orientation="vertical"] .separator { width: 18px; height: 1px; margin: 3px 0; }
.pill[data-orientation="vertical"] .zoom-in { order: 1; }
.pill[data-orientation="vertical"] .zoom-label { order: 2; min-width: 32px; height: 28px; padding: 0 2px; font-size: 11px; }
.pill[data-orientation="vertical"] .zoom-out { order: 3; }
.pill[data-orientation="vertical"] :is(.separator, .utility) { order: 4; }

.popover {
    position: absolute;
    width: max-content;
    max-width: 300px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
}
.popover[data-direction="top"] { bottom: calc(100% + 8px); }
.popover[data-direction="bottom"] { top: calc(100% + 8px); }
.popover[data-direction="left"] { right: calc(100% + 8px); top: 50%; transform: translateY(-50%); }
.popover[data-direction="right"] { left: calc(100% + 8px); top: 50%; transform: translateY(-50%); }
.dock:is([data-position="top-left"], [data-position="bottom-left"]) .popover { left: 0; }
.dock:is([data-position="top-right"], [data-position="bottom-right"]) .popover { right: 0; }
.dock:is([data-position="top"], [data-position="bottom"]) .popover { left: 50%; transform: translateX(-50%); }
.popover h2 {
    margin: 0 0 6px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.popover dl { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 0; }
.popover dd { margin: 0; color: var(--muted); text-align: right; }

.debug, .debug-chip { position: fixed; top: calc(var(--edge) + env(safe-area-inset-top, 0px)); }
:is(.debug, .debug-chip)[data-corner="top-left"] { left: calc(var(--edge) + env(safe-area-inset-left, 0px)); }
:is(.debug, .debug-chip)[data-corner="top-right"] { right: calc(var(--edge) + env(safe-area-inset-right, 0px)); }
.debug {
    width: 300px;
    max-height: calc(100vh - 2 * var(--edge));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
}
.debug-header {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 4px 4px 10px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    pointer-events: auto;
}
.debug-header span { margin-right: auto; }
.debug-header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;
}
.debug-header button:hover { background: var(--hover); color: var(--text); }
.debug-header .icon { width: 15px; height: 15px; }
/* The body never takes the pointer, so the card never blocks panning underneath. */
.debug-body { padding: 4px 10px 8px; pointer-events: none; }
.debug-body h3 {
    margin: 6px 0 2px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.debug-body dl { display: grid; grid-template-columns: max-content 1fr; gap: 1px 10px; margin: 0; }
.debug-body dt { color: var(--muted); }
.debug-body dd { margin: 0; font: 12px/1.4 var(--mono); overflow-wrap: anywhere; }
.debug-chip {
    padding: 4px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
}

/* The minimap: an overview of the drawing in a bottom corner, the view outlined. */
.minimap {
    position: fixed;
    bottom: calc(var(--edge) + env(safe-area-inset-bottom, 0px));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: var(--shadow);
    cursor: pointer;
    pointer-events: auto;
    touch-action: none;
    transition: opacity 200ms ease;
}
.minimap[data-corner="bottom-left"] { left: calc(var(--edge) + env(safe-area-inset-left, 0px)); }
.minimap[data-corner="bottom-right"] { right: calc(var(--edge) + env(safe-area-inset-right, 0px)); }
.minimap[data-hidden] { opacity: 0; pointer-events: none; }
.minimap-frame { display: block; width: 100%; height: 100%; pointer-events: none; }
.minimap-outline {
    position: absolute;
    border: 2px solid var(--accent);
    border-radius: 2px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    cursor: grab;
    pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
    .dock, .minimap { transition: none; }
}
`;
