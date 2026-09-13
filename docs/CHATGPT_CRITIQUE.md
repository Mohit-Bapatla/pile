Worked for 1m 50s

I read the fresh handoff and the screenshots. This is substantially better than the earlier version. At this point I would not do another broad product/design pass. The Work/Productivity rubric specifically wants a real pain point, less friction, and something people would keep using, and Pile now genuinely satisfies that. HackRice also grades technical rigor, originality, UX, practicality, and relevance.

HackRice 16 Hacker Handbook

My current judge-style score would be roughly:

Criterion	Score	Why
Technical Rigor	8.5/10	Extraction policy, provenance, dedupe, recurrence/timezone handling, search ranking, failure modes, 115 tests. Main deduction is that several external integrations are only contract-tested.

FINAL_PREJUDGE_HANDOFF


Originality / Creativity	7.5/10	“AI turns messy stuff into tasks” is not novel by itself. Selective actionability + source traceability + uncertainty handling is the genuinely differentiated part.
UX / Design	8.5/10	Board looks cohesive and authored. Warm paper/sticky-note system works. Some secondary surfaces are still more generic.
Practicality / Impact	9/10	Very believable student/general productivity pain. A syllabus becoming five commitments rather than 50 facts is compelling.
Track Relevance	9.5/10	Extremely aligned with reducing cognitive load and making work manageable.

HackRice 16 Hacker Handbook

So I think the project itself is around 43/50 quality right now, assuming the demo is clean.

The 10 biggest remaining weaknesses
#	Weakness	What I would do	Impact	Time	Risk
1	The actual differentiation still isn't obvious enough in the first 10 seconds. “A place to put it all” sounds pleasant, but could describe Notion, Apple Notes, or dozens of AI organizers.	Make the core sentence explicitly about filtering the noise: “Drop anything in. Pile pulls out only what you need to act on.” Keep the nicer headline if you want, but put this directly below it.	Very high	10–20m	Very low
2	None of the sponsor integrations are live-verified. For general judging this is fine. For a sponsor challenge, it is a major problem. The handoff correctly says ElevenLabs, Backboard and Tiger are all implemented but not live verified.

FINAL_PREJUDGE_HANDOFF

	Pick ONE sponsor challenge to seriously pursue and live-connect it. I would choose ElevenLabs if you can get a key quickly because its value is visually obvious. Don't burn time getting all three working.	Very high for sponsor prizes	30–90m	Medium
3	Your demo workspace can still be poisoned by old data. The handoff explicitly says the Safari workspace contains an old 50-item import.

FINAL_PREJUDGE_HANDOFF

	Add/verify a one-click Reset demo workspace or prepare a completely fresh browser profile before judging. Seed exactly the data you want. This is mandatory prep IMO.	Very high	10–30m	Low
4	Voice is still a demo risk. Physical Safari microphone did not work, and no live ElevenLabs call occurred.

FINAL_PREJUDGE_HANDOFF

	Do not fix Safari unless it becomes trivial. Demo in Chromium. If you obtain ElevenLabs credentials, verify a real Chrome microphone once and then it can become part of the hero demo. Otherwise keep the labeled sample as backup only.	High	5m–1h	Low if you avoid Safari
5	The syllabus review is clean, but it doesn't visually prove why Pile is smarter than extraction. It says 5 important + 2 optional, but the judge has to trust that the source contained lots of irrelevant information.	Add a tiny line like “38 other details stayed with the source.” Better still, clicking an item can reveal one short evidence excerpt/page reference. That makes selectivity and provenance tangible.	High	20–45m	Low
6	Search can visually look like duplicate results. “Maya” returns the extracted task plus the voice source, yet the header simply says “2 matches.”	Group or label the count: “1 item · 1 source”, or sections “Things” / “Sources.” Keep both results, because source traceability is valuable.	Medium	20–40m	Low
7	Settings makes the product look less finished than the main app. “Google Calendar: Not configured,” “ElevenLabs: Not configured,” “Backboard: Not configured” exposes the implementation gaps immediately.	Don't visit Settings in the main demo. Optionally replace “Not configured” with the more product-like “Connect” / “Available” while remaining truthful. Do not hide status if a judge asks.	Medium-high	10–25m	Very low
8	Calendar is the weakest major visual screen. It works, but repeated “Demo calendar” labels plus dashed unsynced cards create more noise than the board.	Label the calendar once at the top, add a tiny legend for dashed vs synced, and remove repeated “Demo calendar” text from every event if feasible. Do not redesign the whole calendar.	Medium	20–45m	Low
9	“Add to Apple Calendar · .ics” implies stronger integration than you actually have. Your own QA says the file preview worked but a real Calendar import was not verified.

FINAL_PREJUDGE_HANDOFF

	Rename it to “Download calendar file (.ics)” or “Export for Apple Calendar.” More accurate and actually sounds more finished.	Medium	5m	Tiny
10	There is still a generic-AI-wrapper objection a judge can make: “Couldn't ChatGPT read my syllabus and tell me the deadlines?”	Don't build a feature. Make the answer visible in the product/demo: Pile persists the result, separates mandatory vs optional, preserves provenance, flags uncertainty, deduplicates, creates bounded recurring events, and waits for calendar approval. The key is not extraction; it is reliable triage.	High	Mostly pitch	None

