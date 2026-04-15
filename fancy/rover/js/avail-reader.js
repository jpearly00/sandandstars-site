/* ============================================================================
 * Rover — Availability Reader
 * ----------------------------------------------------------------------------
 * Unified availability query API (wset r4 §r4-2). Strategy (Phase 0):
 *
 *   1. If window.ROVER_AVAIL_FIXTURE is set (test palette), use it.
 *   2. Else if `fixtures/avail-governance-mock.json` can be fetched, use it.
 *   3. Else fall back to DEFAULT_INVENTORY (1 AM OR 1 PM OR 1 full-day).
 *
 * Future phases:
 *   - When the real avail-governance spreadsheet is wired, this module reads
 *     it via the GAS cart-state backend's `/avail/:date_range` endpoint.
 *     The returned structure is wrapped in RoverDynamicFieldReader so any
 *     new fields added to the spreadsheet are tolerated (see §r4-3).
 *
 * Public API:
 *   const avail = await RoverAvailReader.init();
 *   avail.getDay('2026-05-02')   -> { slots_offered, slots_booked, slots_in_cart, slots_available, blackout, source }
 *   avail.isDayBookable(date)    -> boolean
 *   avail.getRange(startIso, endIso) -> array<daily record>
 *   avail.refresh()              -> re-fetch
 * ========================================================================== */

(function (global) {
  'use strict';

  const DEFAULT_FIXTURE_URL = '/rover/fixtures/avail-governance-mock.json';

  let state = {
    ready: false,
    source: null, // 'fixture-global' | 'fixture-url' | 'default'
    governance: null, // raw governance config (blackouts, max_tours_per_day, etc.)
    dailyGrid: {},    // ISO date -> { slots_offered, slots_booked, slots_in_cart }
  };

  function track(event, payload) {
    if (global.RoverAnalytics) global.RoverAnalytics.track(event, payload);
  }

  function defaultGovernance() {
    const inv = global.RoverDefaultInventory;
    return {
      max_tours_per_day: 1,       // "1 AM OR 1 PM OR 1 full-day" — see default-inventory.js
      blackout_dates: [],
      booking_lead_days: 2,
      max_advance_days: 180,
      slots: inv && inv.DEFAULT_INVENTORY.slots,
      rule: 'one_of',
    };
  }

  function fetchFixture() {
    if (global.ROVER_AVAIL_FIXTURE) {
      state.source = 'fixture-global';
      return Promise.resolve(global.ROVER_AVAIL_FIXTURE);
    }
    if (typeof fetch === 'function') {
      return fetch(DEFAULT_FIXTURE_URL, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('fixture HTTP ' + r.status); return r.json(); })
        .then(function (json) { state.source = 'fixture-url'; return json; })
        .catch(function (err) {
          // eslint-disable-next-line no-console
          console.info('[RoverAvailReader] fixture not available, falling back to DEFAULT', err.message);
          state.source = 'default';
          return null;
        });
    }
    state.source = 'default';
    return Promise.resolve(null);
  }

  function hydrate(raw) {
    const reader = global.RoverDynamicFieldReader
      ? global.RoverDynamicFieldReader.wrap(raw || defaultGovernance(), { scope: 'avail-governance' })
      : null;

    state.governance = reader || { get: function (k, f) { return (raw && raw[k] != null) ? raw[k] : f; }, all: function () { return raw || {}; } };

    const grid = {};
    if (raw && raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach(function (iso) {
        const d = raw.days[iso] || {};
        grid[iso] = {
          slots_offered: (d.slots_offered != null) ? d.slots_offered : state.governance.get('max_tours_per_day', 1),
          slots_booked: d.slots_booked || 0,
          slots_in_cart: d.slots_in_cart || 0,
          blackout: !!d.blackout,
        };
      });
    }
    state.dailyGrid = grid;
    state.ready = true;
    track('avail_reader_ready', { source: state.source, day_count: Object.keys(grid).length });
  }

  function getDay(iso) {
    const governance = state.governance || { get: function (_k, f) { return f; } };
    const baseline = governance.get('max_tours_per_day', 1);
    const blackouts = governance.get('blackout_dates', []);
    const entry = state.dailyGrid[iso] || { slots_offered: baseline, slots_booked: 0, slots_in_cart: 0, blackout: false };
    const isBlackout = entry.blackout || (Array.isArray(blackouts) && blackouts.indexOf(iso) >= 0);
    const available = isBlackout ? 0 : Math.max(0, entry.slots_offered - entry.slots_booked - entry.slots_in_cart);
    return {
      date: iso,
      slots_offered: entry.slots_offered,
      slots_booked: entry.slots_booked,
      slots_in_cart: entry.slots_in_cart,
      slots_available: available,
      blackout: isBlackout,
      source: state.source,
    };
  }

  function isDayBookable(iso) {
    const d = getDay(iso);
    return !d.blackout && d.slots_available > 0;
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function getRange(startIso, endIso) {
    const out = [];
    let cur = startIso;
    let safety = 0;
    while (cur <= endIso && safety < 1000) {
      out.push(getDay(cur));
      cur = addDays(cur, 1);
      safety++;
    }
    return out;
  }

  function init() {
    return fetchFixture().then(function (raw) {
      hydrate(raw || defaultGovernance());
      return getPublic();
    });
  }

  function refresh() { return init(); }

  function getPublic() {
    return Object.freeze({
      getDay,
      isDayBookable,
      getRange,
      refresh,
      source: function () { return state.source; },
      governance: function () { return state.governance ? state.governance.all() : {}; },
    });
  }

  global.RoverAvailReader = Object.freeze({
    init,
    refresh,
    // direct accessors also exposed for test palette convenience post-init
    getDay,
    isDayBookable,
    getRange,
  });
})(typeof window !== 'undefined' ? window : globalThis);
