/**
 * Puppeteer config: download Firefox alongside Chrome so the E2E suite can
 * exercise the extension in both browsers.
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    firefox: { skipDownload: false },
};
