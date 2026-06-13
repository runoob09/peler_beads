# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check (vue-tsc) then production build (vite build)
npm run preview   # Preview production build locally
```

## Architecture

- **Vue 3** with `<script setup>` SFCs and TypeScript
- **Vite 8** for dev server and bundling
- Entry point: `index.html` → `src/main.ts` → `src/App.vue`

### CSS

Design tokens are defined as CSS custom properties on `:root` in `src/style.css`, with light and dark variants (`prefers-color-scheme: dark`). The design uses CSS nesting (native, no preprocessor). Colors use an accent-purple palette.

### TypeScript

- `tsconfig.app.json` — app source (`src/**`), extends `@vue/tsconfig/tsconfig.dom.json`
- `tsconfig.node.json` — node-side config (vite.config.ts), bundler module resolution
- Root `tsconfig.json` references both via project references
- Strict flags: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`
