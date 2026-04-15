/* ============================================================================
 * Rover — Dynamic Field Reader
 * ----------------------------------------------------------------------------
 * Schema-flexible reader for the avail-governance spreadsheet (wset r4 §r4-3).
 * Accepts arbitrary keys. Never throws on unknown fields. Logs unknowns to
 * the dev console + analytics (if analytics present).
 *
 * Required fields (v1):
 *   - max_tours_per_day (number)
 *   - blackout_dates (array of ISO date strings)
 * Everything else optional.
 *
 * Consumers query fields by key with a fallback value. If a field is missing,
 * the fallback is returned and a one-time warning is logged per (scope, key).
 *
 * Usage:
 *   const reader = RoverDynamicFieldReader.wrap(rawConfig, { scope: 'v1' });
 *   const cap    = reader.get('max_tours_per_day', 1);
 *   const future = reader.get('some_new_field_not_yet_built', null);
 * ========================================================================== */

(function (global) {
  'use strict';

  const REQUIRED_FIELDS_V1 = Object.freeze(['max_tours_per_day', 'blackout_dates']);
  const loggedMisses = new Set(); // dedupe "missing field" warnings

  function emit(event, payload) {
    if (global.RoverAnalytics && typeof global.RoverAnalytics.track === 'function') {
      try { global.RoverAnalytics.track(event, payload); } catch (_) { /* swallow */ }
    }
  }

  function warnMiss(scope, key, fallback) {
    const sig = scope + '::' + key;
    if (loggedMisses.has(sig)) return;
    loggedMisses.add(sig);
    // eslint-disable-next-line no-console
    console.warn('[RoverDynamicFieldReader] missing field', { scope, key, fallback });
    emit('avail_schema_missing_field', { scope, key });
  }

  function warnUnknown(scope, key) {
    const sig = scope + '::unknown::' + key;
    if (loggedMisses.has(sig)) return;
    loggedMisses.add(sig);
    // eslint-disable-next-line no-console
    console.info('[RoverDynamicFieldReader] new avail field detected', { scope, key });
    emit('avail_schema_unknown_field', { scope, key });
  }

  /**
   * Wrap a raw config object in a reader with .get/.has/.keys/.all.
   * Any key outside REQUIRED_FIELDS_V1 is treated as "extra/future-proof"
   * and logged the first time we encounter it.
   */
  function wrap(raw, opts) {
    const scope = (opts && opts.scope) || 'default';
    const source = (raw && typeof raw === 'object') ? raw : {};

    // Note any unknown-but-present fields once.
    Object.keys(source).forEach(function (k) {
      if (REQUIRED_FIELDS_V1.indexOf(k) === -1) warnUnknown(scope, k);
    });

    return Object.freeze({
      scope,
      has: function (key) {
        return Object.prototype.hasOwnProperty.call(source, key) && source[key] != null;
      },
      get: function (key, fallback) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] != null) {
          return source[key];
        }
        warnMiss(scope, key, fallback);
        return (typeof fallback === 'undefined') ? null : fallback;
      },
      keys: function () { return Object.keys(source); },
      all: function () { return Object.assign({}, source); },
    });
  }

  global.RoverDynamicFieldReader = Object.freeze({
    wrap,
    REQUIRED_FIELDS_V1,
  });
})(typeof window !== 'undefined' ? window : globalThis);
