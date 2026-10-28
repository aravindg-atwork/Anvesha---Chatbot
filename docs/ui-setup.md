# UI structure and component setup

The application already used React, Vite and TypeScript. Tailwind CSS v4, its Vite plugin, the `@/` import alias and a shadcn-compatible `components.json` have now been added.

## Paths

| Purpose | Path |
| --- | --- |
| Shared/registry UI components | `src/components/ui/` (`@/components/ui`) |
| Existing application-specific controls | `src/ui/components/ui.tsx` |
| Shared class utility | `src/lib/utils.ts` (`@/lib/utils`) |
| Tailwind entry and semantic colour aliases | `src/styles/tailwind.css` |
| Existing application styles | `src/styles/app.css` |
| Product theme and glass layouts | `src/styles/product.css` |

This repository keeps application code under `src`, so `/components/ui` corresponds to `src/components/ui`. The previous `src/ui/components/ui.tsx` contains application-specific form, modal and button APIs. Keeping new reusable components in `src/components/ui` gives registry components a predictable home, makes the supplied `@/components/ui/...` imports work, and avoids overwriting those existing APIs.

## Already installed

```bash
npm install clsx tailwind-merge @tabler/icons-react
npm install -D tailwindcss @tailwindcss/vite
```

Vite loads `@tailwindcss/vite`; `tsconfig.json` and Vite resolve `@/` to `src/`. Tailwind's theme and utility layers are imported without Preflight because the existing application already owns its reset, typography, forms and layout. This prevents a global CSS reset from changing existing screens. Semantic background, foreground, primary, border, ring and related utilities map onto the application's CSS tokens.

The shadcn structure is configured manually following the existing-project setup. To add a new shadcn component:

```bash
npx shadcn@latest add separator
```

For a fresh Vite project without these files, the setup path is:

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install -D tailwindcss @tailwindcss/vite
# Configure the Tailwind Vite plugin, CSS import and @ alias, then:
npx shadcn@latest init
```

The current project is already configured; reinitialization is unnecessary. Review CLI changes before replacing existing theme or utility files.

## ThinkingTool

`thinking-tool.tsx` is the supplied component with its controlled and uncontrolled expansion API, memoization, shimmer and Tabler chevron. It adds a unique accessible content target and a static reduced-motion treatment. No context provider is needed.

- Chat passes `state="thinking"` with a short description of the active operation.
- Training passes actual persisted processing events as `content`, with `thinking` for queued/running jobs and `thought` for finished jobs.
- The content is an operation summary/activity log, not private model reasoning.
- `thinking-tool-demo.tsx` contains the supplied standalone example.

## Mesh shader and frosted glass

`dark-mono.tsx` preserves the supplied Mesh drift shader and recipe, adding shader compilation/link checks, a static fallback, context recovery and reduced-motion handling. It has no external runtime dependencies or required image assets.

- Authentication places the canvas behind the content, with translucent form and source cards using `backdrop-filter`.
- The project header uses the same effect with lighter motion behind its workspace card.
- Animation pauses offscreen and when the tab is hidden; rendering is capped at two million pixels.
- Reduced-motion mode renders a static frame and disables pointer animation.
- `dark-mono-demo.tsx` contains the standalone shader example.
- The optional `colors` prop accepts up to eight hex colours; the default preserves the supplied blue recipe.

The initial theme keeps the existing navy, ivory and amber, centralized as `--brand-ink`, `--brand-paper` and `--brand-highlight` in `product.css`, pending the exact requested palette. No stock images are needed for these canvas and glass compositions.

References: [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite), [shadcn components.json](https://ui.shadcn.com/docs/components-json), [affectUI component documentation](https://www.affectui.com/docs).
