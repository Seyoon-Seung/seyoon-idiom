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
- "120개" is hard-coded in the `og:description` / `twitter:description` meta tags and `#study-btn-sub`'s initial text.

### State and rendering
- A single global `state` object drives the UI; functions mutate the DOM by element ID (`$('id')`). All handlers are wired once in `init()`.
- Six views are sibling `<div id="view-*">` elements (`menu`, `study`, `quiz`, `result`, `review`, `search`) in `els.views`. `navigateTo(view)` fades out, swaps after 300 ms, pushes history, then `updateUI()` dispatches to `renderMenu/renderStudy/renderQuiz/renderResult/renderReview`. **`navBusy` locks navigation during the 300 ms transition** (prevents double-tap from creating duplicate history entries); do not bypass it. `state.view` only changes at the end of the transition.
- Browser Back is integrated via `history.pushState` + `window.onpopstate`: Back first closes any open modal (and re-pushes history to keep position), Back during a quiz opens the stop-confirm modal, and Back onto a finished/aborted quiz is redirected to the menu (`state.quiz.done`).
- Any text that goes into `innerHTML` must pass through `esc()`.
- Modals: `showModal/hideModal` with `.modal-overlay.show`; inner element id must end in `-inner` and be registered in `MODAL_INNER`. They handle focus restore, Escape and Tab trapping.

