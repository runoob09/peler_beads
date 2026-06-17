# Perler Beads Pattern Tool

Convert images into perler bead patterns, paint freely on a blank canvas, and export ready-to-use bead diagrams.

## Features

- **Image to Bead Pattern** — Upload an image and convert it into a bead grid using 5 color calculation algorithms (Average, Dominant, Bucket Quantization, Median Cut, Center-Weighted) and 4 color matching methods (Delta E, RGB Distance, Weighted RGB, CIEDE2000).
- **Built-in Image Editor** — Crop, rotate, flip, and apply HSL filters to uploaded images before conversion.
- **Blank Canvas Mode** — Start with an empty grid and paint freely with brush, eraser, rectangle selection, and undo/redo.
- **Connected-Component Color Replace** — Right-click any bead cell to replace all connected cells of the same color with a different color.
- **Multi-Brand Palette** — Choose from real-world bead color palettes, add custom colors, and remove unwanted colors on the fly.
- **Export PNG / PDF** — Export bead diagrams with configurable cell size and grid lines. Project data (grid, palette, settings) is embedded in exports, allowing re-import for further editing.
- **Import Drawing** — Re-import previously exported PNG or PDF files to restore the full editable project state.
- **Focus Mode** — Split the bead pattern into per-color blocks with keyboard navigation (←/→), cell marking, a built-in timer, and progress persistence via localStorage — ideal for guided, step-by-step beading sessions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript |
| Build | Vite 8 |
| State | Pinia |
| Routing | Vue Router (Hash mode) |
| PDF Export | pdf-lib |
| Testing | Vitest + @vue/test-utils + happy-dom |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (HMR)
npm run dev

# Type-check and production build
npm run build

# Preview production build
npm run preview
```

## Usage

### Image Mode

1. Select a bead brand palette from the dropdown.
2. Upload an image — the built-in editor will open for cropping / rotating / filtering.
3. Adjust grid size (rows × cols), color calculation method, matching algorithm, and tolerance.
4. The bead preview updates in real time.

### Blank Canvas Mode

1. Switch to the **Blank** tab.
2. Set the desired grid dimensions and click **Create Canvas**.
3. Toggle brush mode, pick a color, and start painting.
4. Use **Undo** / **Redo** to revert or reapply strokes.
5. Rectangle select: hold mouse to draw a selection rectangle, release to fill.

### Export & Import

- Click **Export** → choose PNG or PDF, configure cell size and grid lines → download.
- Click **Import Drawing** → select a previously exported `.png` or `.pdf` file to restore the full project (grid data, palette, settings).

### Focus Mode

1. After generating a bead pattern, click **Focus Mode**.
2. The pattern is split into color blocks. Work through them one at a time.
3. Mark cells as you place them; press **Space** to complete the current color.
4. Use **← / →** arrow keys to switch between color blocks.
5. Progress is saved to localStorage — resume anytime even after closing the browser.

## Project Structure

```
src/
├── App.vue                  # Root component
├── main.ts                  # App entry point
├── style.css                # Global styles + CSS custom properties
├── types/
│   └── index.ts             # TypeScript type definitions
├── data/
│   ├── palettes.ts          # Bead color palettes (brand-based)
│   └── boardPresets.ts      # Board size presets
├── stores/
│   ├── beadStore.ts         # Core bead grid state & processing
│   ├── brushStore.ts        # Brush / eraser / select / undo-redo
│   ├── paletteStore.ts      # Palette selection & custom colors
│   └── focusStore.ts        # Focus mode state & persistence
├── composables/
│   ├── useImageProcessor.ts # Color extraction algorithms
│   ├── useColorMatcher.ts   # Color matching methods
│   ├── useImageEditor.ts    # Crop / rotate / flip / HSL filters
│   ├── useClusterer.ts      # Color-cluster block generation
│   ├── useExport.ts         # Canvas rendering & PNG export
│   ├── useZoomPan.ts        # Zoom & pan for bead preview
│   ├── useCellSize.ts       # Cell size calculation
│   ├── useGridInteraction.ts# Mouse interaction helpers
│   ├── useKeyboardShortcuts.ts
│   └── useTimer.ts          # Focus mode timer
├── utils/
│   ├── exportPdf.ts         # PDF generation (pdf-lib)
│   ├── embedMetadata.ts     # Embed/extract project JSON in PNG/PDF
│   └── colorSpace.ts        # RGB ↔ Lab color space conversion
├── components/
│   ├── BeadPreview.vue      # Main bead grid canvas
│   ├── ControlPanel.vue     # Settings & palette controls
│   ├── ColorLegend.vue      # Color legend with bead counts
│   ├── ImageUploader.vue    # File upload UI
│   ├── ImageEditorModal.vue # Image editing modal
│   ├── ExportModal.vue      # Export configuration dialog
│   ├── PaletteSelector.vue  # Brand selector dropdown
│   ├── PalettePanel.vue     # Palette color list
│   ├── PaletteEditor.vue    # Custom color editor
│   ├── SizeSelector.vue     # Grid dimension controls
│   ├── ExportButtons.vue    # Export format buttons
│   └── focus/               # Focus mode sub-components
│       ├── FocusToolbar.vue
│       ├── FocusGrid.vue
│       ├── FocusColorBar.vue
│       ├── FocusColorList.vue
│       └── FocusBottomBar.vue
└── pages/
    ├── DesignPage.vue       # Main design page
    └── FocusPage.vue        # Focus mode page
```

## Development

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Type-check
npx vue-tsc -b
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Ensure `npm run test` passes and `npx vue-tsc -b` has zero errors before committing.

## License

MIT
