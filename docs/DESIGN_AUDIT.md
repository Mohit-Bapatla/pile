# Before-design audit

September 12, 2026. Baseline commit `76ff11b`. Browser screenshots captured in the task's `work/design-before/` before source edits. Desktop 1440×900; full-page captures reveal below-fold content; mobile 390×844. Public reference screenshots are in `work/design-references/`. All listed captures were visually inspected.

| Area               | Finding                                                                                                      | Required change                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Typography         | DM Serif marketing heading dominates every screen; small green metadata disappears against pastel            | Instrument Sans hierarchy, 30px place headings, readable 12px metadata          |
| Palette            | Almost all labels and borders are pale green; title/body contrast feels washed out                           | Warm graphite ink, calibrated secondary contrast, type-specific note colors     |
| Structure          | 224px sidebar duplicates projects and adds a promotional card; header + capture consumes ~480px before notes | Narrow navigation; compact capture; Today laid horizontally above week/later    |
| Component defaults | Every object is a similar pastel rounded rectangle, including project folders                                | Distinct source media, folded PDF, folder tabs, planning sheet/calendar         |
| Spacing            | Vast header and empty card space, but cramped review metadata                                                | Consistent spacing scale and contextual density                                 |
| Hierarchy          | Today is one of three equal columns and its third task is below fold                                         | Today owns main width and first reading position                                |
| Icons              | Sparkles recur in capture, review, settings, sidebar, attention and voice                                    | Remove decorative AI icons; keep action/type icons only                         |
| Borders/radii      | Repeated soft 12–18px corners and green outlines create generic SaaS tiles                                   | 4px notes, 6px controls, 8px dialogs; paper edge shadows                        |
| Motion             | Waveform animates without explaining what it means; no visible source-to-item transition                     | Honest symbolic recording indicator, labeled stop, source/split/land transition |
| Empty states       | Friendly but repetitive slogans; search empty has no immediate recovery action                               | Concrete copy and clear/retry/capture actions                                   |
| Responsive         | Mobile Inbox precedes Today; very tall cards, attach text disappears                                         | Capture→Today→Inbox→week; keep action labels and 44px controls                  |
| Personality        | Nearly identical green serif styling on every route feels templated                                          | Tactile semantics, spare handwritten margin note, content-led layout            |

## Route and state inventory

- **Board** (`board.png`): three Today priorities stack vertically, third below 900px. Title competes with task content. Main canvas resembles three-column kanban.
- **Inbox** (`inbox.png`): original text becomes a truncated filename-style row. PDF/image/voice all use generic icon rows; little visual memory.
- **Calendar** (`calendar.png`): useful approved vs proposed distinction already works. Pale date labels and large equal empty cells lack desk-calendar personality.
- **Projects/detail** (`projects.png`, `project-detail.png`): flat colored panels, duplicate sidebar project list, generic captured context rows. Keep real group membership.
- **Search/empty** (`search.png`, `empty.png`): functional retrieval but generic task cards; original source not a readable receipt. Empty result offers advice but no clear reset.
- **Settings** (`settings.png`): connections are honest about demo status, but tiny pale copy and repeated icons lower readability.
- **Item editor** (`item-edit.png`): complete form and original source disclosure work. Modal occupies nearly whole viewport; generic green controls. Preserve calendar field locking and delete confirmations.
- **Onboarding** (`onboarding.png`): broad marketing statements and large decorative icon. Replace illustration with paper/source-to-plan concept and concise practical copy.
- **Voice/recording** (`voice.png`, `recording.png`): actual timer runs, but circular microphone/stop has no accessible name or visible stop label. Generic green waveform should not imply measured audio. Demo sample is correctly identified.
- **Review** (`voice-review.png`, `file-review.png`): useful review selection and uncertain detail warning; long PDF list pushes approval below fold. Give list its own scroll region and retain action bar.
- **Source detail** (`source-detail.png`): plain raw PDF text plus file link; no image/PDF preview. Preserve original bytes and add representation.
- **Error** (`error.png`): actual unsupported-file message is visible and dismissible. Improve contrast and consistency, preserve retry behavior for processing errors.
- **Loading**: existing spinner and retry affordance found in code; source processing state found in live capture. Add status semantics and a source receipt during sorting.
- **Mobile** (`mobile.png`): no page overflow in baseline, but hierarchy puts Inbox first and produces a >3000px page after two fixture captures; attachment label hidden. Tighten composition without hiding tasks.

Implementation plan and exact tokens are in [DESIGN.md](DESIGN.md). Final QA observations and evidence will be appended after implementation.

## Final visual QA

The final application was inspected at 1440×900, 1512×982, 1280×800 and 390×844. All three seeded Today cards fit above the fold at every desktop size. Mobile has no horizontal page overflow across Board, Inbox, Calendar, Projects, Search or Settings; its reading order is capture → Today → Inbox → week → Later. Calendar becomes a day agenda. Tested in Chromium; real Safari/iOS device testing remains outstanding.

Final screenshots are committed under `docs/screenshots/`: board, board-full, board-1280, board-1512, mobile, mobile-full, capture, voice, recording, voice-review, review, inbox, calendar, calendar-mobile, projects, project-detail, search, source-image, source-pdf, item-edit, settings, onboarding, error, empty and empty-board-mobile. `before-board.png` preserves the baseline comparison. The empty-board image uses a deliberately intercepted empty state in an isolated QA context; all other screenshot content comes from the real seeded/demo pipeline.

Issues found and fixed during iteration:

1. First redesign still devoted too much height to chrome. Removed the board eyebrow, tightened capture and card spacing, and aligned task titles at their top edge.
2. Generic source rows were replaced by actual image thumbnails, folded PDF objects, text scraps and voice transcript objects. Every extracted note has a readable, actionable source receipt.
3. A native PDF iframe remained blank in Chromium. Replaced it with a readable extracted-text sheet and retained access to the original bytes.
4. Long PDF review lists pushed approval controls out of view. Limited the list's height while retaining the summary and action area.
5. Keyboard Escape closed the dialog without returning focus. Added shared opener-focus restoration and a regression assertion.
6. Recorder lacked a name and visible stop label. Added both, kept a real timer, and distinguished loading a sample from transcribing audio.
7. Reduced-motion support now removes item, split-sheet, modal and recording animations; the code also skips the minimum sorting delay.
8. Source processing status remained “needs review” after approval. Source cards now derive their review count from current active items and show “Organized” after approval; no database status rewrite was needed.
9. Routine E2E screenshots used to overwrite curated demo assets. They now go to ignored test-results.

Automated accessibility: six routes at desktop and mobile pass axe WCAG 2 A/AA and 2.1 AA checks; twelve further dialog/content/error states have zero violations in ACCESSIBILITY_RESULTS.json. An initial scan during the 140ms dialog fade produced transient contrast findings; settled/reduced-motion scans passed. These checks do not constitute complete assistive-technology certification. The regression suite exercises keyboard recording, Escape/focus return, honest sorting and failed-completion recovery. No page runtime errors were observed in the viewport sweep.
