---
name: lumen-design
description: Use this skill to generate well-branded interfaces and assets for Lumen, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

Lumen is a **quiet, warm, paper-toned** research workspace for independent researchers. UI language is **Simplified Chinese** (with English preserved for metadata — DOI, arXiv, venue names).

Design pillars:
- Minimal / sharp / modern + soft / calm / focus mode
- Warm paper palette (cream, ink, sepia — never cool grays, never bluish purples)
- Sans display (Inter Tight) + serif body (Source Serif 4) for reading comfort
- Light theme first
- Almost no emoji. No AI-hype language.

## Files

- `README.md` — full brand guidelines (voice, visuals, layout)
- `colors_and_type.css` — CSS tokens, import this first
- `ICONOGRAPHY.md` — icon system (Lucide, 1.5px stroke)
- `assets/logo/` — mark + wordmark SVGs
- `ui_kits/desktop/` — React component recreations (AppShell, Library, Reader, DeepResearch, Graph)
- `preview/` — design-system specimen cards

When building, always link `colors_and_type.css` and prefer the semantic type classes + CSS vars over hardcoded values.
