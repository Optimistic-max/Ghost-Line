# What wins Kiro hackathons (and Kiroween in particular)

Researched 2026-11-22. Primary sources are the Devpost hackathon pages, the rules pages, the winning project pages, and the winners' YouTube videos (I read the auto-transcripts and grabbed frames). Anything I could not check directly is marked **UNVERIFIED**.

How I worked: Devpost blocks plain HTTP fetches (403), so I read the pages in a real browser without signing in. To find the winners, I filtered each project gallery for the Devpost "Winner" badge, then opened each winning project page to see which prize it took. For video length and the first 20 seconds, I used each video's `lengthSeconds` value and YouTube's auto-generated transcript, plus screenshots at about 5 and 16 seconds.

---

## 1. Kiroween 2026 (the current event)

Sources: https://kiroween.devpost.com/ , https://kiroween.devpost.com/rules , https://kiroween.devpost.com/details/faqs , https://kiroween.devpost.com/updates

### Dates (Official Rules, section 1)
- Registration: Oct 13, 2026 – Dec 4, 2026, 2:00 pm PT
- Submission Period: Oct 30, 2026, 9:00 am PT – **Dec 4, 2026, 2:00 pm PT**. "No extensions will be granted."
- Credit requests (4,000 Kiro credits per person) are due **Dec 1, 2026, 12:00 pm PT**. Codes must be redeemed by Dec 4, and redeemed credits expire Dec 31, 2026.
- Judging: Dec 16, 2026 – Jan 29, 2027. Winners are announced around Feb 3, 2027.
- Registrations as of today: 18,439 (Devpost API listing).
- **New projects only.** Projects started before Oct 30, including Kiroween 2025 projects, are not eligible. This is a change from 2025, which allowed "significantly updated" existing projects.

### Categories (exact wording, from the overview page and the rules)
- **Resurrection:** "Bring your favorite dead technology back to life. Reimagine obsolete tech with today's innovations or solving tomorrow's problems."
- **Frankenstein:** "Stitch together a chimera of technologies into one app. Bring together seemingly incompatible elements to build something unexpectedly powerful."
- **Skeleton Crew:** "Build a skeleton code template lean enough to be clear but flexible enough to support various use cases. Show us its versatility with two distinct applications from your foundation."
- **Costume Contest:** "Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function."
- Each project goes into one category only (FAQ). The app must use "Kiro (IDE, CLI, Web, and/or Kiro Crew)". The rules add: "Insufficient use of Kiro will result in disqualification at the Judges' sole discretion."

### Judging (Official Rules, section 6)
- **Stage One is pass/fail.** It checks that the project "reasonably fits the theme and reasonably applies the required tools".
- **Stage Two uses five equally weighted criteria, each worth 20% (10 points):**
  1. **Potential Impact:** "Does the project make a credible case for solving a real problem for a real audience? ... Would someone actually use this?"
  2. **Technological Implementation:** "How thoroughly and skillfully does the project use Kiro? Was there a thoughtful strategy to AI development? Was a variety of Kiro tools used impactfully? ... Was there experimentation?"
  3. **Design:** "Does the project deliver a complete, coherent product experience, not just a technical proof of concept? Is the design intuitive, polished, and intentional?"
  4. **Innovation/Idea:** "How creative and novel is the concept ... Are any unusual technologies or public resources (like datasets) leveraged or combined in a unique way?"
  5. **Presentation:** "Does the video clearly demonstrate the project working end-to-end? Does the pitch communicate what problem is solved, who it's for, and why it matters? ... Is the presentation creative and memorable?"
- The rules allow judging by "expert panels, peer review, automated AI-driven analysis, or any combination thereof", in one or more rounds.
- Judges "are not required to test the Project and may choose to judge based solely on the text description, images, and video". The video and write-up therefore carry most of the score.
- Tie-break: tied projects are re-scored from scratch on a 20-point scale per criterion.
- **Best Demo** goes to the highest Presentation score among projects in the top 10% overall.
- Category prizes go to the highest-scoring project in each category, "based on the same Judging Criteria".
- A project can win one Overall Prize or one Category Prize, not both, plus any number of Bonus Prizes.

