# Browser OS — Design System
Applied from the UI/UX Pro Max skill methodology (nextlevelbuilder/ui-ux-pro-max-skill):
one coherent style, a locked type pairing, an 8px spacing scale, functional hierarchy,
compositor-friendly motion presets, and WCAG-conscious contrast.

## Style: "Native Translucency" (macOS × Linear × Raycast)
- Surfaces: layered glass with 60–72% opacity, 20–28px backdrop blur, 1px inner hairline.
- Radii: icons 22%, windows 10px, menus 8px, controls 6px, pills full.
- Shadows: 3 tiers (hairline / floating / elevated). Never pure black — rgba(15,18,25,.x).

## Type pairing
- Identity / UI: SF stack with **Manrope** fallback (weights 400–800).
- Mono: ui-monospace (SF Mono) for Terminal & code previews.
- Scale: 11 (menus) / 12 (labels) / 13 (UI) / 15 (content) / 22+ (display).

## Palette
- Accents are user-selectable; default system blue #0a84ff.
- Semantic: success #30d158, warning #ff9f0a, danger #ff453a.
- Neutral ramp tuned per appearance mode; text at ≥4.5:1 on surfaces.

## Spacing & layout
- 4px base unit; menu bar 30px; dock icons 48–64px; sidebar 200px; grid 8px.
- Desktop icons snap to a 92px grid with 8px gutters.

## Motion presets (cause → movement → destination → result)
- Window open: scale .92→1 + fade, 220ms cubic-bezier(.2,.9,.3,1).
- Minimize: 260ms ease-in scale+translate to dock (genie).
- Menus/popovers: 120ms scale .96→1 fade.
- Overlays (Spotlight/Mission Control): 240ms spring-ish fade+scale.
- Respect prefers-reduced-motion & user setting: durations → 0.

## Accessibility
- Focus-visible rings (2px accent), ARIA labels on icon buttons, keyboard
  navigation for menus/Spotlight/Dock, reduced motion, text scaling, contrast toggle.
