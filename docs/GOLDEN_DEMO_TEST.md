# Golden demo rehearsal

Use the prepared recording checkout on port 3001. The final release evidence is in `docs/qa/golden-demo.json`; it records raw live ElevenLabs transcripts, edited transcripts, candidate titles/types/dates, and completed downstream steps. Generated spoken audio was fed through Chromium microphone capture and MediaRecorder, then sent to the real ElevenLabs API. This is not a physical-microphone or native-Safari sign-off.

## Rehearsal sequence

1. Stop the recording server, run `pnpm demo:reset`, restart with `pnpm start`, and refresh the recording tab.
2. Open Talk it out. Say: “I need to finish the HackRice submission tomorrow morning, email Maya tonight, and my dentist appointment is Tuesday at three.”
3. Stop and wait for the actual transcription result. Check the name HackRice; edit misrecognition before sorting. Play back the recording if needed.
4. Sort into three separate candidates. Check the task date, tonight’s local date, and Tuesday 3 PM. Save the three items.
5. Upload `demo-assets/sample-syllabus.pdf`. Expect four dates, one lecture, and two optional schedules, not policy/grading tasks. Five candidates should be selected by default.
6. Add five to Calendar, confirm, and **wait until the confirmation finishes and the dialog closes** before navigating. Premature hard navigation can interrupt a pending operation.
7. On Calendar, jump to the voice task’s date. Complete it, wait for the Reopen control, and verify Board reflects completion.
8. Search Maya; results should be relevant. Search a nonsense string; there should be zero items.
9. In Inbox, open the syllabus and inspect the actual rendered PDF. Paging should reach all four pages.
10. Open Observation #2 on Calendar and download its `.ics`; export is a file, not Apple live sync.
11. Repeat voice with: “I have a probability test, linear algebra midterm Wednesday, and calc homework due Friday.” Expect three items; only the undated probability test asks for clarification.
12. After rehearsal, stop/reset/restart again. Do not leave rehearsal captures in the final recording workspace.

## Recovery and boundaries

Live speech recognition may mishear proper names. Keep the transcript editor and audio playback visible until you are satisfied. Retry transcription while the dialog remains open. Audio playback is not retained after closing the dialog.

If microphone capture or the provider fails, type/paste the same sentence and explain that this is the same extraction path with text. Do not describe the sample shortcut as live speech recognition. If Google is unconfigured, explicitly use the Demo calendar or download ICS.

The production automated rehearsal waits for UI state changes rather than treating an accepted click as a completed save. The actual physical-microphone check remains required once the Mac is unlocked.
