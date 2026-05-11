# Copilot Instructions - Mona Mayhem Context System

These instructions define the permanent design system and lore context for all UI generated in this repository.

## Mission
Mona Mayhem is an arcade duel simulator for GitHub contribution warriors. Every new page should feel like a scene from one connected game world.

## Visual Language (Required)
- Theme: retro-neon cyber arcade.
- Primary background: `#0a0a1a`.
- Primary text: `#ffffff`.
- Accent A (energy green): `#5fed83`.
- Accent B (plasma purple): `#8a2be2`.
- Accent C (hot pink button emphasis): `#ff00ff`.
- Danger accent: `#ff3333`.

## Typography (Required)
- Use `'Press Start 2P', cursive` for headings, buttons, labels, and key UI text.
- Keep copy short and punchy, like arcade UI prompts.

## Layout Rules (Required)
- Prefer CSS Grid for main page structure and major sections.
- Keep spacing blocky and deliberate (retro cabinet feeling).
- Avoid generic card overload; each section should have one clear job.

## Motion Rules (Required)
- Include at least 2 purposeful animations per new page:
  - one entrance or pulse animation for a key headline,
  - one ambient background or hover interaction.
- Keep motion fast and readable; avoid noisy loops.

## Atmosphere Rules
- Include CRT/scanline flavor on full-page views.
- Use neon glow sparingly on important actions only.
- Use high-contrast states for win/tie/loss moments.

## Lore Rules
- The arena runs under one fiction:
  - Players are "coders" battling in the "Neon Grid".
  - Match outcomes are "broadcasts" from the "Arena Core".
  - End states should reference terms like "round", "transmission", "arena", "core", or "signal".

## Component Guidance
When generating battle-adjacent UI (results, match history, game-over, round summary):
- Always show who fought and who won (or tie).
- Include score context if available.
- Include at least one clear action to continue (retry, new round, or leaderboard).
- Use accent colors semantically:
  - green for success,
  - pink for primary CTA,
  - red for danger/reset.

## Accessibility + Responsiveness
- Ensure visible focus states for buttons/links.
- Ensure UI works at mobile widths without horizontal scroll.
- Keep text readable against glowing backgrounds.

## Technical Guidance
- Use Astro page routes under `src/pages`.
- Keep styles local to pages unless a shared style is clearly needed.
- Use TypeScript-safe DOM access in script blocks.
- Prefer simple data parsing and robust fallback values.
