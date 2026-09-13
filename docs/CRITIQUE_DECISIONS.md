# Independent critique decisions

Source: full rendered ChatGPT response in CHATGPT_CRITIQUE.md, obtained in the user's existing conversation after submitting the complete pre-judge handoff and six screenshots. Text completeness verified after whitespace normalization: 11,235 UTF-16 characters, FNV-1a hash 123955505. Scores are one model's subjective critique, not actual judging results. The original response is preserved without summarizing or rewriting it.

| Recommendation | Benefit / judging relevance | Cost estimate | Regression risk | Decision |
|---|---|---|---|---|
| 1. Make selective-filter value obvious in first ten seconds | Communicates core pain and differentiation immediately; high UX/impact relevance | 10 min | Low | **DO NOW:** compact supporting copy in capture area, preserve board identity |
| 2. Pick one sponsor and verify it live | Strongest sponsor evidence; ElevenLabs first, Backboard second | 30–90 min plus credentials | Medium | **DO IF CHEAP:** credentials absent after fresh checks; do not invent evidence or request secrets in chat. Document exact next verification path |
| 3. Clean/reset judging workspace | Avoid old 50-item legacy import undermining current behavior | 10 min | Low for separate profile, high for destructive reset | **DO NOW:** prepare a fresh isolated headed Chromium session and document repeatable launch. **DO NOT DO:** delete or silently rewrite existing personal captures |
| 4. Avoid unverified Safari microphone as hero | Prevent stalled permission from consuming demo; high reliability relevance | 5 min | Low | **DO NOW:** demo uses verified Chromium and typed text. Add bounded microphone-wait recovery; sample remains explicitly labeled |
| 5. Show “38 other details stayed with source” and/or evidence | Makes actionability and provenance tangible; high technical-rigor relevance | 20 min | Low | **DO NOW:** exact source-evidence disclosure per review row and real page count. **DO NOT DO:** invented ignored-detail count, since no trustworthy denominator exists |
| 6. Separate item/source search results | Prevent apparent duplicate matches; improves user trust | 20 min | Low | **DO NOW:** separate headings, counts and search-provider label; meaningful initial empty state |
| 7. Hide unfinished-looking Settings / use Connect or Available | Cleaner presentation, but substituting status can mislead | 10 min | Low code risk, high credibility risk | **DO NOT DO:** replace absent-key labels with Available/Connected. Keep truthful configuration status. Omit Settings from the short pitch unless asked |
| 8. Label demo calendar once, with legend | Reduces repetitive chrome while preserving distinction | 20 min | Low | **DO NOW:** one top-level mode and legend; retain per-event demo label if a mixed live/demo context needs it |
| 9. Rename Apple action as download/export | Aligns button with actual effect and incomplete native import evidence | 5 min | Low | **DO NOW:** Download calendar file (.ics), retain import instructions |
| 10. Answer “could ChatGPT do this?” through pitch | Highlights persistence, uncertainty, dedupe and approval, not just LLM call | 10 min | None | **DO NOW:** rewrite the final demo script around selective actionability and source evidence |
| Extra: clearer completion control | Potential discoverability gain | 5 min | Low | **DO IF CHEAP:** inspect existing accessible labels/tooltips first; avoid decorative redesign |
| Keep board / taped mini-calendar / typography | Preserves existing coherent visual identity | None | Avoids regression | **DO NOT DO:** major redesign or additional decorative animation |
| OCR, email import, accounts, two-way sync, agents, drag/drop, vectors | Potential long-term utility, poor pre-judge time/risk ratio | Days | High | **POST-HACKATHON** |
| Do not spend demo time reciting 115 tests | Keeps attention on user outcome while retaining QA evidence for Q&A | None | None | **DO NOW:** technical one-sentence explanation after value demo |

## Bounded implementation groups

1. Product/capture copy.
2. Review evidence and real source-page context.
3. Search groups, counts, initial state and provider clarity.
4. Calendar visual labeling and accurate ICS download wording.
5. Voice permission-wait recovery and truthful sample guidance.
6. Isolated judging browser preparation and revised 100-second demonstration.

The two additional DST regressions were independently discovered while ChatGPT was thinking; they are QA fixes, not attributed to the critique. Live sponsor tests and native Apple import remain limitations, not hidden successes. No additional major features or architectural refactor are authorized by this critique.

## Completion

All six bounded groups were completed. The headed `pile-judging` session contains only the five seed items and is left ready on the board. The completion control already has a specific Complete/Reopen accessible name; no further visual redesign was made. Final gate: 55 unit, 36 integration, 29 E2E (120 total), plus production visual/accessibility and external-network-blocked browser smoke. See FINAL_HACKRICE_HANDOFF.md for the release record and exact device limits.
