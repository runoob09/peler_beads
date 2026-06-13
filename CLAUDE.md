# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check (vue-tsc) then production build (vite build)
npm run preview   # Preview production build locally
npm run test      # Run all tests (vitest run)
npm run test:watch # Run tests in watch mode
```
## Workflow

**每项功能必须编写测试用例**，先写测试（TDD：test → fail → implement → pass），测试文件放在对应 `__tests__/` 目录下。

**每次功能修改完成后必须 git commit**，提交信息使用 conventional commits 格式：

```bash
git add -A
git commit -m "feat/fix/chore: <简短描述>"
```

提交前确保 `npm run test` 通过且 `npx vue-tsc -b` 无类型错误。

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
