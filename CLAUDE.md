# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

승세윤의 사자성어 암기앱 — a Korean four-character-idiom (사자성어) memorization PWA based on the book 『고사성어 120』. It is a static site with no framework and no bundler. UI copy is Korean; keep new user-facing strings in Korean.

| File | Role |
|---|---|
| `index.html` | Markup, hand-written CSS (`<style>`), and all app logic (one inline `<script>`) |
| `data.js` | `RAW_DATA`: the 120 idioms (`{ index, text, hanja, mean }`), loaded before the app script |
| `tailwind.css` | **Generated** by Tailwind (committed so the site needs no build step to serve). Never edit by hand |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support / installability |

## Commands

- Serve locally: `python3 -m http.server` (service worker only registers over http/https; opening `index.html` via `file://` also works but without offline caching).
- **After adding or changing Tailwind utility classes in `index.html` (including class strings inside the JS), regenerate the CSS:** `npm install && npm run build:css`. Missing classes silently render unstyled, because `tailwind.css` only contains classes it saw at build time. Tailwind is pinned to 3.4.17 (v3 behavior; `tailwind.config.js` scans only `index.html`).
- When you change any cached file (`index.html`, `data.js`, `tailwind.css`, …) for release, bump `VERSION` in `sw.js`; otherwise returning users may keep seeing the old cached shell (it is stale-while-revalidate, so they get the update on the next load after that).
- There is no linter or test suite. Behavior was verified with headless Playwright scripts against `index.html`; Google Fonts / jsDelivr CDNs may be unreachable in sandboxes, so the page must keep working when `confetti` or web fonts fail to load.

## Architecture

### Data and chapters
- `RAW_DATA` order and `index` (1–120) matter: **chapter = `Math.ceil(index / 10)`**, 12 chapters (`CHAPTERS`). `BY_INDEX` is a Map built from it.
- Hanja spelling follows the book's table of contents (e.g. 麥秀之歎, 脣亡齒寒), not the common variant forms. 10 idioms are not 4 characters (계륵, 기우, 남상, 단장, 등용문, 모순, 미봉책, 백미, 오십보백보, 철면피) — that is how the book has them, not a data error.
- "120개" is hard-coded in the `og:description` meta tag and `#study-btn-sub`'s initial text.

### State and rendering
- A single global `state` object drives the UI; functions mutate the DOM by element ID (`$('id')`). All handlers are wired once in `init()`.
- Six views are sibling `<div id="view-*">` elements (`menu`, `study`, `quiz`, `result`, `review`, `search`) in `els.views`. `navigateTo(view)` fades out, swaps after 300 ms, pushes history, then `updateUI()` dispatches to `renderMenu/renderStudy/renderQuiz/renderResult/renderReview`. **`navBusy` locks navigation during the 300 ms transition** (prevents double-tap from creating duplicate history entries); do not bypass it. `state.view` only changes at the end of the transition.
- Browser Back is integrated via `history.pushState` + `window.onpopstate`: Back first closes any open modal (and re-pushes history to keep position), Back during a quiz opens the stop-confirm modal, and Back onto a finished/aborted quiz is redirected to the menu (`state.quiz.done`).
- Any text that goes into `innerHTML` must pass through `esc()`.
- Modals: `showModal/hideModal` with `.modal-overlay.show`; inner element id must end in `-inner` and be registered in `MODAL_INNER`. They handle focus restore, Escape and Tab trapping.

### Quiz
- Three question types built by `buildQuestion`: `fill` (show first two chars, type last two), `meaning` (meaning → pick idiom, 4 choices), `hanja` (hanja → pick reading, 4 choices). The user's menu choice (`state.quizType`: fill / meaning / hanja / mixed) goes through `pickType`; **idioms that are not 4 characters can't be `fill`, so they fall back to `meaning`**. Distractors prefer idioms of the same length.
- `startQuiz(mode, items?)` modes: `normal` (selected chapters), `review` (오답 노트), `retry` (re-run of this round's wrong answers). `state.lastRun` powers "처음부터 다시 풀기".
- `submitAnswer` shows the feedback overlay and auto-advances through `state.quiz.timer` (600 ms correct / 1500 ms wrong). **Every code path that leaves the quiz must call `clearQuizTimer()`** (already done in `navigateTo` and `startQuiz`), otherwise a stale timer can hijack the next screen.
- Korean IME: Enter while `e.isComposing` is ignored, and Enter on an empty input does nothing (skipping is the explicit skip button).

### Persistence (localStorage)
All access goes through `storeGet/storeSet/loadJSON`, which swallow errors (storage can be blocked or corrupted; the app must still start).
- `idiom_seung_opt_v1` — 오답 노트: `[{ index, date, streak }]`. Only the index is stored; text/hanja/meaning are looked up in `RAW_DATA`. `normalizeWrongs` also accepts the legacy format (full idiom objects) — keep the key stable or existing users lose their notes. In `review` mode a correct answer increments `streak`; reaching `GRAD_STREAK` (2) removes the entry ("졸업"). A wrong answer moves it to the front with `streak: 0` and a fresh date.
- `idiom_known_v1` — indexes marked "외웠어요" in study mode (shown as progress bars on chapter tiles).
- `idiom_quiz_type_v1`, `idiom_theme_pref` (`'light'`/`'dark'`, falls back to `prefers-color-scheme`).
- Backup/restore (menu footer) exports/imports `{ app: 'idiom-seung', version: 1, wrongs, known }` JSON and merges on restore.

### Theming and styling
Dark mode is the `dark-theme` class on `<html>`, applied by a tiny inline script in `<head>` before first paint (avoids a white flash) and again by `applyTheme`. Dark styles are hand-written `.dark-theme …` overrides (including `!important` overrides of Tailwind `text-gray-*`/`bg-*` classes), not Tailwind's `dark:` variant — new UI needs matching `.dark-theme` rules, and body text must keep WCAG-AA contrast there. Keep text ≥ 11px. `prefers-reduced-motion` disables animations globally; on narrow screens the blurred background blobs are static for performance.

### Search
`findRange` matches a query against idiom text, hanja and meaning, supporting Korean **초성** (initial consonants) and 초성+글자 mixes like "가ㅇ"; a purely numeric query also matches `index`. Input is debounced 300 ms; a result opens a detail modal with a jump to the study card.

### Deployment notes
`og:url` / `og:image` / `twitter:image` use the absolute URL `https://seyoon-seung.github.io/seyoon-idiom/` (assumed GitHub Pages address — update all three if the real address differs; social crawlers require absolute image URLs).
