# CLAUDE.md — Frontend Website Rules

## Always Do First

* **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
* Before planning or implementing the website, **inspect all user-provided mockups, screenshots, reference images, and design samples**.
* The user may upload a **mockup/sample design showing the desired website look and feel**. Treat this mockup as the **primary visual reference** when planning the website.
* Use the mockup to understand and reproduce the intended:

  * Overall visual direction
  * Layout and composition
  * Section hierarchy
  * Spacing and proportions
  * Typography style
  * Color palette
  * Buttons and UI elements
  * Cards, containers, borders, and shadows
  * Image treatment
  * Navigation/header style
  * Visual density
  * Responsive behavior
  * Overall brand personality and atmosphere
* **Do not blindly copy placeholder content from the mockup.** Use the mockup primarily as a design and visual reference unless the user explicitly asks to reproduce its content.
* When planning the website, **first translate the mockup into a design system and page structure**, then implement it.
* If the mockup contains elements that are unclear, make the smallest reasonable interpretation necessary while preserving the visual intent. Do not introduce unrelated design patterns.

## Reference Images & Mockups

* If a reference image or website mockup is provided:

  * Match the **layout, spacing, typography, proportions, visual hierarchy, colors, components, and overall look and feel** as closely as possible.
  * Use the mockup as the source of truth for the visual direction.
  * Swap in appropriate placeholder content when the actual content is not provided.
  * Images may use `https://placehold.co/` when real assets are unavailable.
  * **Do not add new sections, features, UI patterns, or visual treatments that are not supported by the reference.**
  * Do not "improve" or redesign the reference unless the user explicitly asks for improvements.
* If the user provides multiple mockups:

  * Treat them as a unified design reference.
  * Identify the common visual language across them.
  * Follow the most recent or explicitly preferred mockup when references conflict.
* If the mockup represents only one page or section, use it as the visual reference for that portion while maintaining the same design language throughout the rest of the website.
* If no reference image or mockup is provided:

  * Design from scratch with high craft using the guardrails below.
* After implementation:

  * Screenshot the output.
  * Compare the implementation against the reference.
  * Identify visible mismatches.
  * Fix the mismatches.
  * Re-screenshot.
  * Perform **at least 2 comparison rounds**.
  * Stop only when there are no significant visible differences or the user explicitly says to stop.

## Mockup Planning Workflow

When a mockup is provided, follow this sequence:

1. **Inspect the mockup**

   * Identify the page structure.
   * Identify major sections and components.
   * Identify visual hierarchy.
   * Identify typography characteristics.
   * Identify colors and contrast.
   * Identify spacing and sizing patterns.
   * Identify image placement and treatment.
   * Identify navigation and interactive elements.

2. **Extract the design language**

   * Establish typography rules.
   * Establish color tokens.
   * Establish spacing tokens.
   * Establish border-radius rules.
   * Establish shadow/depth rules.
   * Establish button and component styles.
   * Establish responsive behavior.

3. **Plan before coding**

   * Define the page structure based on the mockup.
   * Determine reusable components.
   * Determine responsive behavior.
   * Determine which elements require real brand assets.
   * Check `brand_assets/` before using placeholders.

4. **Implement**

   * Build the website according to the extracted design system.
   * Preserve the visual intent of the mockup.
   * Do not introduce unrelated UI patterns.

5. **Validate visually**

   * Run the website locally.
   * Take screenshots.
   * Compare against the mockup.
   * Fix discrepancies.
   * Repeat for at least 2 comparison rounds.

## Local Server

* **Always serve on localhost** — never screenshot a `file:///` URL.
* Start the dev server:
  `node serve.mjs [port]`
* The server serves the project root and defaults to:
  `http://localhost:3000`
* Port 3000 is often taken by another project on this machine. If so, use:
  `node serve.mjs 3001`
* `serve.mjs` lives in the project root.
* Start it in the background before taking screenshots.
* If the server is already running, do not start a second instance.

## Screenshot Workflow

