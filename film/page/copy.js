// Every on-screen word in the film, in one place (scanned by QA for banned words).
// Numbers are filled from window.FILM; none are typed here.
(function () {
  const F = window.FILM, T = F.today, Y = F.y1938;
  const r = Math.round;
  const clock = (s) => { let h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}` + (x ? `:${String(x).padStart(2, '0')}` : '') + ` ${ap}`; };
  const stopNum = (id) => `stop ${id}`;
  const clockS = (s) => { let h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')} ${ap}`; };
  const roundWhole = (x) => Math.floor(Math.round(x * 1e6) / 1e6 + 0.5);
  if (!/BIDDLE/.test(T.board.name) || !/CAROLINE/.test(T.board.name) || !/CAROLINE/.test(T.alight.name) || !/EASTERN/.test(T.alight.name)) throw new Error('stop names changed: update the stop labels');
  window.COPY = {
    // from the brief
    // shortened (main session, round 2) so it fits one line at 28 px; the brief's full wording is in notes.md
    caption: 'Scheduled times: 1938 timetable; MTA weekday schedule, Nov 4, 2026. Positions interpolated. Present-day buildings. Vehicles illustrative. Walks estimated.',
    promo: 'For promotional purposes only',
    badge: '×120 · 1 s = 2 min',
    scheduled: '· scheduled',
    name1938: '1938', nameToday: 'Today',
    sub1938: 'No. 21 trackless trolley',
    subToday: `${T.route} bus`,
    // the wait shot faces north with Preston & Caroline in frame, so "past this corner" is literally on screen
    tally: '1938 trolleys scheduled past this corner while you wait',
    rider1938: '1938 rider · boards at the corner',
    riderToday: "Today's rider",
    waitTrolley: `Waiting for the ${clock(Y.dep)} trolley (scheduled)`,
    waitBus: `Waiting for the ${clock(T.dep)} bus (scheduled)`,
    ghostFirst: "1938 rider's trolley (scheduled)",
    ghostOther: 'Another 1938 trolley (scheduled)',
    roundedNote: '(rounded, as in the app)',
    // v3 holds: the scheduled clock stops while a rider boards or gets off
    pauseBoard: 'clock paused · boarding',
    pauseAlight: 'clock paused · getting off',
    stateBoarding: 'BOARDING',
    stateAlighting: 'GETTING OFF',
    rider1938Short: '1938 rider',
    waiting: 'WAITING',
    arrived: (w) => `ARRIVED · ${w}`,
    // NEW COPY (listed in notes.md)
    wire: 'Gold lines: 1938 overhead wires, illustration',
    rulesA: `Both riders leave ${F.names.origin} at ${clock(F.start)}`,
    rulesB: "The 1938 car is listed at this corner. Today's bus stops are a short walk away. Walks are estimates.",
    tripTime: 'TRIP TIME',
    walking: 'WALKING',
    onBus: 'ON THE BUS',
    riding: 'RIDING',
    busLeaves: `${clockS(T.dep)} · bus leaves ${stopNum(T.board.stop_id)}`,
    busArrives: `${clockS(T.arr)} · bus reaches ${stopNum(T.alight.stop_id)}`,
    // walk metres rounded as the app's walk line rounds them (web/src/format/rounding.ts roundWhole)
    // no metres: the drawn street route is longer than the app's straight-line estimate figure
    walk1: `Walking to stop ${T.board.stop_id} (estimate)`,
    walk2: `Walking to ${F.names.dest} (estimate)`,
    labelOrigin: F.names.origin,
    labelDest: F.names.dest,
    labelBoard: `Stop ${T.board.stop_id} · Biddle St & Caroline`,      // GTFS: BIDDLE ST & CAROLINE AVE eb
    labelAlight: `Stop ${T.alight.stop_id} · Caroline St & Eastern Ave`, // GTFS: CAROLINE ST & EASTERN AVE fs sb
    cardHead: `${r(Y.total_min)} min vs ${r(T.total_min)} min.`,
    cardSub: "Four trolleys were scheduled past this corner before today's bus left.",
    cardFoot: `Scheduled trip from ${F.names.origin} to ${F.names.dest}, leaving at ${clock(F.start)}. Bars to scale.`,
    seg: { wait: 'wait', ride: 'ride', walk: 'walk' },
    total: (m) => `${m} min`,
  };
})();

