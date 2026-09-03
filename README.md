# MWB Labs — landing page

Single-page site for MWB Labs (Making Business Work Better). HTML5, CSS3, vanilla JS, GSAP + ScrollTrigger. No build step, no framework.

```
mwb-labs/
├── index.html
├── css/styles.css
├── js/main.js
├── assets/images/     (empty — images are loaded from Unsplash CDN)
└── README.md
```

## Run it

Open `index.html` directly, or serve it (recommended, so relative paths and fonts behave):

```bash
python3 -m http.server 5173     # http://localhost:5173
# or
npx serve .
```

GSAP 3.12.5 loads from jsDelivr. To go fully offline, download `gsap.min.js` and `ScrollTrigger.min.js` into `js/vendor/` and update the two `<script>` tags at the bottom of `index.html`.

## Images

Five photographs are referenced directly from the Unsplash CDN (`images.unsplash.com/photo-…?auto=format&fit=crop&w=1400&q=80`) — four case-study visuals and one editorial image in "Who we work with". Unsplash's licence allows this; keep a credit line in your footer if you want to go beyond the minimum.

To host them yourself:

1. Download each photo and drop it in `assets/images/` with a descriptive filename — `business-team.jpg`, `ai-workflow.jpg`, `digital-product.jpg`, `workspace.jpg`.
2. Replace the `src` in `index.html`. Keep `loading="lazy"`, `decoding="async"`, `width`, `height` and `data-fallback`.
3. Keep the `width`/`height` attributes accurate — they set the aspect ratio and stop layout shift.

`data-fallback` wires up the error handler in `initImages()`: if an image 404s, it fades out and the container renders a patterned accent panel instead of a broken icon.

The hero visual is CSS + SVG, not an image, so there is no LCP image to preload.

## Contact form

Client-side validation only, with an obvious seam for a backend. In `js/main.js`, inside `initContactForm()`:

```js
var ENDPOINT = null;   // ← put your URL here
```

Set it to a Formspree URL, a serverless function, or your own API. The form POSTs JSON (`name`, `company`, `email`, `needs`, `message`) and handles success and failure states. With `ENDPOINT = null` the form runs in demo mode: it validates, simulates a send and says so.

## Animation structure

Everything lives in one IIFE in `js/main.js`, one function per concern, all called from `boot()`:

| Function | Does |
|---|---|
| `initNavigation()` | Sticky/translucent bar, full-screen overlay, Escape + focus trap, active-section highlighting |
| `initPointer()` | Cursor follower and pointer-tracking background glow (fine pointers only) |
| `initHeroAnimation()` | Entrance timeline, SVG wire draw, idle drift, pointer parallax, scroll dissolve |
| `initMarquee()` | Seamless capability ticker, paused when off-screen |
| `initScrollAnimations()` | `ScrollTrigger.batch` reveals plus the editorial line masks |
| `initProblem()` | Messy workflow → MWB → better workflow sequence |
| `initServices()` | Card stagger |
| `initNeedFlow()` | Interactive "tell us what you need" scenarios |
| `initProcess()` | Step activation and the progress rail |
| `initCaseStudies()` | Project reveals and image parallax |
| `initInteractions()` | Magnetic buttons |
| `initContactForm()` | Validation, states, submission |
| `initImages()` | Fallbacks, `ScrollTrigger.refresh()` after images load |

Responsive behaviour uses `gsap.matchMedia()`, so desktop-only effects (parallax, pointer tracking) are torn down properly when the viewport changes. `ScrollTrigger.refresh()` runs on `load`, on image load and on a debounced `resize`.

Reduced motion is handled twice: `@media (prefers-reduced-motion: reduce)` in CSS neutralises transitions, and the `reduced` flag in JS skips every timeline, parallax and cursor effect while leaving all content and navigation intact. Changing the OS preference reloads the page so the correct branch runs.

## Brand colours

All tokens are in `:root` at the top of `css/styles.css`:

```css
--bg:#08090B;  --surface:#0E1013;  --surface-2:#15181C;
--text:#F5F5F5; --muted:#A1A1AA;   --accent:#B8FF3D;
--border:rgba(255,255,255,.10);
```

Change `--accent` and the whole site follows — buttons, rails, chips, focus rings, the hero core. Also update `<meta name="theme-color">` and the inline SVG favicon in `index.html` if you change `--bg`.

Type scale is fluid (`--step--1` … `--step-4`), so headings resize without breakpoint overrides.

## Adding a case study

Copy one `<article class="project">` block in the `#work` section. Add `project--flip` to alternate the image side on desktop. Keep the structure:

```html
<article class="project project--flip">
  <a class="project__media" href="#contact" aria-label="…">
    <span class="project__flag">Concept project</span>
    <img src="…" alt="…" width="1400" height="933" loading="lazy" decoding="async" data-fallback>
  </a>
  <div class="project__body">
    <p class="project__idx">Project 05</p>
    <h3 class="project__name">…</h3>
    <p class="project__problem">…</p>
    <p class="project__solution">…</p>
    <p class="project__meta">Web · AI · Automation</p>
    <a class="link" href="#contact">Build something like this <span aria-hidden="true">→</span></a>
  </div>
</article>
```

No JS changes needed — `initCaseStudies()` picks up new `.project` elements on load.

The four projects shipped here are labelled **Concept project** because they are illustrative. If you replace them with real client work, remove the `project__flag` span, and only state outcomes you can substantiate.
