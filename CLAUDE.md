# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

승세윤의 사자성어 암기앱 — a Korean four-character-idiom (사자성어) memorization app. It is a **single static file**: `index.html` (HTML + CSS + JS inline, ~1300 lines) plus `thumbnail.png` (the `og:image`). UI copy is Korean; keep new user-facing strings in Korean.

## Commands

There is no build system, package manager, linter, or test suite. To develop, open `index.html` in a browser (or serve the directory, e.g. `python3 -m http.server`). Tailwind (`cdn.tailwindcss.com`), `canvas-confetti`, and the Pretendard/Noto Serif KR fonts are loaded from CDNs at runtime, so a network connection is required to see the app render correctly.

## Architecture

Everything lives in `index.html`: `<style>` (lines ~17–307), markup (~309–544), then one `<script>` (~546–1310). Styling mixes Tailwind utility classes with hand-written CSS (glassmorphism `.glass`, aurora background blobs, animations).

### Data and chapters
- `RAW_DATA` is the hard-coded array of 120 idioms: `{ index, text, hanja, mean }`. Order and `index` (1–120) matter.
- **Chapters are derived, not stored**: chapter = `Math.ceil(index / 10)`, giving 12 chapters of 10 (`CHAPTERS`). Adding/removing idioms changes chapter boundaries and the "120개" strings hard-coded in the `og:description` meta tag and the menu card.
- Quizzes only include idioms with `text.length === 4` (e.g. 철면피 is excluded); study cards and search include all. The footer note "* 4글자 성어만 시험 포함" reflects this.

### State and rendering
- A single global `state` object (current `view`, selected chapters, multi-select mode, `quiz` sub-state, `studyIdx`, `savedWrongs`, `searchQuery`, `theme`) drives UI. There is no framework: functions manipulate the DOM directly by element ID.
- Six "views" are sibling `<div id="view-*">` elements (`menu`, `study`, `quiz`, `result`, `review`, `search`) registered in `els.views`. `navigateTo(view)` fades out the current view, toggles the `hidden` class after a 300ms timeout, pushes browser history, then calls `updateUI()`. `updateUI()` is the central dispatcher: it sets header/footer visibility and calls the matching `render*()` function (`renderMenu`, `renderStudy`, `renderQuiz`, `renderResult`, `renderReview`). Search is rendered via `renderSearch()` from its own input handler instead.
- Navigation integrates with the browser Back button via `history.pushState`/`window.onpopstate` in `init()`: Back closes any open modal first, and Back from an in-progress quiz opens the "stop quiz" confirm modal instead of leaving. Modals use `showModal`/`hideModal` with the `.modal-overlay.show` class and an inner element whose id ends in `-inner` (a generic backdrop-click handler relies on that suffix).
- All event handlers are wired once in `init()` (mostly via `safeSetOnclick(id, fn)`); `init()` is called at the bottom of the script.

### Quiz mechanics
- The quiz shows the first two characters of the idiom and the user types the last two (`maxlength=2`; correct answer = `item.text.slice(2)`). Hint reveals hanja + meaning.
- `startQuiz('normal')` uses idioms from selected chapters; `startQuiz('review')` uses `savedWrongs`. The list is shuffled with `sort(() => Math.random() - 0.5)`.
- `checkAnswer` shows a feedback overlay and auto-advances via `state.quiz.timer` (600ms correct / 1500ms wrong); `skipFeedback` can advance early after a 300ms cooldown.

### Persistence (localStorage)
- `idiom_seung_opt_v1` — JSON array of wrong-answer idioms (each is an idiom object plus an ISO `date`). Written in `checkAnswer`, the review-list delete handler, and the trash-confirm handler; keep the key stable or existing users lose their 오답 노트.
- `idiom_theme_pref` — `'light'` / `'dark'`; falls back to `prefers-color-scheme`.

### Theming
Dark mode is toggled by the `dark-theme` class on `<html>` (`applyTheme`). Dark styles are hand-written overrides prefixed `.dark-theme …` at the end of the `<style>` block (including `!important` overrides of Tailwind's `text-gray-*` classes), not Tailwind's `dark:` variant — new UI needs matching `.dark-theme` rules.

### Search
`renderSearch` matches the query (case-insensitive substring) against idiom text, hanja, and meaning, and also matches Korean **초성** (initial consonants) via `getChoseong`. Input is debounced 300ms; results open a detail modal.
