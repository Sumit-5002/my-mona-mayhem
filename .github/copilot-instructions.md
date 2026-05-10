# Copilot Instructions for Mona Mayhem

## Project Overview

**Mona Mayhem** is an Astro-based workshop project that builds a retro arcade-themed GitHub Contribution Battle Arena. It compares GitHub contribution graphs of two users through a vintage gaming interface.

The repository is a **workshop template** designed for learning Copilot workflows (both VS Code and CLI tracks). It includes step-by-step guides in the `workshop/` directory for building features incrementally.

## Build, Test & Run Commands

### Development
```bash
npm install      # Install dependencies (only needed once)
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm run astro    # Access Astro CLI directly
```

**No test or lint commands exist yet** — the project is intentionally minimal to be built during the workshop.

## Architecture

### Tech Stack
- **Framework**: Astro 5 with Node.js SSR adapter (`@astrojs/node`)
- **Runtime**: Node.js (configured for standalone mode)
- **Styling**: CSS (retro Press Start 2P font for arcade aesthetics)
- **API**: GitHub's contribution graph API (scraped from `github.com/{username}.contribs`)

### Project Structure

```
src/
├── pages/
│   ├── index.astro           # Main landing page (starter template)
│   └── api/
│       └── contributions/
│           └── [username].ts # API endpoint for fetching user contribution data
public/                        # Static assets (favicon, etc)
docs/                         # (Empty, may be populated during workshop)
workshop/                     # Step-by-step workshop guides
```

### Key Architectural Decisions

1. **Server-side rendering only** — `output: 'server'` in `astro.config.mjs` means all pages render on the server. This is intentional for the workshop to teach server-side patterns.

2. **Dynamic API endpoint** — `src/pages/api/contributions/[username].ts` uses Astro's file-based routing with dynamic parameters. The `prerender = false` flag ensures it stays dynamic (not pre-built).

3. **Minimal starter state** — Both `index.astro` and the API endpoint are skeleton templates with TODO comments. Workshop participants fill these in.

## Key Conventions

### Astro File Patterns

- **`.astro` files** use two distinct sections:
  - **Frontmatter** (between `---` markers) — Server-side JavaScript, imports, environment variables. Runs only at build time or request time.
  - **Template** (below frontmatter) — HTML markup with optional embedded expressions `{variableName}`.
  
- **`.ts` files in `src/pages/api/`** — Export `APIRoute` functions for request handling. `export const GET`, `export const POST`, etc.

### GitHub Contribution API

The endpoint to fetch a user's contribution graph is:
```
https://github.com/{username}.contribs
```

This is a special endpoint (not public GraphQL) that serves SVG data. Implementations typically:
- Fetch the URL with the username
- Parse the SVG or extract contribution calendar data
- Return JSON-formatted data to the frontend

### Workshop Structure

Workshop modules are in `workshop/` and use **track-aware content**:
- `<!-- track:vscode:start -->` and `<!-- track:vscode:end -->` — VS Code-specific instructions
- `<!-- track:cli:start -->` and `<!-- track:cli:end -->` — CLI-specific instructions

This allows conditional guidance per track. Ignore these markers unless building workshop tooling.

## Development Notes

- **ESM-only module** — `"type": "module"` in `package.json` means CommonJS isn't supported. Use ES6 import/export syntax.
- **TypeScript strict mode** — `tsconfig.json` extends `"astro/tsconfigs/strict"`. TypeScript is required.
- **No linting or formatting yet** — Consider adding ESLint and Prettier if the project scales beyond the workshop scope.

## MCP Servers

**Playwright** is configured for browser automation. Use it to:
- Test the UI after building features (navigate to `localhost:3000`, interact with forms)
- Verify the contribution battle arena renders correctly
- Screenshot arcade UI for validation

## Deployment

The app is built for server-side rendering with Node.js. The output is a standalone build artifact. ## Design Guide: Retro Arcade Theme

All future UI development must adhere to the **Retro Arcade** aesthetic:

- **Colors**: Use a dark palette with neon accents.
  - Background: `#0a0a1a`
  - Neon Green (Accent): `#5fed83`
  - Neon Purple (Accent): `#8a2be2`
  - Text: `#ffffff`
- **Typography**: Use the **'Press Start 2P'** cursive font for all headers, buttons, and UI text.
- **Animations**:
  - **Neon Pulse**: Headers should have a soft, pulsing neon glow.
  - **CRT Scanlines**: Maintain the vintage monitor scanline effect across the background.
  - **Shimmer/Shine**: Interactive cards and result areas should have subtle shimmer overlays.
  - **Glow on Hover**: Interactive elements like contribution squares should glow when hovered.
- **Layout**: Keep layouts simple and grid-based, reminiscent of 8-bit arcade cabinets.
- **Power-Ups & Special Moves**: 
  - Power-Ups should be displayed as glowing yellow labels below the username.
  - Special Moves should use high-intensity animations (e.g., Green Inferno, Octo-Slam) when triggered by data milestones.


