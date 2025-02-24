SVG Navigator
====================

Description
--------------------------------
SVG Navigator is an extension for Google Chrome that adds pan and zoom features to existing SVG files on the web.

Note
--------------------------------
You can access file URLs by going to Chrome's extension settings, and checking "Allow access to file URLs".

Usage
--------------------------------
Go to a website with an SVG file. The extension begins working on the SVG graphic and you may:
* Pan: click and drag or hold the space bar and drag the cursor to pan around the image
* Zoom in or out: use mouse scroll wheel
* Zoom: click and drag a zoom box of the desired area if enabled
* Zoom out: tap alt key
* Reset zoom: press escape
Trying to pan on an SVG by shift click and dragging currently causes undesirable panning; possibly a Google Chrome bug/feature.
If you want to view local files with this extension, you must enable "Allow access to file URLs" in Chrome's Extensions view.

Try Testing Out These SVGs
---------------------------------
* Vector vs Raster: http://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg
* World Map: http://upload.wikimedia.org/wikipedia/commons/1/17/World.svg
* Map of the United States of America: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
* Constellation Orion: http://upload.wikimedia.org/wikipedia/commons/f/ff/Orion_IAU.svg
* Bertrand's Chords: http://upload.wikimedia.org/wikipedia/commons/9/91/Bertrand3-chords.svg
* P and N type Silicon: http://upload.wikimedia.org/wikipedia/commons/2/20/CellStructure-SiCrystal-eng-vect.svg
* Diagram of Zeta Potential and Slipping Plane: http://upload.wikimedia.org/wikipedia/commons/6/62/Diagram_of_zeta_potential_and_slipping_plane.svg
* Earth Color Trace: http://upload.wikimedia.org/wikipedia/commons/4/4e/Earth_Color_Trace.svg
* Magnetic Moment: http://upload.wikimedia.org/wikipedia/commons/4/4c/Magnetic_moment.svg
* Simple Mandelbrot: http://upload.wikimedia.org/wikipedia/commons/3/3c/Mandelbrot_Components.svg
* Animated Digitial Clock: http://www.bogotobogo.com/svg_source/SVGDigitalClock.svg

No `svg` extension pages (e.g. GitHub and PlantUML)

* https://img.plantuml.biz/plantuml/svg/SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKi1IW80

Useful Links
------------------------------
* SVG 1.1 Second Edition Specifications: http://www.w3.org/TR/SVG11/
* Official Google Chrome extension page: https://chrome.google.com/webstore/detail/svg-navigator/pefngfjmidahdaahgehodmfodhhhofkl
* Github Repository: https://github.com/pRizz/SVG-Navigator---Chrome-Extension

Acknowledgements
-----------------------------
Concept originally created by Asad Akram, Ryan Oblenida aka Mr. O, and Peter Ryszkiewicz at the Illinois Institute of Technology.
Adapted as a Google Chrome extension by Peter Ryszkiewicz. Work was inspired by Kevin Lindsey at http://www.kevlindev.com/index.htm.
Illustrations by Cara Stemo.

Build Instructions
--------------------------------
### Requirements
- Operating System: Windows, macOS, or Linux
- Node.js 18.x or later
- npm 9.x or later
- pnpm 8.x or later (required package manager)

### Installation
1. Install Node.js and npm from [nodejs.org](https://nodejs.org/)
2. Install pnpm:
   ```bash
   npm install -g pnpm
   ```
3. Clone the repository:
   ```bash
   git clone https://github.com/pRizz/SVG-Navigator---Chrome-Extension.git
   cd SVG-Navigator---Chrome-Extension
   ```
4. Install dependencies:
    ```bash
    pnpm install
    ```

### Building

1. Build the extension:
   ```bash
   pnpm build:all
   ```

The built extensions will be available in:
- Chrome: `dist/chrome/`
- Firefox: `dist/firefox/`
- Safari: `dist/safari/`

The packaged extensions will be available in:
- Chrome: `packages/svg-navigator...chrome.zip`
- Firefox: `packages/svg-navigator...firefox.xpi`
- Safari: `packages/svg-navigator...safari.zip`

### Development

For development with hot-reload:

- Chrome:
  ```bash
  pnpm start:chrome
  ```

- Firefox:
  ```bash
  pnpm start:firefox
  ```

- Safari:
  ```bash
  pnpm start:safari
  ```

These commands will build the extension and start a development server that watches for changes.

### Linting

To run linting:
```bash
pnpm lint
```