### Quiz
- Three question types built by `buildQuestion`: `fill` (show first two chars, type last two), `meaning` (meaning → pick idiom, 4 choices), `hanja` (hanja → pick reading, 4 choices). The user's menu choice (`state.quizType`: fill / meaning / hanja / mixed) goes through `pickType`; **idioms that are not 4 characters can't be `fill`, so they fall back to `meaning`**. Distractors prefer idioms of the same length.
- `startQuiz(mode, items?)` modes: `normal` (selected chapters), `review` (오답 노트), `retry` (re-run of this round's wrong answers). `state.lastRun` powers "처음부터 다시 풀기".
- `submitAnswer` colors the picked choice / input (`is-right`, `is-wrong`, `is-dim`), slides up the `#quiz-feedback` drawer from the bottom of `#quiz-card`, and auto-advances through `state.quiz.timer` (600 ms correct / 1500 ms wrong). `#quiz-card` uses `overflow: clip` on purpose: with `overflow: hidden` it becomes a scroll container and the input's `scrollIntoView` shifts the card content up. **Every code path that leaves the quiz must call `clearQuizTimer()`** (already done in `navigateTo` and `startQuiz`), otherwise a stale timer can hijack the next screen.
- Korean IME: `onEnterAfterCompose` defers an Enter pressed while composing (`isComposing` / keyCode 229) until `compositionend`, so one Enter submits; a duplicate Enter is absorbed by the `qz.feedback` guard and the 300 ms `skipFeedback` cooldown. Enter on an empty input does nothing (skipping is the explicit skip button). While the feedback drawer is up, `beforeinput` is cancelled instead of making the input `readOnly` (that would drop the iOS keyboard).
- Mobile keyboard: the viewport meta has `interactive-widget=resizes-content` (Android). `updateKeyboard` treats the keyboard as open when a text input is focused and `visualViewport.height` is 150px+ below its keyboard-less height, toggles `html.kb-open` (compact quiz layout in CSS) and calls `keepQuizInView` to scroll just enough that the card bottom (check button / drawer) clears the keyboard. Quiz buttons and the drawer `preventDefault` on `mousedown` while the input is focused, so tapping them does not blur it and the keyboard stays up between questions. Focus calls use `{ preventScroll: true }`.

### Persistence (localStorage)
All access goes through `storeGet/storeSet/loadJSON`, which swallow errors (storage can be blocked or corrupted; the app must still start).
- `idiom_seung_opt_v1` — 오답 노트: `[{ index, date, streak }]`. Only the index is stored; text/hanja/meaning are looked up in `RAW_DATA`. `normalizeWrongs` also accepts the legacy format (full idiom objects) — keep the key stable or existing users lose their notes. In `review` mode a correct answer increments `streak`; reaching `GRAD_STREAK` (2) removes the entry ("졸업"). A wrong answer moves it to the front with `streak: 0` and a fresh date.
- `idiom_known_v1` — indexes marked "외웠어요" in study mode (shown as progress bars on chapter tiles).
- `idiom_quiz_type_v1`, `idiom_theme_pref` (`'light'`/`'dark'`, falls back to `prefers-color-scheme`), `idiom_sound_v1` and `idiom_haptic_v1` (`'on'`/`'off'`).
- Game layer: `idiom_xp_v1` `{ total, today, day }` and `idiom_streak_v1` `{ last, count }` (days are local `YYYY-MM-DD`). Each correct answer gives `XP_PER_CORRECT` (10), a perfect round adds `XP_PERFECT_BONUS` (20) and the menu shows progress toward `DAILY_GOAL` (50). The day streak grows only when a quiz is finished (`touchStreak` in `renderResult`, guarded by `quiz.celebrated`). Within a round `quiz.combo` / `quiz.maxCombo` drive the combo counter, the rising pitch of the correct sound and the result boxes. These are not part of the backup file.
- Backup/restore (menu footer) exports/imports `{ app: 'idiom-seung', version: 1, wrongs, known }` JSON and merges on restore.

### Theming and styling
The look is a bright, game-like study app: chunky pressable buttons, a mascot, combo/XP feedback and sound.
- **Colors are CSS variables** on `:root` (`--bg`, `--card`, `--raised`, `--line`, `--ink`/`--ink-2`/`--ink-3`, and `--blue`/`--green`/`--red`/`--amber` each with `-edge`, `-soft`, `-line`, `-text`). Dark mode is the `dark-theme` class on `<html>` (applied by a tiny inline script in `<head>` before first paint, and by `applyTheme`), which only redefines those variables. Do not use Tailwind color utilities (`text-gray-*`, `bg-indigo-*` …) or the `dark:` variant; use the role classes `.t-1/.t-2/.t-3/.t-blue/.t-green/.t-red/.t-amber` and the component classes so both themes follow automatically. Tailwind is for layout, spacing and font sizes.
- Meaning of color: blue = primary action and selection, green = go / correct / progress, red = wrong / destructive, amber = XP, streak, hints.
- Components: `.tap` (neutral 3D button; `.selected` or `aria-pressed="true"` turns it blue), `.btn .btn-blue|green|red` (filled 3D button), `.chip`, `.icon-btn`, `.panel`, `.card3d`, `.bar > i` (progress), `.chapter-btn`, `.choice-btn`. The 3D edge is a `0 4px 0` box-shadow that disappears on `:active` with a 4px drop.
- Fonts: `.fun` = Jua (display: titles, idioms, numbers), `.hanja` = Noto Serif KR, everything else Pretendard. All have system fallbacks because the CDNs can be unreachable.
- Mascot: `renderMascot(id, mood, anim)` draws the ink-drop character (`idle`/`happy`/`sad`/`wow` faces, `idle`/`jump`/`droop` motion) into an empty `.mascot` element; open eyes are wrapped in `.eyes` and blink at a random phase. It appears on the menu, in the quiz feedback drawer (`#mascot-feedback`, reacts to each answer), on the result screen and in empty states. The app icons and `thumbnail.png` (1200×630 share card) use the same character on brand blue.
- Celebration graphics: `burst(el, opts)` spawns short-lived DOM particles (`.spark`, Web Animations API, skipped under reduced motion) from a correct choice/input, the "외웠어요" badge and result stars. The result screen awards 0–3 stars (≥50%, ≥80%, 100%) with a rotating `.rays` halo from 2 stars; a chapter whose 10 idioms are all marked known gets `.mastered` (crown badge, amber bar); the streak flame (`#stat-flame.lit`) flickers only while the streak is alive.
- Haptics: `haptic.play(name)` with named patterns (`tick`, `select`, `snap`, `success`, `combo`, `error`, `known`, `celebrate`). Android uses `navigator.vibrate` patterns; iOS 18+ Safari has no `vibrate`, so it clicks the label of a hidden `<input type="checkbox" switch>` (system haptic) once per tap in the pattern, restoring focus so the quiz keyboard stays open. Keep haptics short and only on meaningful moments, not on every press. The "진동" toggle in the menu footer is hidden on devices that support neither.
- Sound: `sfx.play(name)` synthesizes short effects with Web Audio (no audio files, works offline, silently does nothing if audio is unavailable). The header speaker button toggles it.
- Motion: `navigateTo` slides views by `VIEW_DEPTH` (deeper = enter from the right, shallower = from the left, same depth = fade-up). The study card follows the pointer (`initStudyDrag`: `touch-action: pan-y` on `#study-card-area`, rubber band on the first card, a far drag or fast flick calls `studyStep(…, flung = true)`, anything else springs back; `studyBusyUntil` ignores drags while a card is flying). The header is `position: sticky` and gets `.scrolled` on scroll, which is why horizontal overflow is clipped on `html` / `body { overflow-x: clip }` rather than `hidden` on `body`. Use `restartClass(el, cls)` to replay a one-shot animation (`pop`, `pop-in`, `shine`, `type-pop`).
- Keep text ≥ 11px and WCAG-AA contrast in both themes. `prefers-reduced-motion` disables animations globally.

### Search
`findRange` matches a query against idiom text, hanja and meaning, supporting Korean **초성** (initial consonants) and 초성+글자 mixes like "가ㅇ"; a purely numeric query also matches `index`. Input is debounced 300 ms; a result opens a detail modal with a jump to the study card.

### Deployment notes
`og:url` / `og:image` / `twitter:image` use the absolute URL `https://seyoon-seung.github.io/seyoon-idiom/` (assumed GitHub Pages address — update all three if the real address differs; social crawlers require absolute image URLs).
