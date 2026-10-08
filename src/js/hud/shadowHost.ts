/** The HUD's shadow host: one element whose page-facing styles the page can't override. */

export const HUD_HOST_TAG = 'svg-navigator-hud';

// Inline `!important` outranks every page stylesheet rule, `!important` ones included,
// so even an SVG's own `<style>` can't hide or move the host.
const HOST_STYLE: Readonly<Record<string, string>> = {
    'display': 'block',
    'position': 'fixed',
    'inset': '0',
    'margin': '0',
    'padding': '0',
    'border': 'none',
    'background': 'none',
    'opacity': '1',
    'visibility': 'visible',
    'transform': 'none',
    'filter': 'none',
    'clip-path': 'none',
    // The host covers the window; only the HUD's own controls take the pointer.
    'pointer-events': 'none',
    'z-index': '2147483647',
};

export function createShadowHost(htmlDoc: Document, parent: HTMLElement, css: string): { host: HTMLElement, root: ShadowRoot } {
    // A custom element name: allowed to host a shadow root without being registered.
    const host = htmlDoc.createElement(HUD_HOST_TAG);
    for (const [property, value] of Object.entries(HOST_STYLE)) {
        host.style.setProperty(property, value, 'important');
    }
    // Open, so E2E tests can reach inside; the HUD holds nothing the page shouldn't see.
    const root = host.attachShadow({ mode: 'open' });
    adoptStyles(htmlDoc, root, css);
    parent.append(host);
    return { host, root };
}

/**
 * Prefers a constructed stylesheet, which no page Content-Security-Policy can block.
 * Chrome and Firefox both reject it here (the shadow root's document is the wrapper
 * `htmlDoc`, not the page's), so they get a `<style>` element, which both still apply
 * under `default-src 'none'` because the extension injected it.
 */
function adoptStyles(htmlDoc: Document, root: ShadowRoot, css: string): void {
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
    } catch (error) {
        console.debug('SVG Navigator: constructed stylesheet rejected; using a <style> element', error);
        const style = htmlDoc.createElement('style');
        style.textContent = css;
        root.prepend(style);
    }
}
