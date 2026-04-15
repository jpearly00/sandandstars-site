/* ============================================================================
 * Rover — Analytics Event Emitter
 * ----------------------------------------------------------------------------
 * Phase 0 scaffold for W-R11 (Analytics event instrumentation). In-browser,
 * dev-console echo only. Future phases: pipe to GA4 + internal ledger.
 *
 * Event naming convention: snake_case, verb-noun form.
 *   rover_tour_added, rover_tour_removed, rover_swap_arrow_clicked,
 *   cart_contest_detected, cart_warning_toast_fired,
 *   checkout_banner_shown, payment_queue_enqueued, payment_queue_advanced,
 *   avail_schema_unknown_field, avail_schema_missing_field, ...
 *
 * All events include a timestamp and a session id. Session id is ephemeral
 * (cleared per tab close) — NO localStorage per Account_Level_Prefs OUTPUT
 * RULE + W-R06 no-tracking directive.
 *
 * Usage:
 *   RoverAnalytics.track('rover_tour_added', { tour_id: 'arches_main', day: '2026-05-02' });
 *   RoverAnalytics.getBuffer(); // for test palette inspection
 *   RoverAnalytics.clear();
 * ========================================================================== */

(function (global) {
  'use strict';

  const SESSION_ID = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
  const BUFFER_MAX = 500;
  const buffer = [];
  let echoEnabled = true;
  const listeners = [];

  function nowIso() { return new Date().toISOString(); }

  function track(eventName, payload) {
    const record = {
      t: nowIso(),
      session: SESSION_ID,
      event: String(eventName || 'unnamed'),
      payload: payload || {},
    };
    buffer.push(record);
    if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);
    if (echoEnabled && global.console && console.log) {
      // eslint-disable-next-line no-console
      console.log('%c[Rover]', 'color:#e89866;font-weight:600', record.event, record.payload);
    }
    listeners.slice().forEach(function (fn) {
      try { fn(record); } catch (_) { /* swallow listener errors */ }
    });
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function unsubscribe() {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  global.RoverAnalytics = Object.freeze({
    track,
    subscribe,
    getBuffer: function () { return buffer.slice(); },
    clear: function () { buffer.length = 0; },
    setEcho: function (b) { echoEnabled = !!b; },
    session: function () { return SESSION_ID; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
