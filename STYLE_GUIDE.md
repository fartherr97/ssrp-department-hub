# SSRP CAD — UI Style Kit

A portable spec of the SSRP CAD look & feel: **dark navy theme, Ubuntu font,
soft springy motion, translucent borders, lift-on-hover, press-to-scale.**

**How to reuse it (two ways):**
1. **As a prompt** — paste this whole file into an AI and say:
   *"Apply the SSRP CAD UI style described below to this project (Tailwind + React).
   Use these exact tokens, fonts, animations, and component recipes."*
2. **As code** — copy the three blocks below into a new project:
   the font `<link>`, the `tailwind.config` extend, and the `index.css`
   (`:root` tokens + keyframes + utility classes). Then build components with
   the recipes at the bottom.

Stack assumed: **React + Vite + Tailwind CSS** (works with plain CSS too — the
tokens are CSS variables).

---

## 1. Font

Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap" rel="stylesheet" />
```
- **UI font:** `'Ubuntu', 'Segoe UI', 'Tahoma', 'Arial', system-ui, sans-serif`
- **Mono font:** `'Courier New', 'Lucida Console', 'Consolas', monospace` (IDs, plates, case #s, timestamps)
- Base body: **13px**, line-height **1.4**, `-webkit-font-smoothing: antialiased`
- Headings: weight **600**, line-height **1.2**

---

## 2. Color tokens

Dark navy / slate theme. Defined once as CSS variables and mirrored in Tailwind.

| Role | Hex |
|---|---|
| App background | `#0b1424` |
| Panel | `#101d31` |
| Card | `#13233b` |
| Elevated | `#192f4d` |
| Input | `#0d1a2c` |
| Toolbar / titlebar | `#0e1c30` |
| Selected row | `#1c3a5e` |
| Hover wash | `rgba(255,255,255,0.04)` |
| Overlay (modal backdrop) | `rgba(3,8,18,0.78)` |
| **Brand blue** | `#3d82f0` (bright `#5a97f5`, dim `#1d3a66`) |
| Gold accent | `#c09010` |
| Text | `#dde6f1` (dim `#93a4bd`, muted `#5d6f88`, data-blue `#5aa0e8`) |
| Borders | faint `rgba(255,255,255,0.05)` · base `rgba(255,255,255,0.10)` · strong `rgba(255,255,255,0.14)` |

**Action colors** (each has a `-hi` hover + a `-glow` rgba):
`blue #2f7fe8` · `green #1eb854` · `red #e23c3c` · `amber #d98a1e` · `gold #c09010` · `fire #d83818`

Radii: `sm 6px` · `base 8px` · `lg 14px`
Shadows: card `0 12px 40px rgba(0,0,0,0.7)` · small `0 2px 10px rgba(0,0,0,0.5)`

---

## 3. Motion / easing (the "feel")

```css
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);   /* springy entrances */
--ease-soft: cubic-bezier(0.4, 0, 0.2, 1);    /* presses / quick UI */
--t-fast: 0.14s;  --t-med: 0.22s;  --t-slow: 0.32s;
```
Rules of thumb:
- **Entrances** (modals, cards, dropdowns) → `--ease-out`, 0.22–0.34s, fade + 8–14px rise + slight scale (0.96→1).
- **Presses / hovers / toggles** → `--ease-soft`, 0.09–0.16s.
- **Hover** = lift up 2px (`translateY(-2px)`). **Press** = scale down (`scale(0.94)`).
- Animate `transform`/`opacity` (GPU-friendly); avoid animating layout props.

---

## 4. `index.css` — paste this (tokens + keyframes + utilities)

