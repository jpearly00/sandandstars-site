/* ============================================================================
   SST TRIP ENGINE — sandandstars.com shared trip builder
   One self-contained IIFE. No external dependencies, no CDNs.
   Ported from legacy Browse V2 (index_legacy_260414.html):
     itinerary cart, rover bar (Land Cruiser + Z-path stops), time-conflict &
     content-overlap guards, barbell connector, arches 9-variant set,
     per-duration guide text, SST tiered pricing, guest steppers, date modal.
   New in this build: live availability client (GAS backend), localStorage
   cart ('sst_trip_v1'), multi-tour checkout POST (public_book_multi),
   chat widget (WhatsApp / optional Telegram / message form).
   ========================================================================== */
(function () {
  'use strict';
  if (window.SSTTrip) return; // double-include guard

  /* ------------------------------------------------------------------ */
  /* CONFIG                                                             */
  /* ------------------------------------------------------------------ */
  var EXEC = 'https://script.google.com/macros/s/AKfycbzGwl-OunV1Fvl4hO9c2wjqCkfmnOsRx1i8GrgK14F7T7OrxNpy6Gt5RLNmbZuWgBDxqw/exec';
  var TG_HANDLE = ''; // Telegram handle — leave '' until John supplies one; button renders only when non-empty
  var WA_URL = 'https://wa.me/14356331145?text=Hi%20Sand%20%26%20Stars%20%E2%80%94%20planning%20a%20Moab%20trip';
  var CONTACT_EMAIL = 'tours@sandandstars.com'; // contact.html has no wired GAS action — its form composes a prefilled mailto; chat form reuses that exact pattern
  var LS_KEY = 'sst_trip_v1';
  var LEAD_DAYS = 2;      // bookings open 2 days out
  var WINDOW_DAYS = 180;  // 180-day booking window
  var TEST_MODE = /[?&]ssttest=1/.test(location.search);

  /* ------------------------------------------------------------------ */
  /* PRICING — canon. Estimates are ALWAYS pre-tax.                     */
  /* ------------------------------------------------------------------ */
  var SST_TIERS = { 4: { b12: 575, b34: 675, ex: 100 }, 6: { b12: 850, b34: 975, ex: 125 }, 8: { b12: 1125, b34: 1275, ex: 150 } };
  // n = adults + kids 3 and older (the "Kids <3" stepper does NOT count toward n)
  function priceFor(len, n) {
    var t = SST_TIERS[len] || SST_TIERS[4];
    if (n <= 2) return t.b12;
    if (n <= 4) return t.b34;
    return t.b34 + (n - 4) * t.ex;
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }

  /* ------------------------------------------------------------------ */
  /* TOUR DATA                                                          */
  /* ------------------------------------------------------------------ */
  var LENGTHS = { arches: [4, 6, 8], deadhorse: [4, 6], isky: [6, 8], mill: [4, 6], castle: [4, 6], rockart: [4, 6], localgems: [4, 6], dino: [4], archescombo: [8], needles: [8], maze: [8], night: [4] };
  var REC = { arches: 4, deadhorse: 4, isky: 8, mill: 4, castle: 4, rockart: 4, localgems: 4, dino: 4, archescombo: 8, needles: 8, maze: 8, night: 4 };
  var TITLES = {
    arches: 'Arches National Park',
    deadhorse: 'Best of Moab to Dead Horse Point',
    isky: 'Canyonlands National Park. Island in the Sky District + Dead Horse Point State Park',
    mill: 'Lush Canyon Hike + Local Gems',
    castle: 'Castle Valley',
    rockart: 'Rock Art',
    dino: 'Dino Tracks & Bones',
    localgems: 'Local Gems',
    archescombo: 'Arches + Best of Moab Custom Combo',
    needles: 'Canyonlands Needles District Full Day Tour',
    maze: 'Canyonlands Maze Full Day Tour',
    night: 'Nighthike'
  };
  var LEN_NAMES = { 4: 'Half Day Tour', 6: 'Extended Half Day Tour', 8: 'Full Day Tour' };
  var LEN_GROUP_LABELS = { 4: 'Half Day Tour (~4 hrs)', 6: 'Extended Half Day Tour (~6 hrs)', 8: 'Full Day Tour (~8 hrs)' };
  var DEFAULT_TIMES = { 4: '7:00 AM', 6: '6:30 AM', 8: '6:15 AM' };

  // Per-tour, per-length variant copy — carried over verbatim from the live
  // tours.html TOUR_VARIANTS data (every key, label, and text survives).
  var TOUR_VARIANTS = {
    arches: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'Arches rewards a half day. Four hours covers the classic highlights and a bonus gem or two most visitors miss, with a handful of short stops and two or three focused excursions where it’s worth lingering. It’s our most-booked half-day for a reason. Perfect for a first taste of canyon country.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours adds Devil’s Garden and a longer hike at an easier pace. Extended variants: Devil’s Garden, Custom Combo, Hike Lovers, and Arches + Dead Horse.' },
      8: { label: 'Full Day · 8 hrs', text: 'The big Arches day. Full-day variants: Custom Combo, Arches + Canyonlands, and All You Can Arches.' } } },
    deadhorse: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'A half day that packs in more variety than most full-day tours elsewhere. Ancient rock art, dinosaur tracks, a short arch hike, remote 4x4 dirt roads, secluded overlooks, and Dead Horse Point itself.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours gives more time at each stop and a slower pace through the canyon rim country. Same route, more room to breathe.' } } },
    isky: { def: 8, v: {
      8: { label: 'Recommended: Full Day Tour', text: 'Canyonlands rewards a full day. The drive is a little further from town, and the views are as good as the Grand Canyon or anywhere else. Eight hours gives room for named viewpoints like Mesa Arch and Grand View Point, a picnic lunch at a remote overlook, and spots most visitors miss entirely.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours keeps the pace brisker. Same caliber of views, less wandering time.' } } },
    mill: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'A half day along a creek canyon with cottonwood shade, running water, and waterfalls. The coolest tour in summer. Perfect as a morning or late-afternoon outing.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours to explore the upper canyon and swimming holes at a relaxed pace.' } } },
    castle: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'Desert towers and solitude. Best in golden hour light when the spires glow. A half day is ideal for photography, overlook stops, and the quiet of Fisher Towers and Professor Valley country.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours slows the pace further and gives time for a hike among the towers.' } } },
    rockart: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'A quiet, reverent half day visiting ancient petroglyph and pictograph panels. Your guide knows the stories behind the symbols.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours adds remote panels that require more driving and short hiking.' } } },
    localgems: { def: 4, v: {
      4: { label: 'Recommended: Half Day Tour', text: 'The spots your guide would take a visiting friend. Hidden overlooks, wildflower meadows, viewpoints with no signs. A half day of local secrets.' },
      6: { label: 'Extended · 6 hrs', text: 'Six hours adds a hidden canyon detour and a more leisurely pace.' } } },
    dino: { def: 4, v: { 4: { label: 'Recommended: Half Day Tour', text: 'Trackways, bone beds, and the stories each fossil tells. A focused half day visiting multiple dig sites and track locations around Moab. Perfect for families and anyone fascinated by deep time.' } } },
    archescombo: { def: 8, v: { 8: { label: 'Full Day Tour', text: 'A big-day combo built for guests who want the full variety in one push. Arches highlights and a hike, a picnic lunch in transition, ancient rock art and dinosaur tracks, remote 4x4 roads, secluded overlooks, and Dead Horse Point. Eight hours, a lot of ground covered, a photo album to prove it.' } } },
    needles: { def: 8, v: { 8: { label: 'Recommended: Full Day', text: 'The Needles District is remote. The drive alone takes time, but what you find is sandstone spires in impossible candy stripes. A full day is the only way to do it justice. Pack your energy.' } } },
    maze: { def: 8, v: { 8: { label: 'Recommended: Full Day', text: 'The least-visited district of Canyonlands. Fewer than a thousand people reach it in a year. Requires a long 4x4 approach and a full day commitment. Petroglyphs, stone walls, and absolute solitude.' } } },
    night: { def: 4, v: { 4: { label: 'Recommended: Nighthike', text: 'On full-moon weeks, the desert lights itself. Walk a familiar trail by moonlight. Cooler, quieter, and transformed. On dark-sky nights, the Milky Way is the main event.' } } }
  };

  // Arches 9-variant set — ported from legacy archesVariants / archesAltData /
  // variantInfoData. desc = card copy; info = "(More Info)" long distinction.
  var ARCHES_VARIANTS = {
    highlights4: { name: 'Highlights | Half Day Tour', hours: 4, time: '7:00 AM', tag: 'Recommended', tagClass: 'rec',
      desc: 'Classic highlights plus a bonus gem or two. Handful of diverse short stops, 2–3 focused excursions. Well loved and perfect for most!',
      info: 'The classic Arches experience. Best for first-time visitors and groups who want a thorough but relaxed overview of the park. You will see the major formations, pull off at a handful of lesser-known gems, and take 2–3 short focused walks into areas most people drive past. This is what we recommend to 90% of guests — it covers the essentials without exhaustion and leaves time for the rest of your day in Moab.' },
    delicate4: { name: 'Delicate Arch | Half Day Tour', hours: 4, time: '5:30 AM', tag: '[SUNRISE/NIGHT ONLY]', tagClass: 'note',
      desc: 'Sunrise or night hike to Delicate Arch. Early pickup before dawn, or magical moonlit night option. Near-total solitude.',
      info: 'A dedicated hike to Utah’s most iconic arch — not a windshield tour. Available as a sunrise hike (early predawn pickup, arrive at the arch as the sun hits) or a moonlit night hike on full-moon weeks. You will have near-total solitude either way. This is a 3-mile round-trip moderate hike with 480 ft elevation gain. Not combined with other stops — the whole morning is about this one experience. November–December exception: available midday when temperatures are cool enough.' },
    devils6: { name: 'Devil’s Garden | Extended Half Day Tour', hours: 6, time: '6:30 AM', tag: '7+ mi loop', tagClass: '',
      desc: '7+ mile primitive loop — rock fins, canyon twists, multiple arches. Landscape Arch highlight. Uneven terrain.',
      info: 'The hiker’s Arches tour. A 7+ mile primitive loop through the full Devil’s Garden trail — rock fins, narrow canyons, and multiple arches including Landscape Arch (longest in North America). Terrain is uneven and requires moderate fitness. This is for guests who want to USE their legs, not just look out the window. You will still hit a few classic viewpoints on the drive in and out.' },
    combo6: { name: 'Custom Combo | Extended Half Day Tour', hours: 6, time: '6:30 AM', tag: 'Arches + Rock Art or Dino', tagClass: '',
      desc: 'Abbreviated highlights + Dino Tracks & Bones or Native American Rock Art after Arches.',
      info: 'Half Arches highlights + half local gems. You get an abbreviated version of the classic highlights, then leave the park to explore either Dino Tracks & Bones or Native American Rock Art sites (your choice, decided day-of). Best for guests who want VARIETY — two very different experiences in one outing rather than a deep Arches immersion.' },
    hike6: { name: 'Hike Lovers | Extended Half Day Tour', hours: 6, time: '6:30 AM', tag: '2–3 hikes + highlights', tagClass: '',
      desc: 'Two to three 1–3 mile hikes WITH highlights. Stretch your legs deeper into the landscape. Moderate fitness.',
      info: 'For groups that came to Moab to HIKE. Two to three 1–3 mile hikes woven into the highlights route. You still see the major formations but spend significantly more time on foot in the landscape. Moderate fitness recommended. Different from Devil’s Garden in that you get multiple shorter hikes at different locations rather than one long loop.' },
    deadhorse6: { name: 'Arches + Dead Horse | Extended Half Day Tour', hours: 6, time: '6:30 AM', tag: 'Arches + Dead Horse Point', tagClass: '',
      desc: 'Abbreviated Arches highlights followed by Dead Horse Point State Park — a short walk to one of the most photographed overlooks in the American West. A two-park sampler.',
      info: 'A two-park sampler. Abbreviated Arches highlights followed by a half-hour finale at Dead Horse Point State Park — a short walk to one of the most photographed overlooks in the American West. Dead Horse Point is geographically adjacent to Canyonlands Island in the Sky and very representative of the same geology, but closer and easier to appreciate fully. Great for guests who want a taste of two parks without committing to a full day.' },
    combo8: { name: 'Custom Combo | Full Day Tour', hours: 8, time: '6:15 AM', tag: 'Arches + Best of Moab', tagClass: '',
      desc: 'The 6 hr approach PLUS Dino/Rock Art after Arches. Includes picnic lunch in a scenic transition spot.',
      info: 'The most complete single-day Moab experience. Full Arches highlights plus Dino Tracks/Rock Art after the park, with a picnic lunch at a scenic transition spot between. This is the 6-hour combo approach with more time and less rushing. Best for guests who have ONE day and want to maximize it across different types of terrain and history.' },
    mega8: { name: 'All You Can Arches | Full Day Tour', hours: 8, time: '6:15 AM', tag: 'Max energy · rare pick', tagClass: '',
      desc: 'Maximum Arches — highlights, gems, AND 1–3 additional hikes. High energy required. Rare pick.',
      info: 'Maximum Arches — everything the park has to offer in a single day. All highlights, lesser-known gems, AND 1–3 additional hikes beyond the standard route. High energy required throughout. This is a rare pick for guests with serious stamina who want to cover as much of the park as physically possible. Not recommended for families with young children or groups with mixed fitness levels.' },
    canyonlands8: { name: 'Arches + Canyonlands | Full Day Tour', hours: 8, time: '6:15 AM', tag: 'Two parks · scenic driving', tagClass: '',
      desc: 'Both parks in one day. Abbreviated Arches highlights + Mesa Arch, Grand Viewpoint, and roadside photo stops in Canyonlands Island in the Sky. Scenic driving focused, less hiking. For those who must check off both parks.',
      info: 'Both national parks in one day. Abbreviated Arches highlights in the morning, then a scenic drive to Canyonlands Island in the Sky for Mesa Arch, Grand Viewpoint, Upheaval Dome, and a few roadside photo stops. Much more on the scenic driving side — less hiking, more windshield time. Best for guests okay with less physical activity, photo focused, or who simply must check off both parks. Note: Canyonlands is a good bit of a drive for a relatively short experience. If that is a concern, the Dead Horse 6hr option is closer and very representative of the same geology.' }
  };
  var ARCHES_BY_LEN = { 4: ['highlights4', 'delicate4'], 6: ['devils6', 'combo6', 'hike6', 'deadhorse6'], 8: ['combo8', 'mega8', 'canyonlands8'] };

  // Content overlap matrix — ported from legacy as-is (keys unchanged)
  var contentOverlap = {
    archescombo: ['arches', 'deadhorse', 'rockart', 'dino'],
    arches: ['archescombo'],
    deadhorse: ['archescombo'],
    rockart: ['archescombo'],
    dino: ['archescombo']
  };

  /* ------------------------------------------------------------------ */
  /* ICONS — rover stop glyphs + the hand-drawn SST Land Cruiser        */
  /* (ported exactly from legacy; colors mapped to --sst-* vars)        */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    arches: '<svg viewBox="0 0 40 40"><path d="M6,32 Q8,14 20,14 Q32,14 34,32 L30,32 Q30,18 20,18 Q10,18 10,32 Z" fill="#e89866"/></svg>',
    isky: '<svg viewBox="0 0 40 40"><path d="M4,28 L36,28 L36,32 L4,32 Z M7,24 L33,24 L33,28 L7,28 Z M11,20 L29,20 L29,24 L11,24 Z" fill="#e89866"/></svg>',
    castle: '<svg viewBox="0 0 40 40"><path d="M17,32 L17,14 L19,12 L19,9 L21,8 L23,9 L23,12 L25,14 L25,32 Z" fill="#e89866"/></svg>',
    mill: '<svg viewBox="0 0 40 40"><path d="M4,8 L12,8 L14,20 L12,32 L4,32 Z M36,8 L28,8 L26,20 L28,32 L36,32 Z" fill="#e89866" opacity="0.7"/><path d="M14,32 Q18,22 20,22 Q22,22 26,32" stroke="#e89866" stroke-width="2" fill="none"/></svg>',
    deadhorse: '<svg viewBox="0 0 40 40"><path d="M2,14 L14,14 L16,18 L24,18 L26,14 L38,14 L38,22 L2,22 Z" fill="#e89866" opacity="0.7"/><path d="M6,30 Q12,26 16,29 Q20,32 20,27 Q20,22 24,25 Q28,28 34,24" stroke="#e89866" stroke-width="2" fill="none"/></svg>',
    rockart: '<svg viewBox="0 0 40 40"><circle cx="14" cy="16" r="2" fill="#e89866"/><rect x="13" y="18" width="2" height="8" fill="#e89866"/><rect x="10" y="20" width="8" height="1.5" fill="#e89866"/><path d="M22,24 Q26,20 30,24 Q32,28 28,28 Q24,28 26,24" stroke="#e89866" stroke-width="1.5" fill="none"/></svg>',
    needles: '<svg viewBox="0 0 40 40"><path d="M6,32 L9,16 L12,32 M14,32 L17,12 L20,32 M22,32 L25,14 L28,32 M30,32 L33,18 L36,32" stroke="#e89866" stroke-width="2" fill="#e89866"/></svg>',
    maze: '<svg viewBox="0 0 40 40"><circle cx="13" cy="14" r="2" fill="#e89866"/><rect x="12" y="16" width="2" height="8" fill="#e89866"/><rect x="9" y="18" width="8" height="1.5" fill="#e89866"/><rect x="24" y="17" width="8" height="2" rx="1" fill="#e89866"/><rect x="25" y="20" width="2" height="6" fill="#e89866"/><rect x="29" y="20" width="2" height="6" fill="#e89866"/></svg>',
    night: '<svg viewBox="0 0 40 40"><circle cx="20" cy="14" r="7" fill="#eef2f4"/><circle cx="22" cy="12" r="7" fill="#0f1a22"/><path d="M2,28 L10,26 L18,30 L26,25 L34,28 L38,26 L38,34 L2,34 Z" fill="#e89866"/></svg>',
    dino: '<svg viewBox="0 0 40 40"><g fill="#e89866"><path d="M20,6 Q14,14 13,24 Q13,30 18,31 Q22,32 22,26 Q22,16 20,6 Z"/><path d="M20,6 Q26,14 27,24 Q27,30 22,31 Q20,32 20,26 Q20,16 20,6 Z"/><path d="M12,8 Q9,12 14,16 Z"/><path d="M28,8 Q31,12 26,16 Z"/><path d="M20,4 Q17,8 23,8 Z"/></g></svg>',
    localgems: '<svg viewBox="0 0 40 40"><path d="M2,28 L16,28 L18,24 L38,24 L38,32 L2,32 Z" fill="#0f1a22"/><g transform="translate(20,20)"><rect x="-7" y="-2" width="14" height="5" fill="#e89866"/><rect x="-5" y="-6" width="10" height="4" fill="#e89866"/><circle cx="-4" cy="4" r="1.5" fill="#0f1a22"/><circle cx="4" cy="4" r="1.5" fill="#0f1a22"/><rect x="-6" y="-7" width="12" height="1" fill="#e89866"/></g></svg>',
    archescombo: '<svg viewBox="0 0 40 40"><path d="M3,32 Q5,18 14,18 Q23,18 25,32 L22,32 Q22,22 14,22 Q6,22 6,32 Z" fill="#e89866"/><path d="M22,32 L22,24 L24,22 L26,20 L28,22 L30,24 L30,32 Z" fill="#e89866" opacity="0.7"/><circle cx="33" cy="14" r="2" fill="#e89866" opacity="0.6"/><rect x="32" y="16" width="2" height="6" fill="#e89866" opacity="0.6"/></svg>'
  };

  // SST Land Cruiser — hand-drawn legacy SVG, ported exactly (spare tire,
  // roof rack, dune S-curves, 4-point star sparkles), flipped to face right.
  var CRUISER_SVG =
    '<svg viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)">' +
    '<g stroke="var(--sst-paper)" stroke-width="1.4">' +
    '<path d="M8,24 L8,21 L10,21 L10,15.5 L14,11 L36,11 L38,11 L38,21 L40,21 L40,24"/>' +
    '<line x1="8" y1="21" x2="10" y2="21"/>' +
    '<line x1="14" y1="11" x2="10" y2="15.5"/>' +
    '<line x1="38" y1="11" x2="38" y2="21"/>' +
    '<line x1="38" y1="21" x2="40" y2="21"/>' +
    '<line x1="8" y1="24" x2="13" y2="24"/>' +
    '<line x1="22" y1="24" x2="28" y2="24"/>' +
    '<line x1="37" y1="24" x2="40" y2="24"/>' +
    '</g>' +
    '<g stroke="var(--sst-paper)" stroke-width="1" fill="none">' +
    '<path d="M12,13.5 L14.5,11.5 L23,11.5 L23,17 L12,17 Z"/>' +
    '<rect x="24.5" y="11.5" width="11" height="5.5" rx="0.5"/>' +
    '</g>' +
    '<circle cx="38" cy="17.5" r="3" stroke="var(--sst-paper)" stroke-width="1.2" fill="none"/>' +
    '<circle cx="38" cy="17.5" r="1.2" stroke="var(--sst-paper)" stroke-width="0.7" fill="none"/>' +
    '<circle cx="17" cy="25" r="4" fill="var(--sst-paper)" stroke="var(--sst-paper)" stroke-width="0.8"/>' +
    '<circle cx="17" cy="25" r="2.4" fill="var(--sst-canyon)" stroke="none"/>' +
    '<circle cx="17" cy="25" r="0.8" fill="var(--sst-paper)" stroke="none"/>' +
    '<circle cx="34" cy="25" r="4" fill="var(--sst-paper)" stroke="var(--sst-paper)" stroke-width="0.8"/>' +
    '<circle cx="34" cy="25" r="2.4" fill="var(--sst-canyon)" stroke="none"/>' +
    '<circle cx="34" cy="25" r="0.8" fill="var(--sst-paper)" stroke="none"/>' +
    '<g stroke="var(--sst-paper)" stroke-width="0.8">' +
    '<line x1="16" y1="10" x2="36" y2="10"/>' +
    '<line x1="15.5" y1="9.2" x2="36.5" y2="9.2"/>' +
    '<line x1="19" y1="9.2" x2="19" y2="11"/>' +
    '<line x1="25" y1="9.2" x2="25" y2="11"/>' +
    '<line x1="31" y1="9.2" x2="31" y2="11"/>' +
    '</g>' +
    '<path d="M0,34 Q6,28 14,30 Q22,32 30,28 Q40,24 48,28 Q52,30 56,29" stroke="var(--sst-paper)" stroke-width="0.9" fill="none" opacity="0.45"/>' +
    '<path d="M0,37 Q8,32 18,34 Q28,36 38,31 Q46,28 56,32" stroke="var(--sst-paper)" stroke-width="0.5" fill="none" opacity="0.25"/>' +
    '<g fill="var(--sst-paper)" stroke="none">' +
    '<path d="M5,5 L5.5,3 L6,5 L8,5.5 L6,6 L5.5,8 L5,6 L3,5.5 Z" opacity="0.7"/>' +
    '<path d="M45,3 L45.4,1.5 L45.8,3 L47.3,3.4 L45.8,3.8 L45.4,5.3 L45,3.8 L43.5,3.4 Z" opacity="0.8"/>' +
    '<circle cx="48" cy="8" r="0.6" opacity="0.4"/>' +
    '<circle cx="3" cy="9" r="0.5" opacity="0.35"/>' +
    '</g>' +
    '</svg>';

  /* ------------------------------------------------------------------ */
  /* UTILITIES                                                          */
  /* ------------------------------------------------------------------ */
  var MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoFromDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dateFromIso(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function isoAddDays(iso, n) {
    var d = dateFromIso(iso);
    d.setDate(d.getDate() + n);
    return isoFromDate(d);
  }
  function isoShort(iso) { // '2026-10-15' -> 'Oct 15'
    var d = dateFromIso(iso);
    return d ? MONTHS_S[d.getMonth()] + ' ' + d.getDate() : 'TBD';
  }
  function isoDayName(iso) { var d = dateFromIso(iso); return d ? DAYS_S[d.getDay()] : ''; }
  function todayIso() { return isoFromDate(new Date()); }
  function minIso() { return isoAddDays(todayIso(), LEAD_DAYS); }
  function maxIso() { return isoAddDays(todayIso(), WINDOW_DAYS); }
  function ymOf(iso) { return iso.slice(0, 7); }

  function parseTime12(s) { // '6:15 AM' -> minutes from midnight (legacy port)
    if (!s) return 0;
    var m = String(s).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  function to12h(t) { // accepts '20:45' or already-12h strings
    if (!t) return '';
    if (/AM|PM/i.test(t)) return t;
    var p = String(t).split(':');
    var h = parseInt(p[0], 10), m = parseInt(p[1] || '0', 10);
    if (isNaN(h)) return t;
    var ap = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return h + ':' + pad2(m) + ' ' + ap;
  }

  /* ------------------------------------------------------------------ */
  /* AVAILABILITY CLIENT — per-month cache over the live GAS backend    */
  /* ------------------------------------------------------------------ */
  var monthCache = {}; // 'YYYY-MM' -> Promise<{iso:dayObj}>
  function fetchMonth(ym) {
    if (monthCache[ym]) return monthCache[ym];
    monthCache[ym] = fetch(EXEC + '?action=availability&month=' + ym)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var map = {};
        ((j && j.dates) || []).forEach(function (d) { if (d && d.date) map[d.date] = d; });
        return map;
      })
      .catch(function () { delete monthCache[ym]; return {}; });
    return monthCache[ym];
  }
  function dayOpen(day, tourKey) {
    if (!day) return false;
    if (day.status !== 'available' && day.status !== 'limited') return false;
    if (tourKey === 'night') return !!(day.nightHike && day.nightHike.eligible);
    return true;
  }
  function isoInWindow(iso) { return iso >= minIso() && iso <= maxIso(); }
  // Async: is this exact date open for this tour?
  function checkDateOpen(iso, tourKey) {
    if (!isoInWindow(iso)) return Promise.resolve(false);
    return fetchMonth(ymOf(iso)).then(function (map) { return dayOpen(map[iso], tourKey); });
  }
  // Async: walk from `fromIso` (inclusive) in direction dir (+1/-1) to the
  // next open date within the booking window. Resolves iso or null.
  function findOpenDate(fromIso, dir, tourKey) {
    var lo = minIso(), hi = maxIso();
    function step(iso) {
      if (iso < lo || iso > hi) return Promise.resolve(null);
      return fetchMonth(ymOf(iso)).then(function (map) {
        var cur = iso;
        while (cur >= lo && cur <= hi && ymOf(cur) === ymOf(iso)) {
          if (dayOpen(map[cur], tourKey)) return cur;
          cur = isoAddDays(cur, dir);
        }
        if (cur < lo || cur > hi) return null;
        return step(cur); // crossed into next month
      });
    }
    return step(fromIso);
  }
  function nightStartFor(iso) {
    var ym = ymOf(iso);
    if (!monthCache[ym]) return null; // only from warm cache (callers prefetch)
    var d = cachedDay(iso);
    return d && d.nightHike && d.nightHike.start ? to12h(d.nightHike.start) : null;
  }
  var monthData = {}; // resolved copies for sync reads
  function warmMonth(ym) { return fetchMonth(ym).then(function (m) { monthData[ym] = m; return m; }); }
  function cachedDay(iso) { var m = monthData[ymOf(iso)]; return m ? m[iso] : null; }

  /* ------------------------------------------------------------------ */
  /* CART STATE (localStorage: sst_trip_v1)                             */
  /* ------------------------------------------------------------------ */
  var itinerary = []; // [{tour,variant,name,len,date(iso),time,adults,kids}]
  var roverSlots = []; // [{type:'tour',item}|{type:'placeholder',date}]

  function itemPrice(it) { return priceFor(it.len, it.adults); } // pre-tax, adults = pricing n
  function cartTotal() { return itinerary.reduce(function (s, it) { return s + itemPrice(it); }, 0); }

  function saveCart() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, items: itinerary })); } catch (e) { /* private mode */ }
  }
  function loadCart() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      (data && data.items || []).forEach(function (it) {
        if (it && it.tour && LENGTHS[it.tour] && it.len && it.date) itinerary.push(it);
      });
    } catch (e) { /* ignore corrupt cart */ }
  }

  function displayName(key, variant) {
    if (key === 'arches' && variant && ARCHES_VARIANTS[variant]) return 'Arches National Park · ' + ARCHES_VARIANTS[variant].name;
    if (key === 'night') return 'Nighthike · Moonlight Walk';
    return TITLES[key] || key;
  }
  function timeFor(key, variant, len, dateIso) {
    if (key === 'night') return (dateIso && nightStartFor(dateIso)) || '8:30 PM';
    if (key === 'arches' && variant && ARCHES_VARIANTS[variant]) return ARCHES_VARIANTS[variant].time;
    return DEFAULT_TIMES[len] || '7:00 AM';
  }

  /* Guards — ported from legacy */
  function checkTimeConflict(dateIso, time, duration, excludeItem) {
    var newStart = parseTime12(time);
    var newEnd = newStart + (duration || 4) * 60;
    for (var i = 0; i < itinerary.length; i++) {
      var t = itinerary[i];
      if (t === excludeItem) continue;
      if (t.date !== dateIso) continue;
      var tStart = parseTime12(t.time);
      var tEnd = tStart + (t.len || 4) * 60;
      if (newStart < tEnd && newEnd > tStart) return t;
    }
    return null;
  }
  function checkContentOverlap(tourKey) {
    var overlaps = contentOverlap[tourKey];
    if (!overlaps) return null;
    for (var i = 0; i < itinerary.length; i++) {
      if (overlaps.indexOf(itinerary[i].tour) > -1) return itinerary[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* TOAST                                                              */
  /* ------------------------------------------------------------------ */
  var toastEl = null, toastTimer = null;
  function showToast(msg, type) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'sst-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'sst-toast' + (type === 'warn' ? ' warn' : '') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3500);
  }

  /* ------------------------------------------------------------------ */
  /* ROVER — sticky itinerary bar (slot system ported from legacy)      */
  /* ------------------------------------------------------------------ */
  var roverEl = null, pathEl = null, emptyEl = null, ctaEl = null;
  var roverAlways = false;

  function ensureRover() {
    if (roverEl) return;
    roverAlways = document.body.hasAttribute('data-sst-rover') && document.body.getAttribute('data-sst-rover') === 'always';
    roverEl = document.createElement('aside');
    roverEl.className = 'sst-rover';
    roverEl.id = 'sstRover';
    roverEl.setAttribute('aria-label', 'Your itinerary');
    roverEl.innerHTML =
      '<div class="sst-rh-stack">' +
      '<div class="sst-rh">Your Itinerary</div>' +
      '<button type="button" class="sst-edit-btn" data-sst-act="checkout">Edit</button>' +
      '<button type="button" class="sst-edit-btn sst-copy-itin" data-sst-act="share">Share Trip</button>' +
      '</div>' +
      '<div class="sst-journey" id="sstPath">' +
      '<div class="sst-path-start" title="Start">' + CRUISER_SVG + '</div>' +
      '<div class="sst-empty" id="sstEmptyMsg">Add tours to build your itinerary →</div>' +
      '</div>' +
      '<div class="sst-rover-cta" id="sstRoverCta"><button type="button" class="sst-book-btn" data-sst-act="checkout">Book</button></div>';
    var nav = document.querySelector('header.nav');
    if (nav && nav.parentElement) nav.parentElement.insertBefore(roverEl, nav.nextSibling);
    else document.body.insertBefore(roverEl, document.body.firstChild);
    pathEl = roverEl.querySelector('#sstPath');
    emptyEl = roverEl.querySelector('#sstEmptyMsg');
    ctaEl = roverEl.querySelector('#sstRoverCta');
    roverEl.addEventListener('click', function (e) {
      var act = e.target.closest('[data-sst-act]');
      if (act) {
        var a = act.getAttribute('data-sst-act');
        if (a === 'checkout') openCheckout();
        if (a === 'share') copyDraftItin(act);
      }
    });
    syncNavOffset();
    window.addEventListener('resize', syncNavOffset);
  }
  function syncNavOffset() {
    var nav = document.querySelector('header.nav');
    var h = nav ? nav.offsetHeight : 0;
    document.documentElement.style.setProperty('--sst-nav-h', h + 'px');
    var bottomMode = window.matchMedia('(max-width:960px)').matches;
    if (roverEl) roverEl.classList.toggle('sst-rover-bottom', bottomMode);
    document.body.classList.toggle('sst-has-rover-bottom', bottomMode && roverVisible());
  }
  function roverVisible() { return roverAlways || itinerary.length > 0 || roverSlots.length > 0; }

  function rebuildSlots() {
    // keep placeholders, rebuild tour slots from itinerary, chronological
    var placeholders = roverSlots.filter(function (s) { return s.type === 'placeholder'; });
    roverSlots.length = 0;
    var items = itinerary.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : parseTime12(a.time) - parseTime12(b.time); });
    items.forEach(function (it) { roverSlots.push({ type: 'tour', item: it }); });
    placeholders.forEach(function (ph) {
      // drop placeholder if a tour now occupies its date
      if (itinerary.some(function (it) { return it.date === ph.date; })) return;
      var at = roverSlots.length;
      for (var i = 0; i < roverSlots.length; i++) {
        var d = roverSlots[i].type === 'tour' ? roverSlots[i].item.date : roverSlots[i].date;
        if (ph.date < d) { at = i; break; }
      }
      roverSlots.splice(at, 0, ph);
    });
  }

  function renderRover() {
    ensureRover();
    pathEl.querySelectorAll('.sst-stop,.sst-connector,.sst-day-add').forEach(function (el) { el.remove(); });
    roverEl.hidden = !roverVisible();
    syncNavOffset();
    if (roverSlots.length === 0) {
      emptyEl.style.display = 'block';
      ctaEl.classList.remove('show');
      return;
    }
    emptyEl.style.display = 'none';

    var frag = document.createDocumentFragment();
    var addL = document.createElement('button');
    addL.type = 'button';
    addL.className = 'sst-day-add';
    addL.textContent = '+';
    addL.title = 'Add a day before';
    addL.setAttribute('data-sst-day', 'before');
    frag.appendChild(addL);

    roverSlots.forEach(function (slot, i) {
      frag.appendChild(makeConnector(i));
      var stop = document.createElement('div');
      stop.className = 'sst-stop ' + (i % 2 === 0 ? 'up' : 'down') + (slot.type === 'placeholder' ? ' placeholder' : '');
      stop.setAttribute('data-slot', i);
      if (slot.type === 'tour') {
        var t = slot.item;
        var hrs = t.len ? t.len + ' Hrs' : '';
        stop.innerHTML =
          '<button type="button" class="sst-stop-edit" data-stop-edit="' + i + '" title="Edit">✎</button>' +
          '<button type="button" class="sst-stop-remove" data-stop-remove="' + i + '" title="Remove">×</button>' +
          '<div class="sst-stop-icon-wrap" data-stop-pop="' + i + '"><div class="sst-stop-icon">' + (ICONS[t.tour] || '') + '</div></div>' +
          '<div class="sst-stop-meta"><span class="d">' + esc(isoShort(t.date)) + '</span><span>' + esc(t.time) + '</span><span>' + esc(hrs) + '</span></div>' +
          '<div class="sst-rover-popover" id="sstPop' + i + '">' +
          '<div class="rp-name">' + esc(t.name) + '</div>' +
          '<div class="rp-meta">' + t.adults + ' adult' + (t.adults === 1 ? '' : 's') + (t.kids ? ' · ' + t.kids + ' kids' : '') + ' · ' + esc(isoShort(t.date)) + ' · ' + esc(t.time) + ' · ' + esc(hrs) + '</div>' +
          '<div class="rp-actions">' +
          '<button type="button" class="rp-btn" data-stop-edit="' + i + '">Edit</button>' +
          '<button type="button" class="rp-btn danger" data-stop-remove="' + i + '">Remove</button>' +
          '</div></div>';
      } else {
        stop.innerHTML =
          '<button type="button" class="sst-stop-remove" data-ph-remove="' + i + '" title="Remove">×</button>' +
          '<div class="sst-stop-icon-wrap"><div class="sst-stop-icon"><div class="sst-ph-label"><span>LEFT</span><span>OPEN</span></div></div></div>' +
          '<div class="sst-stop-meta"><span class="d">' + esc(isoShort(slot.date)) + '</span><span>' + esc(isoDayName(slot.date)) + '</span></div>';
      }
      frag.appendChild(stop);
    });

    frag.appendChild(makeConnector(roverSlots.length));
    var addR = document.createElement('button');
    addR.type = 'button';
    addR.className = 'sst-day-add';
    addR.textContent = '+';
    addR.title = 'Add a day after';
    addR.setAttribute('data-sst-day', 'after');
    frag.appendChild(addR);

    pathEl.appendChild(frag);
    ctaEl.classList.add('show');
  }

  // Straight dashed diagonal connectors between alternating up/down stops (legacy port)
  function makeConnector(i) {
    var c = document.createElement('div');
    c.className = 'sst-connector';
    var stopY = function (idx) { return idx % 2 === 0 ? 58 : 42; };
    var prevY = i === 0 ? 50 : stopY(i - 1);
    var currY = stopY(i);
    c.innerHTML = '<svg viewBox="0 0 50 100" preserveAspectRatio="none"><line x1="0" y1="' + prevY + '" x2="50" y2="' + currY + '" stroke="#e89866" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round"/></svg>';
    return c;
  }

  function removeTourToPlaceholder(slotIdx) {
    var slot = roverSlots[slotIdx];
    if (!slot || slot.type !== 'tour') return;
    var t = slot.item;
    var ii = itinerary.indexOf(t);
    if (ii > -1) itinerary.splice(ii, 1);
    var existingPH = roverSlots.some(function (s, idx) { return idx !== slotIdx && s.type === 'placeholder' && s.date === t.date; });
    if (existingPH) roverSlots.splice(slotIdx, 1);
    else roverSlots[slotIdx] = { type: 'placeholder', date: t.date };
    syncCardAddedStates();
    renderRover();
    saveCart();
    renderCheckoutIfOpen();
    showToast('Removed ' + t.name + ' · dates unchanged');
  }
  function removePlaceholder(slotIdx) {
    roverSlots.splice(slotIdx, 1);
    renderRover();
  }
  function addDayPlaceholder(position) {
    var refDate = null, i, d;
    if (position === 'before') {
      for (i = 0; i < roverSlots.length; i++) {
        d = roverSlots[i].type === 'tour' ? roverSlots[i].item.date : roverSlots[i].date;
        if (d) { refDate = d; break; }
      }
      if (refDate) roverSlots.unshift({ type: 'placeholder', date: isoAddDays(refDate, -1) });
    } else {
      for (i = roverSlots.length - 1; i >= 0; i--) {
        d = roverSlots[i].type === 'tour' ? roverSlots[i].item.date : roverSlots[i].date;
        if (d) { refDate = d; break; }
      }
      if (refDate) roverSlots.push({ type: 'placeholder', date: isoAddDays(refDate, 1) });
    }
    renderRover();
  }
  function closeAllPopovers() {
    document.querySelectorAll('.sst-rover-popover.open').forEach(function (p) { p.classList.remove('open'); });
  }

  function copyDraftItin(btn) {
    if (!itinerary.length) { showToast('No tours added yet.', 'warn'); return; }
    var lines = ['Your Sand & Stars Draft Itinerary', ''];
    var sorted = itinerary.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    sorted.forEach(function (t, i) {
      var hrs = t.len ? t.len + ' hours' : '';
      lines.push((i + 1) + '. ' + isoShort(t.date));
      lines.push('   ' + t.name);
      lines.push('   Depart ' + t.time + (hrs ? ' · ' + hrs : ''));
      lines.push('');
    });
    lines.push('— Draft only. Dates & times finalized on booking. —');
    lines.push('');
    lines.push('Build yours: https://sandandstars.com/tours.html');
    var txt = lines.join('\n');
    function done() {
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = 'Copied ✓';
        setTimeout(function () { btn.textContent = orig; }, 1800);
      }
      showToast('Draft itinerary copied — paste it anywhere');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    } else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* no-op */ }
    ta.remove();
  }

  /* ------------------------------------------------------------------ */
  /* ADD / REMOVE TOURS                                                 */
  /* ------------------------------------------------------------------ */
  function findInCart(tourKey) {
    for (var i = 0; i < itinerary.length; i++) if (itinerary[i].tour === tourKey) return itinerary[i];
    return null;
  }
  function addItem(spec) { // {tour,variant,len,date,adults,kids}
    var existing = findInCart(spec.tour);
    if (existing) { removeByKey(spec.tour); return false; } // toggle off (legacy behavior)
    var overlap = checkContentOverlap(spec.tour);
    if (overlap) {
      showToast('Content overlap — ' + overlap.name + ' already covers similar content. Remove it first or choose a different tour.', 'warn');
      return false;
    }
    if (!spec.date) { showToast('Pick a date first — checking live availability…', 'warn'); return false; }
    var time = timeFor(spec.tour, spec.variant, spec.len, spec.date);
    var conflict = checkTimeConflict(spec.date, time, spec.len, null);
    if (conflict) {
      showToast('Time conflict — ' + conflict.name + ' is already at ' + conflict.time + ' on ' + isoShort(spec.date), 'warn');
      return false;
    }
    var item = {
      tour: spec.tour,
      variant: spec.variant || null,
      name: displayName(spec.tour, spec.variant),
      len: spec.len,
      date: spec.date,
      time: time,
      adults: spec.adults || 2,
      kids: spec.kids || 0
    };
    itinerary.push(item);
    // fill an open placeholder on this date, else chronological insert
    var phIdx = -1;
    for (var i = 0; i < roverSlots.length; i++) {
      if (roverSlots[i].type === 'placeholder' && roverSlots[i].date === item.date) { phIdx = i; break; }
    }
    if (phIdx > -1) roverSlots[phIdx] = { type: 'tour', item: item };
    else rebuildSlots();
    renderRover();
    saveCart();
    syncCardAddedStates();
    renderCheckoutIfOpen();
    showToast(item.name + ' added to your trip');
    return true;
  }
  function removeByKey(tourKey) {
    for (var i = 0; i < roverSlots.length; i++) {
      if (roverSlots[i].type === 'tour' && roverSlots[i].item.tour === tourKey) { removeTourToPlaceholder(i); return; }
    }
    var it = findInCart(tourKey);
    if (it) {
      itinerary.splice(itinerary.indexOf(it), 1);
      rebuildSlots();
      renderRover();
      saveCart();
      syncCardAddedStates();
      renderCheckoutIfOpen();
      showToast('Removed from trip');
    }
  }

  /* ------------------------------------------------------------------ */
  /* CHECKOUT MODAL                                                     */
  /* ------------------------------------------------------------------ */
  var coModal = null;
  function ensureCheckout() {
    if (coModal) return;
    coModal = document.createElement('div');
    coModal.className = 'sst-modal';
    coModal.id = 'sstCheckout';
    coModal.innerHTML =
      '<div class="sst-modal-inner sst-co-inner" role="dialog" aria-modal="true" aria-label="Your itinerary">' +
      '<button type="button" class="sst-x" aria-label="Close">×</button>' +
      '<button type="button" class="sst-add-more">← Add More Tours</button>' +
      '<div class="sst-eyebrow">Confirm</div>' +
      '<h2>Your <em style="font-style:italic;color:var(--sst-ember)">itinerary</em>.</h2>' +
      '<div id="sstCoWarn"></div>' +
      '<div id="sstCoList"></div>' +
      '<div class="sst-co-total"><span class="k">Pre-tax Subtotal</span><span class="v" id="sstCoTotal">$0</span></div>' +
      '<div class="sst-co-taxnote">Taxes calculated at checkout.</div>' +
      '<div class="sst-co-details">' +
      '<span class="sst-eyebrow">Your Details</span>' +
      '<div class="sst-form-row">' +
      '<div class="sst-form-group"><label for="sstFn">First Name</label><input id="sstFn" type="text" autocomplete="given-name"></div>' +
      '<div class="sst-form-group"><label for="sstLn">Last Name</label><input id="sstLn" type="text" autocomplete="family-name"></div>' +
      '</div>' +
      '<div class="sst-form-row">' +
      '<div class="sst-form-group"><label for="sstEm">Email</label><input id="sstEm" type="email" autocomplete="email"></div>' +
      '<div class="sst-form-group"><label for="sstPh">Phone</label><input id="sstPh" type="tel" autocomplete="tel"></div>' +
      '</div>' +
      '<div class="sst-form-group"><label for="sstNo">Notes (lodging, occasions, anything useful)</label><textarea id="sstNo" placeholder="Where are you staying? Celebrating anything?"></textarea></div>' +
      '</div>' +
      '<button type="button" class="sst-co-pay" id="sstBookTrip">Book My Trip →</button>' +
      '<p class="sst-disclaimer">Nothing is charged online — we confirm availability and send a secure invoice to lock your dates.</p>' +
      '</div>';
    document.body.appendChild(coModal);
    coModal.addEventListener('click', function (e) {
      if (e.target === coModal) closeCheckout();
      if (e.target.closest('.sst-x') || e.target.closest('.sst-add-more')) closeCheckout();
      var rm = e.target.closest('[data-co-remove]');
      if (rm) {
        var key = rm.getAttribute('data-co-remove');
        removeByKey(key);
      }
    });
    coModal.querySelector('#sstBookTrip').addEventListener('click', submitTrip);
  }
  function openCheckout() {
    ensureCheckout();
    renderCheckout();
    coModal.classList.add('open');
  }
  function closeCheckout() { if (coModal) coModal.classList.remove('open'); }
  function renderCheckoutIfOpen() { if (coModal && coModal.classList.contains('open')) renderCheckout(); }
  function renderCheckout() {
    var list = coModal.querySelector('#sstCoList');
    var warnBox = coModal.querySelector('#sstCoWarn');
    if (!itinerary.length) {
      list.innerHTML = '<div class="sst-co-empty">No tours added yet — close this and tap Quick Add to Trip on any tour.</div>';
      coModal.querySelector('#sstCoTotal').textContent = '$0';
      warnBox.innerHTML = '';
      return;
    }
    var sorted = itinerary.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var html = '';
    sorted.forEach(function (t) {
      var guests = t.adults + ' adult' + (t.adults === 1 ? '' : 's') + (t.kids ? ' + ' + t.kids + ' kids <3' : '');
      html +=
        '<div class="sst-co-line">' +
        '<div class="sst-co-thumb-icon">' + (ICONS[t.tour] || '') + '</div>' +
        '<div class="sst-co-detail">' +
        '<div class="nm">' + esc(t.name) + '</div>' +
        '<div class="mt">' + esc(isoShort(t.date)) + ' · ' + t.len + ' hr · Start ' + esc(t.time) + ' · ' + esc(guests) + '</div>' +
        '</div>' +
        '<div class="sst-co-price">' + money(itemPrice(t)) + '</div>' +
        '<button type="button" class="sst-co-x" data-co-remove="' + esc(t.tour) + '" title="Remove">✕</button>' +
        '</div>';
    });
    list.innerHTML = html;
    coModal.querySelector('#sstCoTotal').textContent = money(cartTotal());
    var warns = itinerary.filter(function (t) { return t._unavailWarning; });
    warnBox.innerHTML = warns.length
      ? '<div class="sst-cart-warning" style="margin:8px 0">⚠️ One or more activities in your cart may no longer be available for the selected date(s). <a href="mailto:' + CONTACT_EMAIL + '">Please contact us</a> and we’ll do our best to make it work.</div>'
      : '';
  }

  // Book My Trip -> form-POST public_book_multi (application/x-www-form-urlencoded,
  // full navigation — same transport as the current book form; no CORS needed).
  function submitTrip() {
    if (!itinerary.length) { showToast('Add at least one tour first', 'warn'); return; }
    var fn = coModal.querySelector('#sstFn').value.trim();
    var ln = coModal.querySelector('#sstLn').value.trim();
    var em = coModal.querySelector('#sstEm').value.trim();
    var ph = coModal.querySelector('#sstPh').value.trim();
    var no = coModal.querySelector('#sstNo').value.trim();
    if (!fn || !ln) { showToast('Please add your first and last name', 'warn'); return; }
    if (!em || em.indexOf('@') < 0 || em.indexOf('.') < 0) { showToast('Please add a valid email address', 'warn'); return; }
    var sorted = itinerary.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var items = sorted.map(function (t) {
      return { tour: t.tour, length: t.len, date: t.date, group_size: t.adults }; // group_size = pricing n (adults + kids 3+); kids <3 noted below
    });
    var kidNotes = sorted.filter(function (t) { return t.kids > 0; }).map(function (t) {
      return t.kids + ' kids under 3 on ' + isoShort(t.date);
    });
    var notes = no + (kidNotes.length ? (no ? '\n' : '') + '[' + kidNotes.join('; ') + ']' : '');
    var fields = {
      action: 'public_book_multi',
      items: JSON.stringify(items),
      first_name: fn,
      last_name: ln,
      email: em,
      phone: ph,
      notes: notes,
      source: 'website'
    };
    if (TEST_MODE) fields.test = '1';
    var btn = coModal.querySelector('#sstBookTrip');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = EXEC;
    form.style.display = 'none';
    Object.keys(fields).forEach(function (k) {
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = k;
      inp.value = fields[k];
      form.appendChild(inp);
    });
    document.body.appendChild(form);
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* keep cart if storage blocked */ }
    form.submit(); // full navigation to the GAS confirmation page
  }

  /* ------------------------------------------------------------------ */
  /* DATE PICKER MODAL (live availability calendar; night = moon dates) */
  /* ------------------------------------------------------------------ */
  var dateModal = null, dmCard = null, dmYear = 0, dmMonth = 0;
  function ensureDateModal() {
    if (dateModal) return;
    dateModal = document.createElement('div');
    dateModal.className = 'sst-modal';
    dateModal.innerHTML =
      '<div class="sst-modal-inner sst-date-inner" role="dialog" aria-modal="true" aria-label="Pick a date">' +
      '<button type="button" class="sst-x" aria-label="Close">×</button>' +
      '<div class="sst-eyebrow">Reserve your Dates</div>' +
      '<h2 id="sstDmTitle" style="font-size:26px">Pick a date</h2>' +
      '<div class="sst-cal-nav">' +
      '<button type="button" id="sstDmPrev" aria-label="Previous month">‹</button>' +
      '<span id="sstDmLabel"></span>' +
      '<button type="button" id="sstDmNext" aria-label="Next month">›</button>' +
      '</div>' +
      '<div class="sst-cal-grid" id="sstDmGrid"></div>' +
      '<div class="sst-cal-legend"><i><span class="sw av"></span>Open</i><i><span class="sw lm"></span>Limited</i><i><span class="sw na"></span>Unavailable</i><i id="sstDmMoonKey" style="display:none"><span class="sw" style="border-color:var(--sst-gold)"></span>Moon window</i></div>' +
      '</div>';
    document.body.appendChild(dateModal);
    dateModal.addEventListener('click', function (e) {
      if (e.target === dateModal || e.target.closest('.sst-x')) dateModal.classList.remove('open');
      var day = e.target.closest('[data-dm-iso]');
      if (day && dmCard) {
        setCardDate(dmCard, day.getAttribute('data-dm-iso'));
        dateModal.classList.remove('open');
      }
    });
    dateModal.querySelector('#sstDmPrev').addEventListener('click', function () { dmNav(-1); });
    dateModal.querySelector('#sstDmNext').addEventListener('click', function () { dmNav(1); });
  }
  function openDateModal(card) {
    ensureDateModal();
    dmCard = card;
    var st = card._sst;
    var base = dateFromIso(st.date || minIso());
    dmYear = base.getFullYear();
    dmMonth = base.getMonth();
    dateModal.querySelector('#sstDmTitle').textContent = TITLES[st.key] || 'Pick a date';
    dateModal.querySelector('#sstDmMoonKey').style.display = st.key === 'night' ? '' : 'none';
    dateModal.classList.add('open');
    renderDm();
  }
  function dmNav(dir) {
    dmMonth += dir;
    if (dmMonth > 11) { dmMonth = 0; dmYear++; }
    if (dmMonth < 0) { dmMonth = 11; dmYear--; }
    renderDm();
  }
  function renderDm() {
    var grid = dateModal.querySelector('#sstDmGrid');
    dateModal.querySelector('#sstDmLabel').textContent = MONTHS_L[dmMonth] + ' ' + dmYear;
    var ym = dmYear + '-' + pad2(dmMonth + 1);
    var lo = minIso(), hi = maxIso();
    dateModal.querySelector('#sstDmPrev').disabled = ym <= ymOf(lo);
    dateModal.querySelector('#sstDmNext').disabled = ym >= ymOf(hi);
    grid.innerHTML = '<div class="sst-cal-loading" style="grid-column:1/-1">Checking live availability…</div>';
    warmMonth(ym).then(function (map) {
      // ignore stale renders
      if (dateModal.querySelector('#sstDmLabel').textContent !== MONTHS_L[dmMonth] + ' ' + dmYear) return;
      var st = dmCard ? dmCard._sst : null;
      var tourKey = st ? st.key : null;
      var html = DAYS_S.map(function (d) { return '<div class="hdr">' + d + '</div>'; }).join('');
      var first = new Date(dmYear, dmMonth, 1);
      var daysIn = new Date(dmYear, dmMonth + 1, 0).getDate();
      var startDay = first.getDay();
      var cells = 42;
      for (var i = 0; i < cells; i++) {
        var dayNum = i - startDay + 1;
        if (dayNum < 1 || dayNum > daysIn) { html += '<div class="day empty"></div>'; continue; }
        var iso = ym + '-' + pad2(dayNum);
        var dObj = map[iso];
        var open = isoInWindow(iso) && dayOpen(dObj, tourKey);
        var cls = 'day';
        var title = '';
        if (!open) cls += ' unavail';
        else {
          if (dObj && dObj.status === 'limited') cls += ' limited';
          if (tourKey === 'night' && dObj && dObj.nightHike && dObj.nightHike.eligible) {
            cls += ' moon';
            if (dObj.nightHike.start) title = 'Suggested start ' + to12h(dObj.nightHike.start);
          }
        }
        if (st && st.date === iso) cls += ' selected';
        html += '<div class="' + cls + '"' + (open ? ' data-dm-iso="' + iso + '"' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + dayNum + '</div>';
      }
      grid.innerHTML = html;
    });
  }

  /* ------------------------------------------------------------------ */
  /* INFO / WHICH-TO-PICK MODAL (shared)                                */
  /* ------------------------------------------------------------------ */
  var infoModal = null;
  function ensureInfoModal() {
    if (infoModal) return;
    infoModal = document.createElement('div');
    infoModal.className = 'sst-modal';
    infoModal.innerHTML =
      '<div class="sst-modal-inner" role="dialog" aria-modal="true">' +
      '<button type="button" class="sst-x" aria-label="Close">×</button>' +
      '<div class="sst-eyebrow" id="sstInfoEye"></div>' +
      '<h2 id="sstInfoTitle" style="font-size:26px;font-style:normal"></h2>' +
      '<div id="sstInfoBody"></div>' +
      '</div>';
    document.body.appendChild(infoModal);
    infoModal.addEventListener('click', function (e) {
      if (e.target === infoModal || e.target.closest('.sst-x')) infoModal.classList.remove('open');
    });
  }
  function openVariantInfo(variantId) {
    var v = ARCHES_VARIANTS[variantId];
    if (!v) return;
    ensureInfoModal();
    infoModal.querySelector('#sstInfoEye').textContent = 'What Makes This Different';
    infoModal.querySelector('#sstInfoTitle').textContent = v.name;
    infoModal.querySelector('#sstInfoBody').innerHTML =
      '<p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:var(--sst-ember);margin-bottom:12px">' + v.hours + ' hours · ' + esc(v.time) + '</p>' +
      '<p>' + esc(v.info) + '</p>';
    infoModal.classList.add('open');
  }
  function openWhichToPick(key) {
    ensureInfoModal();
    infoModal.querySelector('#sstInfoEye').textContent = 'Which to Pick?';
    infoModal.querySelector('#sstInfoTitle').textContent = TITLES[key] || '';
    var html = '';
    if (key === 'arches') {
      [4, 6, 8].forEach(function (L) {
        ARCHES_BY_LEN[L].forEach(function (vid) {
          var v = ARCHES_VARIANTS[vid];
          html += '<div class="sst-wtp-variant"><h4>' + esc(v.name) + '</h4><div class="wtp-dur">' + v.hours + ' hours · ' + esc(v.time) + '</div><p>' + esc(v.info) + '</p></div>';
        });
      });
    } else {
      var cfg = TOUR_VARIANTS[key];
      if (cfg) {
        Object.keys(cfg.v).sort().forEach(function (L) {
          var v = cfg.v[L];
          html += '<div class="sst-wtp-variant"><h4>' + esc(key === 'night' ? 'Moonlight Walk' : LEN_NAMES[L]) + '</h4><div class="wtp-dur">' + L + ' hours · ' + esc(v.label) + '</div><p>' + esc(v.text) + '</p></div>';
        });
      }
    }
    infoModal.querySelector('#sstInfoBody').innerHTML = html;
    infoModal.classList.add('open');
  }

  /* ------------------------------------------------------------------ */
  /* INTERACTIVE CARDS                                                  */
  /* ------------------------------------------------------------------ */
  var cards = [];
  var cardSeq = 0;

  function initCard(root) {
    var key = root.getAttribute('data-sst-card');
    if (!key || !LENGTHS[key]) return;
    var host = root.querySelector('.tour-detail') || root;
    host.classList.add('sst-detail-host');
    var controls = root.querySelector('[data-sst-controls]');
    if (!controls) return;
    var mode = root.getAttribute('data-sst-mode') || 'full'; // 'full' | 'compact' (no variant rows/barbell)
    var st = {
      key: key,
      seq: ++cardSeq,
      len: REC[key],
      variant: key === 'arches' ? 'highlights4' : null,
      date: null,
      adults: 2,
      kids: 0,
      mode: mode,
      root: root,
      host: host,
      controls: controls
    };
    root._sst = st;
    cards.push(root);

    // Remove any static no-JS fallback block (homepage lead keeps its own
    // chevrons + book links for no-JS; engine replaces them with live controls)
    root.querySelectorAll('[data-sst-static]').forEach(function (el) { el.remove(); });

    renderControls(root);
    controls.hidden = false;

    // barbell scaffold lives on the positioned detail host
    if (mode === 'full') {
      var bb = document.createElement('div');
      bb.className = 'sst-barbell';
      bb.innerHTML = '<div class="sst-bb-vert"></div><div class="sst-bb-horiz"></div><div class="sst-bb-horiz-btm"></div>';
      host.appendChild(bb);
      st.barbell = bb;
    }

    bindCard(root);
    updateCard(root);

    // async: land the date on the first open date (2-day lead / 180-day window)
    findOpenDate(minIso(), 1, key).then(function (iso) {
      if (!st.date && iso) setCardDate(root, iso, true);
      else if (!iso) {
        var disp = root.querySelector('.sst-date-display');
        if (disp) disp.textContent = 'Contact us';
      }
    });
  }

  function renderControls(root) {
    var st = root._sst;
    var lengths = LENGTHS[st.key];
    var html = '';
    html += '<div class="sst-dur-row"><div class="sst-ctrl-labeled"><span class="sst-ctrl-label">Tour Length</span><div class="sst-duration-group" role="tablist" aria-label="Tour length">';
    lengths.forEach(function (L) {
      html += '<button type="button" class="sst-dc' + (L === st.len ? ' on' : '') + '" data-len="' + L + '" role="tab" aria-selected="' + (L === st.len) + '">' + L + ' hr</button>';
    });
    html += '</div></div>';
    html += '<button type="button" class="sst-wtp-btn" data-sst-wtp>Which to Pick?</button></div>';

    if (st.mode === 'full') {
      html += '<div class="sst-styles" data-sst-styles>';
      if (st.key === 'arches') {
        [4, 6, 8].forEach(function (L) {
          html += '<div class="sst-dur-group-list" data-dur="' + L + '"' + (L === st.len ? '' : ' style="display:none"') + '>';
          html += '<div class="sst-dur-label">' + LEN_GROUP_LABELS[L] + '</div>';
          ARCHES_BY_LEN[L].forEach(function (vid) {
            var v = ARCHES_VARIANTS[vid];
            var on = vid === st.variant;
            html += '<label class="sst-style-row' + (on ? ' on' : '') + '" data-variant="' + vid + '" data-len="' + L + '">' +
              '<input type="radio" name="sstv-' + st.key + '-' + st.seq + '" value="' + vid + '"' + (on ? ' checked' : '') + '>' +
              '<span class="sst-style-dot"></span>' +
              '<span class="sst-style-name">' + esc(v.name) + '</span>' +
              '<span class="sst-more-info" data-sst-info="' + vid + '">(More Info)</span>' +
              (v.tag ? '<span class="sst-style-tag ' + v.tagClass + '">' + esc(v.tag) + '</span>' : '') +
              '</label>';
          });
          html += '</div>';
        });
      } else {
        var cfg = TOUR_VARIANTS[st.key];
        lengths.forEach(function (L) {
          if (!cfg.v[L]) return;
          var rowName = st.key === 'night' ? 'Moonlight Walk' : LEN_NAMES[L];
          var tag = L === REC[st.key] ? (st.key === 'night' ? '[FULL-MOON WEEKS]' : 'Recommended') : (L + ' hrs');
          var tagClass = L === REC[st.key] ? (st.key === 'night' ? 'note' : 'rec') : '';
          html += '<div class="sst-dur-group-list" data-dur="' + L + '"' + (L === st.len ? '' : ' style="display:none"') + '>';
          html += '<div class="sst-dur-label">' + (st.key === 'night' ? 'Nighthike (~4 hrs)' : LEN_GROUP_LABELS[L]) + '</div>';
          html += '<label class="sst-style-row' + (L === st.len ? ' on' : '') + '" data-variant="len' + L + '" data-len="' + L + '">' +
            '<input type="radio" name="sstv-' + st.key + '-' + st.seq + '" value="len' + L + '"' + (L === st.len ? ' checked' : '') + '>' +
            '<span class="sst-style-dot"></span>' +
            '<span class="sst-style-name">' + esc(rowName) + '</span>' +
            '<span class="sst-style-tag ' + tagClass + '">' + esc(tag) + '</span>' +
            '</label>';
          html += '</div>';
        });
      }
      html += '</div>';
    }

    // control strip: date / adults / kids / estimate / add
    html += '<div class="sst-strip">' +
      '<div class="sst-ctrl-labeled"><span class="sst-ctrl-label">Date</span>' +
      '<div class="sst-date-stepper">' +
      '<button type="button" class="sst-ds-prev" aria-label="Previous open date">&lt;</button>' +
      '<button type="button" class="sst-date-display" title="Open calendar">· · ·</button>' +
      '<button type="button" class="sst-ds-next" aria-label="Next open date">&gt;</button>' +
      '</div></div>' +
      '<div class="sst-ctrl-labeled"><span class="sst-ctrl-label"># Adults</span>' +
      '<div class="sst-people-ctrl">' +
      '<button type="button" class="sst-p-arrow" data-step="adults" data-dir="-1" aria-label="Fewer adults">−</button>' +
      '<input class="sst-p-val" data-val="adults" type="number" min="1" max="8" value="2" inputmode="numeric" aria-label="Number of adults">' +
      '<button type="button" class="sst-p-arrow" data-step="adults" data-dir="1" aria-label="More adults">+</button>' +
      '</div></div>' +
      '<div class="sst-ctrl-labeled"><span class="sst-ctrl-label">Kids &lt;3</span>' +
      '<div class="sst-people-ctrl">' +
      '<button type="button" class="sst-p-arrow" data-step="kids" data-dir="-1" aria-label="Fewer kids under 3">−</button>' +
      '<input class="sst-p-val" data-val="kids" type="number" min="0" max="4" value="0" readonly aria-label="Kids under 3">' +
      '<button type="button" class="sst-p-arrow" data-step="kids" data-dir="1" aria-label="More kids under 3">+</button>' +
      '</div></div>' +
      '<div class="sst-estimate" data-sst-estimate aria-live="polite"></div>' +
      '<button type="button" class="sst-add-btn" data-sst-add>Quick Add to Trip</button>' +
      '</div>';

    st.controls.innerHTML = html;
  }

  function bindCard(root) {
    var st = root._sst;
    root.addEventListener('click', function (e) {
      var dc = e.target.closest('.sst-dc');
      if (dc && root.contains(dc)) { setCardLen(root, parseInt(dc.getAttribute('data-len'), 10)); return; }
      var info = e.target.closest('[data-sst-info]');
      if (info) { e.preventDefault(); openVariantInfo(info.getAttribute('data-sst-info')); return; }
      var row = e.target.closest('.sst-style-row');
      if (row && root.contains(row)) {
        e.preventDefault();
        setCardVariant(root, row.getAttribute('data-variant'), parseInt(row.getAttribute('data-len'), 10));
        return;
      }
      var wtp = e.target.closest('[data-sst-wtp]');
      if (wtp) { openWhichToPick(st.key); return; }
      var stepBtn = e.target.closest('[data-step]');
      if (stepBtn && root.contains(stepBtn)) {
        stepPeople(root, stepBtn.getAttribute('data-step'), parseInt(stepBtn.getAttribute('data-dir'), 10));
        return;
      }
      if (e.target.closest('.sst-date-display')) { openDateModal(root); return; }
      if (e.target.closest('.sst-ds-prev')) { stepCardDate(root, -1, e.target.closest('.sst-ds-prev')); return; }
      if (e.target.closest('.sst-ds-next')) { stepCardDate(root, 1, e.target.closest('.sst-ds-next')); return; }
      var add = e.target.closest('[data-sst-add]');
      if (add) { quickAdd(root); return; }
    });
    root.addEventListener('change', function (e) {
      var inp = e.target.closest('.sst-p-val[data-val="adults"]');
      if (inp) {
        var v = parseInt(inp.value, 10) || 1;
        if (v < 1) v = 1;
        if (v + st.kids > 8) { v = 8 - st.kids; showToast('Please Contact Us to Book 9+ (Large Group Pricing)', 'warn'); }
        st.adults = v;
        inp.value = v;
        updateCard(root);
      }
    });
    window.addEventListener('resize', function () { requestAnimationFrame(function () { updateBarbell(root); }); });
  }

  function stepPeople(root, which, dir) {
    var st = root._sst;
    if (which === 'adults') {
      var na = Math.max(1, st.adults + dir);
      if (na + st.kids > 8) { showToast('Please Contact Us to Book 9+ (Large Group Pricing)', 'warn'); return; }
      st.adults = na;
    } else {
      var nk = Math.max(0, Math.min(4, st.kids + dir));
      if (st.adults + nk > 8) { showToast('Please Contact Us to Book 9+ (Large Group Pricing)', 'warn'); return; }
      st.kids = nk;
    }
    var aEl = root.querySelector('.sst-p-val[data-val="adults"]');
    var kEl = root.querySelector('.sst-p-val[data-val="kids"]');
    if (aEl) aEl.value = st.adults;
    if (kEl) kEl.value = st.kids;
    updateCard(root);
  }

  function setCardLen(root, len) {
    var st = root._sst;
    if (LENGTHS[st.key].indexOf(len) < 0) return;
    st.len = len;
    if (st.key === 'arches') {
      var cur = ARCHES_VARIANTS[st.variant];
      if (!cur || cur.hours !== len) st.variant = ARCHES_BY_LEN[len][0];
    } else if (st.mode === 'full') {
      st.variant = null;
    }
    // toggle chevrons + visible variant group
    root.querySelectorAll('.sst-dc').forEach(function (b) {
      var on = parseInt(b.getAttribute('data-len'), 10) === len;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.querySelectorAll('.sst-dur-group-list').forEach(function (g) {
      g.style.display = parseInt(g.getAttribute('data-dur'), 10) === len ? '' : 'none';
    });
    syncRowSelection(root);
    updateCard(root);
    if (window.dataLayer) window.dataLayer.push({ event: 'variant_switch', tour: st.key, length: String(len) });
  }
  function setCardVariant(root, variantId, len) {
    var st = root._sst;
    if (st.key === 'arches' && ARCHES_VARIANTS[variantId]) st.variant = variantId;
    if (len && len !== st.len) { setCardLen(root, len); return; }
    syncRowSelection(root);
    updateCard(root);
  }
  function syncRowSelection(root) {
    var st = root._sst;
    var want = st.key === 'arches' ? st.variant : 'len' + st.len;
    root.querySelectorAll('.sst-style-row').forEach(function (row) {
      var on = row.getAttribute('data-variant') === want;
      row.classList.toggle('on', on);
      var radio = row.querySelector('input');
      if (radio) radio.checked = on;
    });
  }

  function setCardDate(root, iso, silent) {
    var st = root._sst;
    st.date = iso;
    updateCard(root);
    if (!silent && st.key === 'night') {
      var t = nightStartFor(iso);
      if (t) showToast('Moon window — suggested start ' + t);
    }
  }
  var stepBusy = false;
  function stepCardDate(root, dir, btn) {
    if (stepBusy) return;
    var st = root._sst;
    var from = st.date ? isoAddDays(st.date, dir) : minIso();
    stepBusy = true;
    if (btn) btn.disabled = true;
    findOpenDate(from, dir, st.key).then(function (iso) {
      stepBusy = false;
      if (btn) btn.disabled = false;
      if (iso) setCardDate(root, iso);
      else showToast(dir > 0 ? 'No open dates further out (180-day window)' : 'No earlier open dates (2-day lead)', 'warn');
    });
  }

  function quickAdd(root) {
    var st = root._sst;
    var inCart = findInCart(st.key);
    if (inCart) { removeByKey(st.key); return; }
    if (!st.date) {
      showToast('Checking live availability — pick a date first', 'warn');
      openDateModal(root);
      return;
    }
    // final availability re-check straight from cache/live before adding
    checkDateOpen(st.date, st.key).then(function (open) {
      if (!open) {
        showToast('That date just filled up — pick another', 'warn');
        st.date = null;
        updateCard(root);
        openDateModal(root);
        return;
      }
      addItem({ tour: st.key, variant: st.key === 'arches' ? st.variant : null, len: st.len, date: st.date, adults: st.adults, kids: st.kids });
      if (window.dataLayer) window.dataLayer.push({ event: 'trip_add', tour: st.key, length: String(st.len) });
    });
  }

  function titleBoxText(st) {
    if (st.key === 'arches') return ARCHES_VARIANTS[st.variant] ? ARCHES_VARIANTS[st.variant].name : 'Highlights | Half Day Tour';
    if (st.key === 'night') return 'Moonlight Walk';
    return LEN_NAMES[st.len] || (st.len + ' hr Tour');
  }
  function varTextHTML(st) {
    if (st.key === 'arches') {
      var v = ARCHES_VARIANTS[st.variant];
      if (v) return '<div class="tg-rec">' + esc(v.name) + '</div>' + esc(v.desc);
    }
    var cfg = TOUR_VARIANTS[st.key];
    var lv = cfg && cfg.v[st.len];
    if (lv) return '<div class="tg-rec">' + esc(lv.label) + '</div>' + esc(lv.text);
    return '';
  }

  function updateCard(root) {
    var st = root._sst;
    var title = root.querySelector('[data-sst-title]');
    if (title) title.textContent = titleBoxText(st);
    var tag = root.querySelector('[data-sst-tag]');
    if (tag) tag.hidden = !(st.key === 'arches' && st.variant === 'highlights4');
    var vt = root.querySelector('[data-sst-vartext]');
    if (vt) vt.innerHTML = varTextHTML(st);
    // estimate — ALWAYS pre-tax; guests label counts every human, price counts adults (kids <3 free of n)
    var estEl = root.querySelector('[data-sst-estimate]');
    if (estEl) {
      var guests = st.adults + st.kids;
      estEl.innerHTML = money(priceFor(st.len, st.adults)) + '<small>estimate</small><span class="sst-est-ctx">' +
        guests + ' guest' + (guests === 1 ? '' : 's') + ' · ' + st.len + ' hrs · pre-tax</span>';
    }
    // date display
    var disp = root.querySelector('.sst-date-display');
    if (disp) disp.textContent = st.date ? isoShort(st.date) : '· · ·';
    // book link(s)
    root.querySelectorAll('.book-btn,[data-sst-book]').forEach(function (a) {
      var href = a.getAttribute('href') || 'book.html';
      var base = href.split('?')[0];
      var q = '?tour=' + st.key + '&len=' + st.len;
      if (st.key === 'arches' && st.variant) q += '&variant=' + st.variant;
      if (st.date) q += '&date=' + st.date;
      a.setAttribute('href', base + q);
    });
    syncAddedState(root);
    requestAnimationFrame(function () { updateBarbell(root); });
  }

  function syncAddedState(root) {
    var st = root._sst;
    var btn = root.querySelector('[data-sst-add]');
    if (!btn) return;
    var inCart = findInCart(st.key);
    btn.classList.toggle('added', !!inCart);
    btn.textContent = inCart ? '✓ Added — tap to remove' : 'Quick Add to Trip';
  }
  function syncCardAddedStates() { cards.forEach(function (c) { syncAddedState(c); }); }

  // Animated connector: title box <-> selected variant row (legacy updateBarbell port)
  function updateBarbell(root) {
    var st = root._sst;
    if (!st || !st.barbell || st.mode !== 'full') return;
    var titleEl = root.querySelector('[data-sst-title]');
    var row = root.querySelector('.sst-style-row.on');
    var vert = st.barbell.querySelector('.sst-bb-vert');
    var horiz = st.barbell.querySelector('.sst-bb-horiz');
    var horizBtm = st.barbell.querySelector('.sst-bb-horiz-btm');
    if (!titleEl || !row || row.offsetParent === null || titleEl.offsetParent === null) { st.barbell.style.display = 'none'; return; }
    var dRect = st.host.getBoundingClientRect();
    var tRect = titleEl.getBoundingClientRect();
    var rRect = row.getBoundingClientRect();
    var dot = row.querySelector('.sst-style-dot');
    var dotRect = dot ? dot.getBoundingClientRect() : null;
    var titleMidY = tRect.top + tRect.height / 2 - dRect.top;
    var titleLeftX = tRect.left - dRect.left;
    var rowMidY = rRect.top + rRect.height / 2 - dRect.top;
    if (rowMidY <= titleMidY || titleLeftX < 10) { st.barbell.style.display = 'none'; return; }
    var poleX = titleLeftX / 2;
    vert.style.left = poleX + 'px';
    vert.style.top = titleMidY + 'px';
    vert.style.height = Math.max(rowMidY - titleMidY, 0) + 'px';
    horiz.style.left = poleX + 'px';
    horiz.style.top = titleMidY + 'px';
    horiz.style.width = (titleLeftX - poleX) + 'px';
    var stopX = dotRect ? (dotRect.left - dRect.left + 4.5) : titleLeftX;
    horizBtm.style.left = poleX + 'px';
    horizBtm.style.top = rowMidY + 'px';
    horizBtm.style.width = Math.max(stopX - poleX, 0) + 'px';
    st.barbell.style.display = 'block';
  }

  /* ------------------------------------------------------------------ */
  /* FILTER CHIPS (tours.html) — filter + set each card's active length */
  /* ------------------------------------------------------------------ */
  function initFilters() {
    var group = document.getElementById('chipGroup');
    if (!group) return;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('.band-chip');
      if (!b) return;
      group.querySelectorAll('.band-chip').forEach(function (c) { c.classList.remove('active'); });
      b.classList.add('active');
      applyFilter(b.getAttribute('data-filter'));
      if (window.dataLayer) window.dataLayer.push({ event: 'filter_tours', filter_value: b.getAttribute('data-filter') });
    });
  }
  function applyFilter(f) {
    document.querySelectorAll('#toursGrid .tour').forEach(function (card) {
      var key = card.getAttribute('data-sst-card') || card.getAttribute('data-tour');
      var lengths = LENGTHS[key] || [];
      var show = (f === 'all') || lengths.indexOf(parseInt(f, 10)) > -1;
      card.style.display = show ? '' : 'none';
      if (card._sst) {
        if (f === 'all') setCardLen(card, REC[key]);
        else if (show) setCardLen(card, parseInt(f, 10));
      }
    });
    cards.forEach(function (c) { requestAnimationFrame(function () { updateBarbell(c); }); });
  }

  /* ------------------------------------------------------------------ */
  /* CHAT WIDGET                                                        */
  /* ------------------------------------------------------------------ */
  var chatFab = null, chatPanel = null;
  function ensureChat() {
    if (chatFab) return;
    chatFab = document.createElement('button');
    chatFab.type = 'button';
    chatFab.className = 'sst-chat-fab';
    chatFab.setAttribute('aria-label', 'Chat with Sand & Stars');
    chatFab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    document.body.appendChild(chatFab);

    chatPanel = document.createElement('div');
    chatPanel.className = 'sst-chat-panel';
    chatPanel.setAttribute('role', 'dialog');
    chatPanel.setAttribute('aria-label', 'Chat with Sand & Stars');
    var tgBtn = TG_HANDLE
      ? '<a class="sst-chat-link" href="https://t.me/' + encodeURIComponent(TG_HANDLE) + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" fill="#54a9eb"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.9 8.16l-1.98 9.34c-.15.66-.54.82-1.09.51l-3.01-2.22-1.45 1.4c-.16.16-.3.3-.61.3l.22-3.05 5.56-5.03c.24-.21-.05-.33-.37-.12l-6.87 4.33-2.96-.93c-.64-.2-.66-.64.14-.95l11.57-4.46c.54-.2 1.01.13.85.88z"/></svg>' +
        'Telegram<span class="badge">Fast</span></a>'
      : '';
    chatPanel.innerHTML =
      '<div class="sst-chat-head"><div class="t">Chat with Sand &amp; Stars</div><div class="s">Planning a Moab trip? We reply fast.</div></div>' +
      '<div class="sst-chat-body">' +
      '<a class="sst-chat-link" href="' + WA_URL + '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" fill="#25D366"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.87-9.9 9.87zm8.42-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.47-8.41z"/></svg>' +
      'WhatsApp us<span class="badge">Fastest</span></a>' +
      tgBtn +
      '<div class="sst-chat-or">or send a message</div>' +
      '<form class="sst-chat-form">' +
      '<input type="text" name="name" placeholder="Your name" autocomplete="name" required>' +
      '<input type="email" name="email" placeholder="Email" autocomplete="email" required>' +
      '<textarea name="message" placeholder="What can we help you plan?" required></textarea>' +
      '<button type="submit" class="sst-chat-send">Send Message</button>' +
      '</form>' +
      '<div class="sst-chat-note" id="sstChatNote">We usually reply within a few hours during business times.</div>' +
      '</div>';
    document.body.appendChild(chatPanel);

    chatFab.addEventListener('click', function () { chatPanel.classList.toggle('open'); });
    document.addEventListener('click', function (e) {
      if (chatPanel.classList.contains('open') && !e.target.closest('.sst-chat-panel') && !e.target.closest('.sst-chat-fab')) {
        chatPanel.classList.remove('open');
      }
    });
    chatPanel.querySelector('.sst-chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var name = f.name.value.trim(), email = f.email.value.trim(), msg = f.message.value.trim();
      if (!name || !email || !msg) { showToast('Please fill in name, email, and your message.', 'warn'); return; }
      // contact.html ships no wired backend action — it composes a prefilled
      // email to tours@. The chat form reuses that exact interim delivery.
      var subj = encodeURIComponent('Website chat — ' + name);
      var body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + msg);
      window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subj + '&body=' + body;
      document.getElementById('sstChatNote').textContent = 'Your email app is opening with the message filled in — just hit send.';
      if (window.dataLayer) window.dataLayer.push({ event: 'chat_message', page: location.pathname });
    });
  }

  /* ------------------------------------------------------------------ */
  /* CART RESTORE + AVAILABILITY-CHANGE GUARD                           */
  /* ------------------------------------------------------------------ */
  function validateCartDates() {
    var months = {};
    itinerary.forEach(function (it) { months[ymOf(it.date)] = true; });
    var jobs = Object.keys(months).map(warmMonth);
    if (!jobs.length) return;
    Promise.all(jobs).then(function () {
      var changed = false;
      itinerary.forEach(function (it) {
        var stillOpen = isoInWindow(it.date) && dayOpen(cachedDay(it.date), it.tour);
        if (!stillOpen && !it._unavailWarning) { it._unavailWarning = true; changed = true; }
        if (stillOpen && it._unavailWarning) { delete it._unavailWarning; changed = true; }
      });
      if (changed) showCartWarnings();
    });
  }
  function showCartWarnings() {
    var warns = itinerary.filter(function (t) { return t._unavailWarning; });
    var banner = document.getElementById('sstCartWarning');
    if (!warns.length) { if (banner) banner.remove(); renderCheckoutIfOpen(); return; }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sstCartWarning';
      banner.className = 'sst-cart-warning';
      if (roverEl && roverEl.parentElement) roverEl.parentElement.insertBefore(banner, roverEl.nextSibling);
      else document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.innerHTML = '⚠️ One or more activities in your cart may no longer be available for the selected date(s). <a href="mailto:' + CONTACT_EMAIL + '">Please contact us</a> and we’ll do our best to make it work.';
    renderCheckoutIfOpen();
  }

  /* ------------------------------------------------------------------ */
  /* INIT                                                               */
  /* ------------------------------------------------------------------ */
  function init() {
    loadCart();
    ensureRover();
    ensureChat();
    rebuildSlots();
    renderRover();
    document.querySelectorAll('[data-sst-card]').forEach(initCard);
    initFilters();
    syncCardAddedStates();
    validateCartDates();
    // warm the near-term availability months for instant steppers
    warmMonth(ymOf(minIso()));
    warmMonth(ymOf(isoAddDays(minIso(), 32)));
    // deep links: ?len= selects a filter chip; #tour scrolls to a card
    var len = new URLSearchParams(location.search).get('len');
    if (len) {
      var chip = document.querySelector('.band-chip[data-filter="' + len + '"]');
      if (chip) chip.click();
    }
    if (location.hash) {
      var t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(function () { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
    }
    // close rover popovers on outside clicks; open on stop tap
    document.addEventListener('click', function (e) {
      var pop = e.target.closest('[data-stop-pop]');
      if (pop) {
        var idx = pop.getAttribute('data-stop-pop');
        var el = document.getElementById('sstPop' + idx);
        var wasOpen = el && el.classList.contains('open');
        closeAllPopovers();
        if (el && !wasOpen) el.classList.add('open');
        return;
      }
      var edit = e.target.closest('[data-stop-edit]');
      if (edit) { closeAllPopovers(); openCheckout(); return; }
      var rem = e.target.closest('[data-stop-remove]');
      if (rem) { closeAllPopovers(); removeTourToPlaceholder(parseInt(rem.getAttribute('data-stop-remove'), 10)); return; }
      var phRem = e.target.closest('[data-ph-remove]');
      if (phRem) { removePlaceholder(parseInt(phRem.getAttribute('data-ph-remove'), 10)); return; }
      var dayAdd = e.target.closest('[data-sst-day]');
      if (dayAdd) { addDayPlaceholder(dayAdd.getAttribute('data-sst-day')); return; }
      if (!e.target.closest('.sst-rover-popover') && !e.target.closest('[data-stop-pop]')) closeAllPopovers();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeCheckout();
        closeAllPopovers();
        if (dateModal) dateModal.classList.remove('open');
        if (infoModal) infoModal.classList.remove('open');
        if (chatPanel) chatPanel.classList.remove('open');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Small public surface for QA / page glue
  window.SSTTrip = {
    version: '1.0.0',
    openCheckout: openCheckout,
    openWhichToPick: openWhichToPick,
    applyFilter: applyFilter,
    addItem: addItem,
    removeByKey: removeByKey,
    price: priceFor,
    get items() { return itinerary.slice(); }
  };
})();