* Puppeteer is installed at:
  `C:/Users/Jess/Desktop/Claude/Optivion/node_modules/puppeteer/`
* Chrome cache is at:
  `C:/Users/Jess/.cache/puppeteer/`
* **Always screenshot from localhost:**
  `node screenshot.mjs http://localhost:3000`
* Screenshots are saved automatically to:
  `./temporary screenshots/screenshot-N.png`
* Screenshots are auto-incremented and never overwritten.
* Optional label suffix:
  `node screenshot.mjs http://localhost:3000 label`
* For mobile:
  `node screenshot.mjs http://localhost:3001 home --mobile`
* `screenshot.mjs` lives in the project root. Use it as-is.
* After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.

### Visual Comparison

When comparing the implementation to the mockup, be specific.

Examples:

* "Heading is approximately 32px but the mockup uses approximately 24px."
* "Card spacing is 16px but the reference shows approximately 24px."
* "The hero image is too tall compared with the reference."
* "The button radius is too rounded."
* "The section has excessive vertical padding."
* "The navigation is visually heavier than the reference."

Check:

* Spacing and padding
* Font size, weight, and line-height
* Colors and exact hex values where identifiable
* Alignment
* Border radius
* Shadows
* Image sizing and cropping
* Section proportions
* Button dimensions
* Header/navigation height
* Visual hierarchy
* Mobile responsiveness

## Output Defaults

* Single `index.html` file, all styles inline, unless the user says otherwise.
* Tailwind CSS via CDN:
  `<script src="https://cdn.tailwindcss.com"></script>`
* Placeholder images:
  `https://placehold.co/WIDTHxHEIGHT`
* Mobile-first responsive design.

## Brand Assets

* Always check the `brand_assets/` folder before designing.
* It may contain:

  * Logos
  * Color guides
  * Style guides
  * Product images
  * Icons
  * Brand photography
  * Other visual assets
* If assets exist there, use them.
* **Do not use placeholders when real assets are available.**
* If a logo is present, use it.
* If a color palette is defined, use those exact values.
* Do not invent brand colors when official brand colors are available.
* When a mockup and brand asset conflict, preserve the real brand asset while matching the mockup's overall visual treatment.

## Anti-Generic Guardrails

* **Colors:** Never use the default Tailwind palette (`indigo-500`, `blue-600`, etc.) as a primary design system color. Follow the mockup or brand assets.
* **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity when shadows are present in the reference.
* **Typography:** Do not automatically impose a font pairing that conflicts with the reference. Match the typography personality of the mockup first.
* **Gradients:** Use gradients only when supported by the reference/design direction. Do not add decorative gradients simply for visual complexity.
* **Animations:** Only animate `transform` and `opacity`. Never use `transition-all`. Use subtle spring-style easing where appropriate.
* **Interactive states:** Every clickable element needs hover, focus-visible, and active states.
* **Images:** Match the image treatment in the reference. Do not automatically add overlays or blend modes unless they support the visual direction.
* **Spacing:** Use intentional, consistent spacing tokens derived from the mockup rather than random Tailwind spacing values.
* **Depth:** Use a consistent layering system (base → elevated → floating) when the reference uses depth.
* **Consistency:** Reusable components should follow the same visual rules established from the mockup.

## Hard Rules

* **The uploaded mockup is the primary visual reference for planning the website's look and feel.**
* Do not add sections, features, or content that are not supported by the reference or explicitly requested by the user.
* Do not "improve" or redesign the reference unless the user explicitly asks you to.
* Do not introduce unrelated design trends or UI patterns.
* Do not stop after one screenshot pass.
* Do not use `transition-all`.
* Do not use default Tailwind blue/indigo as the primary color unless the mockup or brand guidelines explicitly use it.
* Do not replace real brand assets with placeholders.
* Do not begin coding before inspecting the provided mockup and `brand_assets/`.
* Always validate the final implementation visually against the provided mockup.
* Preserve the **look, feel, hierarchy, and visual intent** of the reference even when the actual website content differs.