```css
@import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap');

:root {
  --n-bg-app:#0b1424; --n-bg-panel:#101d31; --n-bg-card:#13233b; --n-bg-elevated:#192f4d;
  --n-bg-input:#0d1a2c; --n-bg-toolbar:#0e1c30; --n-bg-selected:#1c3a5e;
  --n-bg-hover:rgba(255,255,255,0.04); --n-bg-overlay:rgba(3,8,18,0.78);
  --n-border-faint:rgba(255,255,255,0.05); --n-border:rgba(255,255,255,0.10); --n-border-strong:rgba(255,255,255,0.14);
  --n-text:#dde6f1; --n-text-dim:#93a4bd; --n-text-muted:#5d6f88; --n-text-data:#5aa0e8;
  --brand:#3d82f0; --brand-bright:#5a97f5;
  --acc-green:#1eb854; --acc-red:#e23c3c; --acc-amber:#d98a1e; --acc-gold:#c09010;
  --n-radius:8px; --n-radius-sm:6px; --n-radius-lg:14px;
  --n-shadow:0 12px 40px rgba(0,0,0,0.7);
  --ease-out:cubic-bezier(0.16,1,0.3,1); --ease-soft:cubic-bezier(0.4,0,0.2,1);
  --font-ui:'Ubuntu','Segoe UI','Tahoma','Arial',system-ui,sans-serif;
  --font-mono:'Courier New','Lucida Console','Consolas',monospace;
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
body { font-family:var(--font-ui); font-size:13px; line-height:1.4; color:var(--n-text); background:var(--n-bg-app); -webkit-font-smoothing:antialiased; }
h1,h2,h3,h4,h5,h6 { font-weight:600; line-height:1.2; }
button { font-family:var(--font-ui); cursor:pointer; border:none; background:none; }
button:disabled { opacity:0.38; cursor:not-allowed; }
::selection { background:rgba(16,96,168,0.45); color:#fff; }
*:focus-visible { outline:1px solid #1060a8; outline-offset:0; }

/* thin dark scrollbars */
* { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.14) transparent; }
*::-webkit-scrollbar { width:8px; height:8px; }
*::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:8px; border:2px solid transparent; background-clip:padding-box; }
*::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.22); background-clip:padding-box; }

/* ── Keyframes ── */
@keyframes fadeIn        { from{opacity:0} to{opacity:1} }
@keyframes dropdownFadeIn{ from{opacity:0;transform:translateY(-4px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes modalIn       { from{opacity:0;transform:translateY(14px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes overlayIn     { from{opacity:0} to{opacity:1} }
@keyframes sheetIn       { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
@keyframes staggerIn     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes popIn         { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
@keyframes pulseRed      { 0%,100%{opacity:1} 50%{opacity:0.45} }

/* ── Animation utilities ── */
.anim-fade-in    { animation:fadeIn 0.15s ease-out; }
.anim-dropdown-in{ animation:dropdownFadeIn 0.16s var(--ease-out) both; }
.anim-overlay-in { animation:overlayIn 0.18s ease-out; }
.anim-modal-in   { animation:modalIn 0.26s var(--ease-out) both; }
.anim-sheet-in   { animation:sheetIn 0.30s var(--ease-out) both; }   /* mobile bottom sheets */
.stagger-item    { animation:staggerIn 0.34s var(--ease-out) both; animation-delay:calc(var(--i,0)*0.04s); }
.animate-pulse-red { animation:pulseRed 1.5s ease-in-out infinite; } /* alerts / panic */

/* ── Interaction utilities (the signature feel) ── */
.press     { transition:transform 0.09s var(--ease-soft); }       /* tap feedback */
.press:active     { transform:scale(0.94); }
.press-sm  { transition:transform 0.09s var(--ease-soft); }
.press-sm:active  { transform:scale(0.97); }
.lift      { transition:transform 0.16s var(--ease-out), box-shadow 0.16s ease, border-color 0.16s ease; }
.lift:hover{ transform:translateY(-2px); }
.btn-glossy{ transition:transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.btn-glossy:hover { transform:translateY(-2px); }
.btn-glossy:active{ transform:translateY(0) scale(0.97); }
```

---

