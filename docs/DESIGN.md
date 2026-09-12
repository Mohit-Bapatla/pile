# Pile / a desk for an unfinished day

Design plan written September 12, 2026, before implementation. This is a visual and interaction pass on the existing functional MVP; API contracts, extraction, persistence, ownership, and calendar approval remain intact.

## Research and decisions

Reviewed the public sites and their visible product examples, not authenticated product accounts:

- [Milanote](https://milanote.com): mixed media has its own silhouette and board grouping creates meaning. Adopt source-specific objects and a narrow tool rail. Avoid infinite-canvas complexity, connector lines, and arbitrary positioning.
- [mymind](https://mymind.com): visual memory and representation appropriate to what was saved. Adopt image thumbnails, recognizable originals, and search with receipts. Avoid its marketing gradients and unstructured masonry for dated commitments.
- [Heptabase](https://heptabase.com): bounded cards and spatial grouping help people reason. Adopt clear Today/week/later relationships. Avoid graph tooling and dense research controls.
- [Are.na](https://www.are.na): editorial restraint and content-first blocks. Adopt quiet chrome, readable labels, and generous space between groups. Avoid austere monochrome where type color can aid scanning.
- [Craft](https://www.craft.do): notes, tasks, and calendar belong together; paper and typography can create a recognizable surface. Adopt coherent materials across dialogs and calendar. Avoid giant landing-page type and decorative paper collage inside a working app.
- [UntilNow on AI UX](https://www.untilnow.com.au/blog/ai-ux-design) and [InterfaceKit on generic AI sites](https://blog.interfacekit.io/what-makes-a-website-look-ai-generated): polished defaults do not replace product-specific decisions. Our implementation must express source identity, urgency, review and provenance. No repeated sparkle icons, generic promotional headings, or uniform rounded tiles.

## Visual contract

A warm paper desk, not a literal corkboard. The main board is the hero. Today spans three adjacent notes; the week is a broader planning sheet; Later is an idea pocket. The right rail is a desk calendar and small review area. Chrome is a narrow 104px navigation strip. On mobile the functional sequence is capture, Today, Inbox, week, Later, supporting calendar.

### Exact tokens

| Token       | Value   | Use                           |
| ----------- | ------- | ----------------------------- |
| canvas      | #F3EFE6 | workspace                     |
| canvas-deep | #EAE4D8 | rail, quiet recesses          |
| paper       | #FFFCF5 | original text/PDF, dialogs    |
| ink         | #292823 | primary text                  |
| muted       | #69665E | secondary text on light paper |
| border      | #D7D0C3 | structural dividers           |
| butter      | #F4DC88 | tasks                         |
| sage        | #C8D6B9 | notes/references              |
| blue        | #BFD4DE | events                        |
| rose        | #E4BBB0 | deadlines                     |
| peach       | #E7C6A5 | reminders                     |
| lavender    | #CEC7DF | ideas                         |
| green       | #465648 | primary action                |
| warm-ink    | #795D48 | handwritten accent            |

Type-color is semantic, never inferred from project name. Text on colored notes uses ink or #514D43 for sufficient contrast. State also has words/icons, never color alone.

Instrument Sans Variable is the sole UI face, locally bundled; weights 400–700. Caveat 500 is used only for the single margin note and small empty-state accents. Body 14–16px / 1.5; card titles 18–20px / 1.22; page titles 30px / 1.12; metadata generally 12px, compact source/status annotations 11px, sparse uppercase labels 10–11px. No body handwriting. Page headings describe place, not marketing claims.

Spacing follows 4/8/12/16/24/32/40px. Main padding 32px, reduced to 24 at 1280 and 16 on mobile. Paper radius 4px, form controls 6px, dialogs 8px. Pill/circle shapes only for statuses, avatars and voice control. One-pixel structural borders; paper shadow `0 2px 2px #2928230a, 0 7px 15px #29282308`. No gradients/glass/glows, no background image texture. Material comes from warm surfaces, edge lines, a restrained fold on PDF sources, folder tabs and one translucent tape strip on the calendar.

Icons: Lucide, consistent 1.6px stroke, functional 16–20px. Never an icon at every heading. Full text labels for capture and important actions; source receipt includes source name/type. Buttons have at least 36px desktop and 44px mobile targets. Focus uses a visible 2px ink outline with offset.

## Objects and component boundaries

- `PileCard`: semantic type, project, dates, calendar/review state, readable source receipt and completion. Today stable; only loose idea cards rotate a deterministic fraction of a degree. Hover changes outline, never universal float.
- `SourceCard`: original text scrap, voice transcript with symbolic waveform (not an audio player or measured waveform), PDF paper with filename/fold, image with actual thumbnail. Compact form for board inbox; full form for captured context.
- `SourcePreview`: actual image/PDF extracted-text preview and original/transcript, provider badge, open original. No invented duration or audio playback because recordings are not retained.
- Existing workspace orchestrates API calls and Radix dialogs; existing editor/review/recorder remain behaviorally intact.
- Sorting receipt: saved source lands, a small split-sheet sequence marks processing, then returned items enter. Minimum ~800ms total if server is faster, no additional long server wait. Actual item count only after server returns. Reduced motion removes delays/transforms.
- Completion: short strike/fade only after successful mutation; errors retain item. Dialogs 140ms opacity/translate; buttons 120ms; item landing 320ms with bounded stagger. Reduced motion disables all animation and rotation.

## Responsive and QA contract

At 1440×900 and 1512×982 show capture and all three seeded Today priorities without scrolling. At 1280×800 retain readable titles and clear Today focus. At 390×844 single column, labeled capture controls, accessible mobile navigation and no horizontal page overflow. Calendar becomes a readable day agenda on mobile. Dialog actions remain reachable by internal scrolling; review actions stay visible while the list scrolls.

QA: preserve all existing unit/integration/end-to-end flows, add meaningful coverage for source previews, keyboard recording labels, reduced motion and viewport overflow. Audit automated accessibility plus manual focus/dialog operation. Capture all routes/states again, visually inspect, refine, then save curated screenshots. Build and test before committing and pushing main.

## Final implementation refinements

Desktop Today occupies the first row, with week and Later side by side below and the originals tray beneath them. Mobile moves the originals tray between Today and week. DOM reading order follows Today → Inbox → week → Later. The board drops its extra eyebrow and tightens the capture tray so all three seeded Today cards fit at every tested desktop height.

Native embedded PDF viewing was blank in headless Chromium; the final preview is an explicitly labeled extracted-text paper sheet with a working original-file link. Image previews use actual protected file bytes. Dialogs explicitly restore focus to their opener. The microphone stops its tracks when closed, including if permission resolves after closure. Sample-loading and real-transcription activity have different honest labels.
