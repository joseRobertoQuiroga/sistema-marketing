---
name: OmniPresence Suite
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin: 32px
  max_width: 1440px
---

## Brand & Style

This design system is engineered for a high-end, analytical environment that bridges the gap between executive oversight and granular data analysis. The brand personality is authoritative, precise, and technologically sophisticated. 

The aesthetic follows a **Modern Corporate** direction infused with **Minimalist** principles and **Refined Glassmorphism**. It prioritizes clarity and information density, ensuring that SMB owners feel a sense of control while data analysts find the environment efficient. Visual interest is generated through depth and material layering rather than decorative elements, creating a "command center" atmosphere that feels both premium and functional.

## Colors

The palette is anchored by **Deep Slate (#0F172A)**, providing a low-strain, high-contrast foundation for extended data review. **Indigo (#6366F1)** serves as the primary action color, chosen for its vibrancy against dark backgrounds and its association with intelligence and modern tech. 

**Emerald (#10B981)** is utilized sparingly as a high-signal accent for growth metrics, success states, and positive trend lines. Neutral tones are derived from the Slate scale to maintain monochromatic harmony, while background surfaces utilize slight variations in value to establish hierarchy without the need for heavy borders.

## Typography

This design system utilizes a dual-type strategy to balance technical aesthetics with readability. **Space Grotesk** is used for headlines, display metrics, and labels to lean into a geometric, "engineered" look that suggests innovation. 

**Inter** is the workhorse for body copy, data tables, and tooltips, ensuring maximum legibility at small sizes. Data density is achieved by using tight line-heights for labels and slightly wider tracking for headers to maintain breathability. For numerical values in dashboards, use the `data-mono` style to ensure tabular alignment and a "ticker" feel.

## Layout & Spacing

The system employs a **12-column fluid grid** designed for complex dashboards. A strict 4px baseline grid ensures vertical rhythm across dense data components. 

Information is organized into modular "tiles" or "panes." Gaps are kept tight (16px - 20px) to maximize the amount of visible data on a single screen while preventing the UI from feeling cluttered. Content margins are generous at 32px to provide a professional "frame" for the technical data inside. Lateral padding within components follows a condensed scale (8px for inputs, 12px for table cells) to support the data-dense requirement.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Refined Glassmorphism**. 
- **Base:** The background (#0F172A).
- **Surface:** Primary containers use a slightly lighter slate (#1E293B) with a 1px subtle stroke (#334155).
- **Overlays (Modals/Dropdowns):** These utilize a glassmorphic effect with a 12px backdrop blur, 80% opacity on the surface color, and a light-facing "top-shine" border (0.5px white at 10% opacity).

Shadows are used sparingly; they are "Ambient" — extremely diffused (20-40px blur), low opacity (15-20%), and slightly tinted with the Indigo primary color to create a soft glow rather than a harsh drop-shadow.

## Shapes

The shape language is **Soft (Level 1)**, utilizing a 4px (0.25rem) base radius. This creates a crisp, professional appearance that feels more "technical" than fully rounded UI. 

Larger containers like dashboard cards may scale up to 8px (0.5rem) to soften the overall layout, but interactive elements like buttons, inputs, and tags should remain at the 4px standard. This precision in geometry reinforces the analytical nature of the product.

## Components

- **Buttons:** Primary buttons are solid Indigo with white text. Secondary buttons use a ghost style (transparent background with a 1px Slate stroke). Interaction states include a subtle Indigo outer glow on hover.
- **Inputs:** Darker than the surface background to create "wells." Use a 1px stroke that shifts to Indigo on focus. Labels are always `label-caps` for a technical look.
- **Data Tables:** Borderless rows with 1px Slate separators. Use alternating row zebra-striping (at 2% opacity difference) for high-density readability. Metric columns should use the `data-mono` font.
- **Glass Overlays:** Used for context menus and tooltips. Must include a `backdrop-filter: blur(12px)` and a subtle "inner glow" border to separate them from the background.
- **Growth Metrics:** Use Emerald for text and small trend-line sparklines. Avoid large blocks of Emerald; use it only for the data points themselves.
- **Chips/Badges:** Minimalist design with a subtle background tint of the status color and high-contrast text. No heavy borders.