## 5. `tailwind.config.js` — paste this `extend`

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui:   ['Ubuntu','Segoe UI','Tahoma','Arial','system-ui','sans-serif'],
        mono: ['"Courier New"','"Lucida Console"','Consolas','monospace'],
      },
      colors: {
        app:    { bg:'#0b1424', panel:'#101d31', card:'#13233b', elevated:'#192f4d', input:'#0d1a2c', hover:'rgba(255,255,255,0.04)', selected:'#1c3a5e', toolbar:'#0e1c30', overlay:'rgba(3,8,18,0.78)' },
        cad:    { text:'#dde6f1', dim:'#93a4bd', muted:'#5d6f88', data:'#5aa0e8' },
        border: { faint:'rgba(255,255,255,0.05)', subtle:'rgba(255,255,255,0.07)', base:'rgba(255,255,255,0.10)', strong:'rgba(255,255,255,0.14)', accent:'rgba(61,130,240,0.55)' },
        brand:  { DEFAULT:'#3d82f0', bright:'#5a97f5', dim:'#1d3a66' },
        gold:   { DEFAULT:'#a07808', bright:'#c09010', dim:'#0e0a00' },
      },
      animation: {
        'fade-in':'fadeIn 0.15s ease-out',
        'pop-in':'popIn 0.22s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-red':'pulseRed 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
```

---

## 6. Component recipes (Tailwind classes)

**Primary button** (brand blue, press + lift):
```html
<button class="press inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-bright
  text-white text-[13px] font-bold cursor-pointer transition-colors disabled:opacity-40">Save</button>
```

**Secondary / ghost button:**
```html
<button class="press px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/10
  text-slate-300 text-[12.5px] font-semibold transition-all">Cancel</button>
```

**Danger button:**
```html
<button class="press px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold transition-colors">Delete</button>
```

**Card (lifts on hover):**
```html
<div class="lift bg-app-card/70 border border-border-base rounded-xl p-4 backdrop-blur-sm
  transition-[border-color,box-shadow,transform] hover:border-border-strong">…</div>
```

**Panel (static container):**
```html
<div class="bg-app-panel/80 border border-border-base rounded-xl p-5 backdrop-blur-sm">…</div>
```

**Input:**
```html
<input class="w-full bg-app-input border border-border-base rounded-lg px-3.5 py-2.5 text-sm text-cad-text
  placeholder:text-slate-600 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20 transition-all" />
```

**Label (uppercase micro-label):**
```html
<label class="block text-[11px] font-bold tracking-[0.5px] uppercase text-cad-muted mb-1.5">Field</label>
```

**Badge / pill:**
```html
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.3px]
  bg-brand/15 text-brand-bright border border-brand/30">Active</span>
```

**Dropdown / popover** → wrap in `.anim-dropdown-in`, portal it, `bg-app-card border border-border-strong rounded-xl shadow-2xl`.
**Modal** → backdrop `.anim-overlay-in bg-black/70 backdrop-blur-sm`, card `.anim-modal-in bg-app-panel border border-border-base rounded-2xl shadow-2xl`.
**Staggered lists** → add `.stagger-item` to each row and set inline `style={{ '--i': index }}`.

---

## 7. Conventions cheat-sheet
- Dark navy surfaces, **translucent white borders** (never solid gray lines).
- **Brand blue `#3d82f0`** is the single primary accent; status uses green/amber/red/fire.
- Mono font for any **ID-like** value (plates, case #s, Discord IDs, timestamps).
- Every clickable thing gets `.press`; every card/row that navigates gets `.lift`.
- Backdrop-blur on toolbars/panels/overlays (`backdrop-blur-sm/md`).
- Micro-labels: 10–11px, bold, uppercase, `tracking-[0.5px]`, muted color.
- Rounded: inputs/buttons `rounded-lg` (8px), cards `rounded-xl`, modals `rounded-2xl`.
- Keep entrances subtle (8–14px rise + tiny scale); keep presses snappy (~90ms).
```
