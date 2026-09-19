# PANORAMA — Carousel to Full Image

A focused browser-based utility that reconstructs carousel slides into one full-resolution panorama. It is designed around the real-world case where a wide image was split into portrait carousel slides and later downloaded as separate files.

## Main features
- Multi-image upload with drag/drop and native file picker
- Drag-to-reorder, arrow ordering, reverse order, remove, and replace
- Horizontal and vertical stitching
- Pixel-preserving direct join
- Conservative automatic overlap detection using local pixel comparison
- Manual per-seam overlap correction with live rebuild
- PNG and user-selectable high-quality JPEG export
- Large-canvas safety checks
- Mobile-friendly, horizontally scrollable previews
- Built-in generated demo images
- No backend, account, database, paid API, or AI model

## Privacy
All normal image decoding, analysis, stitching, preview generation, and export happen inside the browser. Files are not uploaded by this project.

## Stitching model
Direct joins concatenate source pixel regions without rescaling them. Automatic seam analysis creates reduced-size temporary canvases and compares the right edge of one slide with the left edge of the next (or bottom/top for vertical mode). A detected overlap is applied only when confidence is high. Otherwise the safer direct join remains in place and manual editing is available.

## Install
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Quality checks
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Production
```bash
npm run build
npm start
```

## Vercel
Import the repository into Vercel. No environment variables are required.

## Browser requirements
A modern browser with Canvas, Blob URLs, File, and `createImageBitmap` support. JPG/JPEG, PNG, and WEBP are accepted when supported by the browser.

## Known limitations
- Browser canvas dimension and memory limits vary by device.
- Automatic overlap matching is intentionally conservative and may need manual adjustment for difficult seams.
- Canvas export does not promise to preserve source EXIF metadata.
- Slides with different cross-axis sizes are not stretched; the output canvas uses the largest size and leaves unused space transparent (PNG) or background-colored by JPEG encoding behavior.

## No API key required
The core app has no OpenAI, Google, paid image, or cloud processing dependency.
