---
name: ConstructInspect Enterprise
colors:
  surface: '#faf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#faf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e8'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3031'
  inverse-on-surface: '#f2f0f0'
  outline: '#727786'
  outline-variant: '#c1c6d7'
  surface-tint: '#0059c7'
  primary: '#0057c2'
  on-primary: '#ffffff'
  primary-container: '#006ef2'
  on-primary-container: '#fefcff'
  inverse-primary: '#afc6ff'
  secondary: '#0053d0'
  on-secondary: '#ffffff'
  secondary-container: '#306ded'
  on-secondary-container: '#fefcff'
  tertiary: '#505e67'
  on-tertiary: '#ffffff'
  tertiary-container: '#697680'
  on-tertiary-container: '#fcfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#afc6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004398'
  secondary-fixed: '#dae1ff'
  secondary-fixed-dim: '#b3c5ff'
  on-secondary-fixed: '#001849'
  on-secondary-fixed-variant: '#003fa3'
  tertiary-fixed: '#d6e4ef'
  tertiary-fixed-dim: '#bac8d3'
  on-tertiary-fixed: '#101d25'
  on-tertiary-fixed-variant: '#3b4851'
  background: '#faf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
  status-success: '#52C41A'
  status-warning: '#FAAD14'
  status-error: '#FF4D4F'
  status-neutral: '#8C8C8C'
  canvas-background: '#F5F7FA'
  surface-white: '#FFFFFF'
  border-subtle: '#E4E7ED'
  border-strong: '#D9D9D9'
  text-primary: '#1F2937'
  text-secondary: '#595959'
  viewport-overlay-fill: rgba(22, 119, 255, 0.16)
  viewport-overlay-stroke: '#1677FF'
typography:
  display:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Public Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered specifically for mission-critical civil engineering, industrial construction oversight, and systematic quality assurance (QA/QC). The user demographic comprises site inspectors, BIM coordinators, compliance reviewers, and structural approval directors who operate across rugged field conditions, high-resolution drawing tables, and strict regulatory standards.

The visual style blends **Corporate / Modern** precision with **Industrial Functionalism**. It is strictly focused on utility, dense information hierarchy, low cognitive friction, and unwavering structural reliability. By relying on deterministic layout patterns, crisp micro-borders, and high-legibility typographic scale, the interface projects authoritative engineering integrity. 

Key attributes:
- **Zero Ambiguity:** Status indicators, approval state machines, and document coordinate overlays communicate without decorative distraction.
- **Architectural Grounding:** Structured data density, clear tabular delineation, and tactile bounding boxes reflect the precision of architectural blueprints and technical manifests.
- **Field & Boardroom Versatility:** High contrast ratios satisfy field laptop readability under glare while maintaining boardroom-grade presentation standards.

## Colors

The color system establishes strict role-based semantics tuned directly for multi-stage inspection workflows (Draft &rarr; Submitted &rarr; UnderReview &rarr; Approved / Rejected).

- **Primary (`#1677FF`):** Represents interactive precision, drawing marker selection, active viewport indicators, and verified navigation pathways.
- **Secondary (`#0958D9`):** Grounded deep blue for hover and focus states, pressed buttons, and elevated workflow tabs.
- **Tertiary (`#E6F4FF`):** Light tint used for active row selection, marker fill regions, and contextual banners.
- **Neutral (`#8C8C8C`):** Base tone for inactive UI elements, metadata captions, disabled inputs, and "Draft" lifecycle pills.
- **Functional Semantics:**
  - `status-success` (`#52C41A`): Used for "Approved", "Done", and fully validated inspection criteria.
  - `status-warning` (`#FAAD14`): Denotes active lifecycle tasks requiring action ("Submitted", "UnderReview", "InProgress").
  - `status-error` (`#FF4D4F`): Strictly indicates blockers, form validation failures, and "Rejected" sign-offs requiring mandatory rectification.
  - `canvas-background` (`#F5F7FA`): Soft architectural gray foundation that prevents eye fatigue across prolonged plan review sessions.

## Typography

Typography pairs **Public Sans**—an institutional, highly balanced humanist-grotesque type—with **JetBrains Mono** for engineering artifacts, document revisions, geospatial bounding box coordinates (X, Y, W, H), and inspection serial IDs.

- **Scale Rhythm:** Built around a baseline 14px body standard for enterprise tables, allowing dense technical matrices to present without horizontal crowding.
- **Headings:** Public Sans semi-bold headers ensure high clarity on critical approval gates, audit history, and modal titles.
- **Technical Monospace:** JetBrains Mono is strictly enforced on system identifiers (e.g., `INSP-2024-0089`), drawing revision numbers, role tags, and bounding box geometric inputs to prevent visual glyph ambiguity in the field.

## Layout & Spacing