The most important product point

Your strongest demo is not voice, search, Apple Calendar, or even the pretty sticky notes.

It's:

“This document contains a ton of information. Pile found the five things that will actually affect my semester and left everything else attached to the original.”

That is the moment where this stops looking like “LLM + task app.”

Your handoff already shows that the extraction system distinguishes important actions, optional schedules, project metadata and ignored prose, and even tests conflicting dates and prose-only documents.

FINAL_PREJUDGE_HANDOFF

 That's the technical/product core I would emphasize.

As a normal user

The pain is believable. People don't really need another todo list. They need fewer steps between:

“I just received/remembered this thing”

and

“the right thing is now where I need it.”

Pile is strongest when it behaves like a filter, not an organizer the user has to organize.

The board screenshot is good. I would not redesign it. The sticky-note treatment feels distinct enough without getting gimmicky. The taped mini-calendar is probably the most memorable visual detail. Don't add more lofi decoration.

One small interaction I would question is the empty circle at the lower-right of each sticky note. If that's a completion control, its meaning isn't immediately obvious from the screenshot, especially because the card also has a check-like mark beside TASK. If actual users hesitate there, give the circle a hover/tooltip or make the completion affordance slightly clearer. I would only touch this if it's a 10-minute fix.

As a senior SWE

This is stronger technically than the screenshots alone communicate. You have actual source/item separation, owner-scoped data, uncertainty handling, calendar recurrence/timezone semantics, dedupe, graceful failures, search ranking and an expanded adversarial test suite. The fresh handoff says 53 unit + 36 integration + 26 E2E = 115 functional tests, plus build/typecheck/migrations/accessibility coverage.

FINAL_PREJUDGE_HANDOFF

Don't spend demo time saying “we have 115 tests.” Judges won't care much.

If asked about rigor, say something closer to:

“The hard part wasn't calling an LLM. It was deciding when not to create an item. Every extraction goes through an actionability layer, uncertainty gates, dedupe, source provenance, timezone-safe date handling, and explicit calendar approval.”

That's a much stronger technical story.

Sponsor-engineer view

This is where I'd be harsher.

ElevenLabs: Good conceptual integration, but right now I would not expect to win Best Use of ElevenLabs because no real ElevenLabs request has succeeded. The architecture and request-contract tests are solid, but sponsor engineers usually want to see their product actually doing the thing.

FINAL_PREJUDGE_HANDOFF

Backboard: Product fit is good. Persistent semantic memory is genuinely useful for “what did I say about Maya?” The issue is again that it hasn't been live calibrated. If you can live-connect this and show a semantic query that normal lexical search wouldn't catch, it becomes a credible sponsor submission.

FINAL_PREJUDGE_HANDOFF

Tiger Data: Currently the weakest sponsor story. “We can use Tiger as our hosted Postgres” is legitimate infrastructure, but from a Best Use judge's perspective it risks feeling interchangeable with any Postgres host. I would not add complexity just to improve this unless Tiger is specifically the challenge you want to target.

So if time is short:

live ElevenLabs > live Backboard > Tiger sponsor polishing.

What I would actually change before judging

I would only do these 6 things:

Reset/clean the judging workspace.

Change the hero/supporting copy so the selective-filtering value is obvious instantly.

Add “X details stayed with the source” and/or a tiny evidence excerpt to the syllabus review.

Group search into items vs sources.

Clean the small calendar/Apple wording issues.

If you want a sponsor prize, spend the rest of your integration time getting one sponsor live, preferably ElevenLabs.

Then stop.

I would not add OCR, email import, authentication, two-way calendar sync, new AI agents, drag-and-drop, vector infrastructure, more animations, or another major redesign. The handoff itself already identifies the main remaining gaps as live provider verification and demo-state cleanliness, not missing product surface area.

FINAL_PREJUDGE_HANDOFF

One demo adjustment I'd make

The current handoff suggests text → syllabus → calendar → search → maybe voice. That's good, but I would tighten the story even more:

0–10 sec:
“Stuff doesn't arrive organized. Pile lets you drop in a thought, file or voice note and pulls out only what you'll actually need later.”

10–25: brain dump → two cards.

25–55: syllabus → “This is the important part: it ignored the professor bio, policies and other noise. Five things affect my semester, two are optional.”

55–70: approve to calendar.

70–85: search Maya, then open source/provenance.

85–100: technical line:
“Every result stays tied to its source, uncertain dates require review, and nothing touches your calendar without approval.”

If real ElevenLabs works by then, replace the typed brain dump with voice. If it doesn't, don't apologize for it and don't demo a fake-looking sample unless asked. The general-track product is already strong enough without voice.

My biggest warning is: don't let sponsor pursuit weaken the main Pile story. Your Work/Productivity submission is currently much stronger than your sponsor-challenge submission. The track itself explicitly rewards a clear pain point, reduced friction and something users would continue using, which is exactly where Pile is strongest.

HackRice 16 Hacker Handbook

Sources