### Changes from 2025 (important)
In 2025 there were 3 equally weighted criteria: Potential Value, Implementation, and Quality and Design (https://kiroween-2025.devpost.com/rules). 2026 has 5. **Presentation (the video) and Design are now each a separate 20% of the score**, and Impact now asks for "a real audience".

### Prizes (overview page and rules section 8)
| Prize | Amount |
|---|---|
| 1st / 2nd / 3rd Overall | $30,000 / $20,000 / $10,000 |
| Best Resurrection, Best Frankenstein, Best Skeleton Crew, Best Costume Contest | $5,000 each |
| Best Startup Project | $10,000 |
| Best Ghost of Kiroween Past (registered for Kiroween 2025) | $2,000 |
| Best Kiro Crew App | $1,000 |
| Best Student Project, one per category (incl. **Best Student Project: Resurrection**) | $1,500 + 1-year Kiro Pro Max, x4 |
| Best Demo | $1,000 |
| Bonus Blog Prize (100 winners) | 2,000 Kiro credits |
| Social Blitz (5 winners, hashtag #KiroweenHackathon26 at the start of the post) | 3-month Kiro Pro+ |

Judges listed: Sameer Ali, Sergio Rodriguez Inclan, Asad Mohiuddin, Jason Anderson, Zezhen Xu, Massimo Re Ferre, Floor Mesters, Geethanjali Jayakumar Uma, Dustin Ellis, Vivek Velso.

### Submission requirements
- **Repo:** public **GitHub** only (not GitLab or Bitbucket). It must contain "all source code, assets, and instructions required for the project to be functional". It needs an open source license file that is "detectable and visible at the top of the repository page (in the About section)".
- **`.kiro` folder:** "must contain the /.kiro directory at the root of the project to show usage of specs, hooks, and steering. Do NOT add the /.kiro directory or sub-folders to your .gitignore, as this could disqualify your submission."
- **Working app URL.** Test logins go in the private Devpost field, which only judges see.
- **Text description** of features and functionality.
- **Video:** "should be less than three (3) minutes. Judges are not required to watch beyond three minutes". It should show the project "functioning on the device for which it was built". It must be public on YouTube and contain no third-party trademarks or copyrighted music without permission.
- **Kiro write-up:** "Judges must understand how effectively you used Kiro... Show us your next-level understanding of Kiro features". The rules prompt for each of these:
  - IDE/CLI/Web/Crew differences
  - custom agents
  - agent hooks ("What specific workflows did you automate")
  - spec-driven development ("How did you structure your spec... How did this compare to vibe coding?")
  - steering docs ("Was there a particular strategy that made the biggest difference?")
  - MCP
  - property-based testing (PBT)
  - Kiro powers
- The Build Session recording (Nov 11, Brian Beach, "Flappy Kiro" built with spec-driven development) is linked from the Updates tab.

---

## 2. Past Kiro hackathons and their winners

### 2a. Kiroween 2025 (https://kiroween-2025.devpost.com/)
- Oct 31 – Dec 5, 2025, $100k. 4,957 registrations and 747 submissions in the gallery.
- Same 4 categories, with identical descriptions to 2026 (rules: https://kiroween-2025.devpost.com/rules ; announcement: https://kiro.dev/blog/kiroween-2025/).
- 3 criteria: Potential Value, Implementation, and Quality and Design. Quality and Design included "Finding and using unique public resources like datasets" and "Building in delightful UI experiences".
- Winners were announced in the "And the winner is..." Devpost update. No judge comments were published (https://kiroween-2025.devpost.com/updates).
- Prize names below come from each project page's "Submitted to / Winner" box. The gallery shows 62 projects with a Winner badge.

| Prize | Project | What it is |
|---|---|---|
| 1st Overall | **InteractionKit** https://devpost.com/software/kiro-interactionkit | Python + MediaPipe template for gesture-controlled apps, with 2 demo apps (Math-O-Lantern, Holo-Board). Submitted to Skeleton Crew. |
| 2nd Overall | **UnitSet** https://devpost.com/software/unitset | "Frankenstein of frontend": AI design-to-code canvas, E2B sandboxes, Chrome extension. Live at unitset.in. |
| 3rd Overall | **SpookBnB** https://devpost.com/software/spookbnb-when-dark-mode-gets-truly-dark | Airbnb-style landing page where dark mode becomes a flashlight horror escape room. Costume Contest entry. |
| **Best Resurrection** (+ Influencer Judges' Choice) | **Faxi** https://devpost.com/software/faxi-16iecy | Fax-to-internet bridge for offline seniors in Japan. Handwritten fax, then Gemini vision, then MCP agents (email/shopping), then a reply fax. |
| Best Frankenstein | **rumorNet** https://devpost.com/software/rumornet | Multilingual multi-agent misinformation detection on AWS Bedrock/Strands, with a dashboard. |
| Best Skeleton Crew (+ Most Creative) | **Impulse Kit** https://devpost.com/software/impulse-kit | Go/No-Go cognitive training skeleton with 3 themed apps. Plain HTML/JS on GitHub Pages. |
| Best Costume Contest | **Seance** https://devpost.com/software/seance | Folklore world map with a page-flipping book quiz, Three.js smoke, and ambient sound. |
| Best Startup Project | **Splat-n-Treat / WorldNotes** https://devpost.com/software/splat-n-treat | Spatial CMS using Gaussian splats. |
| Influencer Judges' Choice | **BlueKai** https://devpost.com/software/bluekai-bluesky-on-a-flip-phone | BlueSky client for KaiOS 2.5 flip phones, under 75KB gzipped, 8 languages. Resurrection-themed; its category entry is **UNVERIFIED**. |
| Social Blitz (5) | donutamagotchi, Type To Death, Splice, Zombie Blaster, Frankenbook | |
| Bonus Blog Post (~50) | Includes several Resurrection-themed entries: ELIZA EXHUMED, GhostPipes (Yahoo Pipes), Dark Ledger (COBOL), Protocol Resurrection Machine, Necro-OS, "MS Paint: Ctrl Z through time", Legacy Ressurection Studio, Strangler Studio (PHP migration) | |

### 2b. Code with Kiro Hackathon, 2025 (https://kiro.devpost.com/)
- Submissions ran Jul 14 – Sep 15, 2025. The original Aug 25 deadline was extended.
- $100k prize pool and 9,948 registrations.
- Tracks: Productivity & Workflow Tools, Games & Entertainment, Educational Apps, Wildcard.
- Criteria (https://kiro.devpost.com/rules), all equally weighted:
  - **Potential Value:** "widely useful, easy to use, accessible"
  - **Implementation:** "how well the idea is leveraging Kiro"
  - **Quality of the Idea:** "creativity, originality... such as finding and using unique public datasets"
- Announcement post: https://kiro.dev/blog/code-with-kiro-hackathon/

| Prize | Project |
|---|---|
| 1st | **Upload Drive-In** https://devpost.com/software/upload-drive-in : Laravel client-upload portal into your own Google Drive. Solo developer solving a problem from their own studio. Also won the Blog prize. |
| 2nd | **Denarii** https://devpost.com/software/denarii : "Should I buy this?" purchase advisor using weighted decision matrix and MCDA, with voice and chat advisor. |
| 3rd | **cleanclik** https://devpost.com/software/trashypal : scan litter with your camera, sort it, earn points. |
| Best Productivity & Workflow | Healthcare Worker Burnout Prevention & Wellness Platform |
| Best Games & Entertainment (+ Influencer) | Mirae Legends (personalized children's storybooks) |
| Best Educational | BlueandCosmos (space education with satellite/lunar data) |
| Best Wildcard | NetCraft AI (client-side ML on your own data in the browser) |
| Most Innovative Use of Kiro (5) | Kiro's Halloween Night, Elem Game, Whisper, Mindstamps, NeonQuest |
| Influencer Judge's Choice | Mirae Legends, Why Should I Care (WSIC), Taptik Protocol, Refbase |
| Social Blitz | Refbase, LiverTracker.com, HackerDen, Smart Planner, Future Scenarios |

### 2c. Other Kiro-run or Kiro-themed events (found, winners not researched)
- Reddit and Kiro: Community Games Challenge (Oct 13–30, 2025, $45k, run by Reddit): https://communitygames2025.devpost.com/
- Kiro Spark Challenge (ASU, Apr 24–25, 2026, $10.5k; winners not posted on Devpost): https://kiro-spark-challenge.devpost.com/
- Kiro Buildfest 2026 Singapore (invite-only): https://sg-kiro-buildfest.devpost.com/
- AWS Kiro x CS Careers at Virginia Tech: https://aws-kiro-cs-careers-vt.devpost.com/
- KiroHacks Cal Poly: https://kiro-hacks-cal-poly.devpost.com/
- Kiro's Labyrinth (re:Invent 2025 maze-navigator challenge, scored by turn count): https://dev.to/kazuya_dev/aws-reinvent-2025-crowning-the-kiro-code-champions-dvt221-1b47
- AWS Road to re:Invent "useless project" hackathon: the ORIK team says they won after pivoting to match that event's unusual criteria. The "$100,000" figure in the post title is **UNVERIFIED**. https://builder.aws.com/content/301qStCaTZpI0PEGk7YwyTnl8q7/kiroforge-to-orik-won-dollar100k-building-useless-developer-tool

---

## 3. Close-up of the winners: video, Kiro usage, polish

"First 20s" comes from the YouTube auto-transcript (timestamps), plus frames I grabbed at about 5 and 16 seconds. Lengths come from YouTube's own `lengthSeconds` value.

### Faxi (Best Resurrection, Kiroween 2025): video https://www.youtube.com/watch?v=P815zFoZgEY
- **Length:** 2:59 (179 s), just under the limit.
- **First 20 s:** the presenter (webcam bubble) gives their name and the whole value proposition in one breath by 0:09: "resurrecting fax machines to let offline seniors in Japan access email, shopping, and online services". By 0:16 he has the audience fact: Japan has the oldest population, and millions of seniors have never used the internet. The screen shows a polished marketing landing page ("Stay Independent. Stay Connected.").
- **Rest of the video:** live demo of an email by fax, then shopping by fax (Amazon search, a reply fax with options, circle-to-order), then the admin order dashboard. He invites judges to actually send a fax to a real number.
- **Kiro usage:** barely mentioned in the video (one thank-you near the end). It is carried by the write-up:
  - "16+ specifications in .kiro/specs/"
  - 4 agent hooks: auto-translate locale files, TypeScript error detection, update help/FAQ when features change, sync docs/specs with code
  - steering documents
  - **2 custom MCP servers**: a Spec Validator that checks code against specs, and an Auto-Docs server that uses Playwright screenshots
  - It quotes one EARS spec line that "shaped the entire architecture".
- **Polish:** a production-style system (Telnyx, BullMQ, SES, Stripe, Playwright, Next.js admin) with live QA URLs, a demo page, and an admin login for judges.
- **Why it fits Resurrection:** the dead tech is still in use by a specific, sympathetic audience. The modern AI is invisible, and the whole loop runs end to end.

### InteractionKit (1st Overall, Kiroween 2025): video https://www.youtube.com/watch?v=FHMdbhIxMt4
- **Length:** 2:52 (172 s).
- **First 20 s:** a branded title card ("InteractionKit: Build creative gesture-powered apps with Kiro") with a webcam inset of the presenters. The narration states credentials and the problem: "coding agents often hallucinate MediaPipe functions that don't exist". The product name lands by about 0:34.
- **Kiro usage, narrated explicitly from 1:13 to 1:52:** steering docs as a "rock-solid blueprint", 3 hooks that auto-wire new gesture files, Context7 MCP for live MediaPipe and Pygame docs "to stop hallucinations", and specs used to build the 2 demo apps. The write-up includes a feature / how-used / why-it-mattered table.
- **Polish:** a working desktop Python app with 2 demo games, 17 gestures, a GitHub repo, and a dev.to tutorial.

### UnitSet (2nd Overall, Kiroween 2025): video https://www.youtube.com/watch?v=Fo9IyXTqRNA
- **Length:** 4:08 (248 s). Over the 3-minute guideline, and it still placed 2nd under the 2025 rules.
- **First 20 s:** no spoken transcript was available. The frames show a highly polished dark/amber marketing site ("From sketch to ship, all in one place." at 0:05, "Vibe design for vibe coders." at 0:16). Whether there is narration is **UNVERIFIED**.
- **Kiro usage in the video:** **UNVERIFIED** (no transcript).
- **Polish:** the most product-like entry. A live SaaS (unitset.in) with auth, billing, sandboxes, and a browser extension.

### SpookBnB (3rd Overall, Kiroween 2025; Costume Contest entry): video https://www.youtube.com/watch?v=6EIi0rokiBo
- **Length:** 3:00 (180 s).
- **First 20 s:** opens on a hook question, roughly "what if a vacation rental site hid a terrifying secret?", over a polished luxury-cabin hero ("Find Peace in Nature's Embrace"). It then reframes a familiar feature: "What if dark mode became true horror?"
- **Kiro usage:** from 0:33, specs (requirements, design, and task breakdown "before writing a single line of code"). At 1:29, hooks that auto-translate comments and strip console logs on save. The write-up gives counts: 8 requirements, 11 phases, 50+ tasks, plus "living documentation" specs kept up to date.
- **Polish:** the dual-mode UI is the whole product. It has 4 puzzles and an escape ending, and it is live on Vercel.

### rumorNet (Best Frankenstein, Kiroween 2025): video https://www.youtube.com/watch?v=5ei5kdsVJUs
- **Length:** 3:42 (222 s), over the limit.
- **First 20 s:** problem first: "Misinformation doesn't respect borders", with a São Paulo to New York example. The product name comes in by 0:15.
- **Kiro usage:** at 2:00, "a revelation and a warning". It covers specs for production scaffolding and steering to tailor the setup. The write-up candidly says Kiro's first design was "antiquated" and the team had to "kill" it.
- **Polish:** a live dashboard on Render and a GitHub repo.

### Impulse Kit (Best Skeleton Crew + Most Creative, Kiroween 2025): video https://www.youtube.com/watch?v=QDrQQLuOpkQ
- **Length:** 2:45 (165 s).
- **First 20 s:** a personal story: "Hi, I'm Sonia. A few weeks ago, I saw a video about Swiss scientists..." The neuroscience premise is explained within 20 s.
- **Kiro usage in the video:** the auto-transcript has no match for Kiro/spec/hook/steering/MCP. That could be an auto-caption misspelling, so it is **UNVERIFIED**. Kiro usage is presumably in the write-up.
- **Polish:** simple HTML/CSS/JS on GitHub Pages. It won on idea clarity and the 3 distinct themes, not tech depth.

### BlueKai (Influencer Judges' Choice, Kiroween 2025): video https://www.youtube.com/watch?v=aQAQOIzGeAo
- **Length:** 2:31 (151 s). Music only, no narration.
- **First 20 s:** a real flip phone held in hand, with the text "Bluesky on a flip phone?" The real device is the hook.
- **Kiro usage:** in the write-up. EARS user stories, Kiro researched the AT Protocol and Gecko 48 limits, a 25-task plan, and specs for foundations plus vibe coding for fixes.
- **Polish:** under 75KB gzipped, 8 languages including RTL, an offline mode, and a public site.

### Seance (Best Costume Contest, Kiroween 2025)
- The video (https://www.youtube.com/watch?v=1FIc4Hev--w) is now **private**, so its first 20 s and length are **UNVERIFIED**.
- The write-up covers EARS/INCOSE requirements, optional tasks for tests, a "README Beautifier" hook, Three.js smoke, react-pageflip, and ambient audio. Live on Vercel.

### Upload Drive-In (1st, Code with Kiro 2025): video https://www.youtube.com/watch?v=0_ULZ8y_Dkc
- **Length:** 1:56 (116 s). The shortest of the winners.
- **First 20 s:** a title card "Idea + Developer + Kiro = APP" with the logo, over narration: "I run a digital studio ... clients had trouble sending me huge files ... so I built Upload Drive-In" (by 0:17). That is a real problem from their own business.
- **Kiro usage:** from 0:38, "Kiro helped me turn my prototype into a polished, robust app". It describes asking Kiro to refactor a hacked-together Drive script behind a generic storage interface, and closes on "spec-to-code workflow".
- **Polish:** 10 annotated screenshots on Devpost, branding settings, and a live site.

### Contrast: ELIZA EXHUMED (Resurrection-themed, won only a Blog Post bonus): https://devpost.com/software/eliza-exhumed
- The video (https://www.youtube.com/watch?v=DGwRxFPwgEc) is **7:46 (466 s)**, more than 2.5x the limit.
- The concept is clever: the 1966 ELIZA side by side with an LLM "possessing" ELIZA's rules, in a CRT terminal.
- Why it lost is **UNVERIFIED** (no judge comments). Plausible factors are the video length and a nostalgia/curiosity framing with no clear real-world audience or problem.

---

## 4. Patterns

### What the winners had in common (from the projects above)
1. **Problem and audience first, Kiro later.** Every narrated winner stated who it was for and what hurts in the first 10–20 s: seniors with fax machines, CV hackers, agencies with large files, multilingual misinformation. None opened with an IDE tour. Kiro talk came after the 30-second mark, or only in the write-up.
2. **A polished, product-like first frame.** Faxi, UnitSet, and SpookBnB all open on a finished-looking landing or hero screen. BlueKai opens on real hardware. Under the 2026 Design criterion ("complete, coherent product experience, not just a technical proof of concept"), this matters even more.
3. **Something judges can actually touch.** A live URL (Vercel/Render/own domain), a real fax number (Faxi), GitHub Pages (Impulse Kit). Judges may not test, but a live link backs up the "working end-to-end" claim.
4. **Concrete, countable Kiro usage in the write-up, tied to the domain:**
   - Faxi: 16+ specs, 4 hooks, 2 custom MCP servers
   - InteractionKit: 3 hooks that wire gestures, Context7 MCP to stop hallucinations
   - SpookBnB: 8 requirements, 50+ tasks, 2 hooks
   - BlueKai: EARS stories and a 25-task plan

   Winners explained why each feature mattered, and they quoted specific spec lines. Several also said honestly where Kiro went wrong (rumorNet "killed" Kiro's first design; steering not always followed is a common theme).
5. **Specs for the foundation, vibe coding for polish.** This hybrid shows up again and again (SpookBnB, BlueKai, rumorNet, ELIZA). It answers the rules' own question, "How did this compare to vibe coding?"
6. **The Resurrection winner revived a technology people still depend on**, not just a nostalgic artifact. Faxi gives a living fax-machine audience access to modern services. Several pure-revival entries (ELIZA, Yahoo Pipes clone, MS Paint, COBOL payroll) took only blog prizes. This is inference from the results; no judge said so.
7. **Video length:** most winners came in at or under 3:00 (Faxi 2:59, InteractionKit 2:52, SpookBnB 3:00, Impulse 2:45, BlueKai 2:31, Upload Drive-In 1:56). Two 2025 winners ran over (UnitSet 4:08, rumorNet 3:42), but in 2026 the video is 20% of the score and judges "are not required to watch beyond three minutes". Treat 3:00 as a hard cap.

### What judges and organizers say they value
- Kiro and Devpost published **no judge write-ups** for Kiroween 2025 or Code with Kiro. The only official signals are the criteria text and the write-up prompts quoted above.
- The 2026 criteria themselves are the strongest signal. They add "real audience", "would someone actually use this", "not just a technical proof of concept", "variety of Kiro tools used impactfully", "experimentation", and "unusual ... public resources (like datasets)". The video must show the project "working end-to-end" and say "who it's for, and why it matters".
- General hackathon judging (not Kiro-specific), from https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l : say what the product is in the first sentence, show a working flow rather than slides, keep scope believable, be clear about what was built during the event, and admit weaknesses. As that judge put it, "Judges are not evaluating your project against an ideal."
- ORIK post-mortem (Road to re:Invent): reread the criteria and build exactly to them. The judges valued that "Everything actually worked." https://builder.aws.com/content/301qStCaTZpI0PEGk7YwyTnl8q7/kiroforge-to-orik-won-dollar100k-building-useless-developer-tool

### Common reasons good projects lost (inferred from rules and results, **UNVERIFIED**, since no judge feedback is published)
- Videos far over 3 minutes (for example ELIZA EXHUMED at 7:46). In 2026 the content after 3:00 is simply not scored.
- A long backstory or context before the product appears.
- Nostalgia or novelty with no credible real user. That now directly costs points under Potential Impact.
- A technical proof of concept without a finished product surface (Design criterion).
- Kiro usage that is generic ("Kiro helped me build it") instead of specific specs, hooks, steering, and MCP with reasons.
- Rule failures at Stage One: a missing or `.gitignore`d `.kiro` folder, a non-GitHub repo, a license not detected in the About section, no working URL, a private or unlisted video. For example, the Seance video is now private, which would fail the "publicly visible" rule if checked now. Also, in 2026, any code started before Oct 30.

---

## 5. Application to a data-story web app in Resurrection (my recommendations)
- Name the **dead technology** and the **living audience** in the first sentence of the video. Something like "X died in 20XX, but Y people still need what it did."
- Show the finished product UI in the first 5 seconds.
- Use a **public dataset** visibly. The 2026 Innovation criterion and the 2025 and Code with Kiro criteria all reward unusual public datasets. Cite the source on screen and in the README.
- Spend 20–30 seconds of the video on Kiro: a `.kiro/specs` requirement line that shaped the design, one domain-specific hook, one steering rule, and an MCP server for data access if possible. Put the counts and reasons in the write-up, and answer every prompt in the rules list (specs vs vibe coding, hooks, steering, MCP, PBT, powers, Crew).
- Keep the video at 2:30–2:55, public on YouTube, with no copyrighted music. Keep the live URL up through Jan 29, 2027 (the end of judging).
- Also enter Best Student: Resurrection (if eligible), Best Demo (automatic), and the Blog prize (a third-party blog post that mentions Kiroween 2026). The Blog prize had about 50 winners in 2025.