The layout philosophy follows a **Fluid Engineering Workspace** optimized for complex data entry, schema-driven forms (FormIO), and split-pane PDF drawing inspection.

- **Grid System:** A responsive 12-column layout underpinned by an 8px base rhythm (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 32px).
- **Viewport Layout (Drawing & Marker Canvas):**
  - Rigid split-screen: Left structural tree pane (30% width, min 320px, max 420px) fixed to object hierarchy.
  - Interactive PDF canvas pane (remaining fluid 70%) containing pan/zoom controls and HTML5 canvas marker overlays.
- **Responsive Breakpoints:**
  - **Desktop (`>= 1200px`):** Full dual-pane viewport, expanded enterprise tables, multi-column FormIO schemas, permanent sidebar navigation.
  - **Tablet (`768px - 1199px`):** Collapsible navigation drawer; drawing viewport converts to toggleable drawer or stacked layout.
  - **Mobile (`< 768px`):** Single-column stacked cards, full-bleed modals, and dedicated scroll zones for drawing inspections.

## Elevation & Depth

To maintain an architectural, enterprise feel, this design system minimizes heavy dropshadows in favor of **Crisp Low-Contrast Outlines** combined with **Tonal Surface Layering**.

- **Level 0 (Floor Canvas):** `#F5F7FA` serves as the underlying substrate across the entire web application.
- **Level 1 (Card & Table Worksurfaces):** Solid `#FFFFFF` elevated solely by a subtle `1px solid #E4E7ED` border. No shadow is applied under normal resting states.
- **Level 2 (Interactive Floating Tools & Popovers):** Drawing viewport toolbars, dropdowns, and context tooltips employ an ambient, non-colored technical shadow: `0 4px 12px rgba(0, 0, 0, 0.08)` bordered by `#D9D9D9`.
- **Level 3 (Modals & Audit Overlays):** Approval dialogs, role assignment modals, and rejection reason forms use `0 12px 32px rgba(15, 23, 42, 0.16)` centered with a high-contrast dark overlay (`rgba(0, 0, 0, 0.45)`).

## Shapes

The system enforces a **Soft Structural Geometry (Level 1)**:
- Standard UI interactive components (buttons, input boxes, select dropdowns, tables, and tags) feature a tight radius of `0.25rem` (4px).
- Modals, large surface cards, and split-screen viewport tool containers utilize `0.5rem` (8px).
- Circular pills (`9999px`) are strictly restricted to numeric notification badges, step sequence indicators, and drawing pin nodes.
- Geometric precision ensures high visual compatibility with CAD/BIM viewports, grid lines, and technical blueprints.

## Components

### Buttons & Action Triggers
- **Primary Actions:** Solid `#1677FF` fill with white text, 4px border radius, 32px height for standard density, 40px for form submissions. Focus ring: `0 0 0 2px rgba(22, 119, 255, 0.2)`.
- **Destructive / Reject:** Ghost button with `#FF4D4F` text and border for secondary prompts; solid `#FF4D4F` fill reserved strictly for terminal rejection modals.
- **Workflow Action Bar:** Sticky bottom-bar container across inspection detail views containing state-aware trigger clusters (e.g., `Reviewer` &rarr; "Tiếp nhận hồ sơ"; `Approver` &rarr; "Phê duyệt" / "Từ chối").

### Status Tags & Badges
- Encapsulate status text in semi-bold uppercase mono typography (`label-sm`).
- **Approved / Done:** Light tint `#F6FFED`, border `#B7EB8F`, text `#52C41A`.
- **Submitted / UnderReview / InProgress:** Light tint `#FFFBE6`, border `#FFE58F`, text `#D48806`.
- **Rejected:** Light tint `#FFF2F0`, border `#FFCCC7`, text `#FF4D4F`.
- **Draft / Pending:** Light tint `#FAFAFA`, border `#D9D9D9`, text `#595959`.

### Data Tables & Checklist Items
- Compact rows (44px row height) with `#E4E7ED` border-bottom divider. Header background: `#FAFAFA` with text in `#595959` uppercase 12px.
- Table row highlights on hover using `#F0F7FF`.
- In Checklist tables, conditional checkboxes are disabled and locked until linked inspection dependencies pass into `Approved` status.

### FormIO & Input Elements
- **Input Fields:** `#FFFFFF` background, `1px solid #D9D9D9`, 4px radius. Focus state shifts border to `#1677FF` with zero latency.
- Dynamic FormIO container embeds inside a bordered card frame (`#FFFFFF`), ensuring dynamic schema-generated form fields align with system typography tokens.

### Viewport Object Marker Overlays
- Bounding box annotations rendered over `pdf.js` canvas: `1.5px solid #1677FF` with `rgba(22, 119, 255, 0.16)` background fill.
- Selected markers highlight with dashed contrast stroke `2px dashed #003EB3` and anchored corner resize node handles.