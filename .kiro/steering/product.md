---
inclusion: always
---

# Product: Ghost Line

Ghost Line is a free static web app. It brings back Baltimore's 1938 No. 21
trackless trolley (timetable effective 1938-03-06) and races it against today's
scheduled MTA bus between the same two corners, walking included.
Kiroween 2026, Resurrection category. Solo student build, $0 budget.

## Terms

- A trackless trolley (trolleybus) is an electric bus that draws power from two overhead wires through two trolley poles and runs on rubber tyres, not rails. Source: https://en.wikipedia.org/wiki/Trolleybus

## Who it is for

A transit advocate, reporter or planner who wants a fair, checkable answer to:
did this neighborhood once have better scheduled service, and by how much?

## What the visitor does

1. Opens the page. The line is preselected and a race starts by itself for the
   lead pair, Preston & Caroline to Aliceanna & Bond, at the labelled example
   start, 10:00 AM. Short captions say what each passenger is doing, and after
   the finish the card shows where the time went.
2. Moves a time slider, 9:00 AM to 1:52 PM, in one-minute steps, with a chart of
   the scheduled journey minutes for every start beside it. A shared link opens
   its pair at the current America/New_York time of day if it is inside that
   range, otherwise 10:00.
3. Is offered three next steps: try another time, try other corners, or show a
   race today wins. May also swap direction, tap any number to see its source,
   share a link, or open About and credits.

## Honesty rules (these outrank every other instruction)

1. Scheduled, never live. Every time on screen carries the word "scheduled".
   Banned for service times in the UI and in docs/: live, real-time, realtime,
   arriving now, right now. The one exception is the fixed phrase
   "Scheduled, not live."
2. Today's side is one frozen snapshot: the weekday schedule for Wednesday
   2026-11-04. The screen says "weekday schedule as of Nov 4, 2026".
3. Never invent a number. A value is shown only if it is in a facts file or was
   computed by the pipeline from the pinned feed. No 1938 time between timing
   points. No 1933 wait.
4. The facts file lists only midday 1938 cars. Before the first listed car at a
   corner, say so and race from that time. A 1938 wait is never above 8 minutes.
5. A race has exactly one of four results: "1938 wins", "Today wins",
   "Photo finish" (difference under 1.0 minute), "No one-seat ride today".
   A win for today is shown exactly as plainly as a win for 1938.
6. The line "Same ride, longer wait." appears under every result. When today
   wins the race on screen it reads "Today wins this race. Across this line:
   same ride, longer wait." Under a photo finish it reads "Photo finish.
   Across this line: same ride, longer wait." Every count beside it is read from summary.json,
   never typed into the code. The count covers this line's 20 corner pairs
   only: never write "citywide".
7. Every number is one tap from its source: what it is, the year, the page or
   feed, a link.
8. Walk times are estimates and carry the word "estimate".
9. The inferred corner, Brevard & Preston, is drawn dashed and tagged
   "inferred". It is never the default pair.
10. The vehicle matches the era of the numbers beside it. 1938: a trackless
    trolley with two poles, two overhead wires, tyres and no rails. Today: a bus.
11. No AI model and no network model runs in the deployed app. Kiro hooks,
    agents and MCP tools run only in the editor.

## Scope

In: race screen, time slider, corner picker, source sheet, share link (the URL
holds only the two corners), About and credits sheet, 2D map with a no-map
fallback.

In later specs, only after the race works end to end: "Why is it slower?"
template text; one sentence on households without a vehicle; a 1937 HOLC grade
layer.

Out. Do not build or propose: a Kiro Crew app, a tilted or 3D map, three.js, a
kit for other lines, any AI-written text at run time, real-time feeds, trip
planning, transfers.

## When numbers disagree

If a computed value differs from a golden value in a spec, stop and tell
Emmanuel. Never edit a golden value, a facts file or a test to make a check pass.
