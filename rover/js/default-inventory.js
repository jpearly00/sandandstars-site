/* ============================================================================
 * Rover — Default Inventory
 * ----------------------------------------------------------------------------
 * Phase 0 constant. Defines the baseline daily availability Rover assumes
 * until the avail-governance spreadsheet is wired (see wset r4 §r4-2).
 *
 * John-locked default: "1 tour in the morning, 1 tour in the evening, or
 * 1 full-day tour per day."
 *
 * Rule interpretation: on any given day, Rover treats the day as offering
 * EITHER one AM slot OR one PM slot OR one full-day slot — never all three
 * concurrently. Choosing one slot for a given day consumes the day.
 *
 * Source-of-truth migration path: when the avail-governance spreadsheet
 * goes live, avail-reader.js reads it first and falls back to this default
 * only when the spreadsheet is unreachable or a day is unspecified.
 * ========================================================================== */

(function (global) {
  'use strict';

  /** Canonical slot identifiers. Strings, stable across versions. */
  const SLOT = Object.freeze({
    AM:       'am',
    PM:       'pm',
    FULL_DAY: 'full_day',
  });

  /** Time windows per slot — local Moab time (MST/MDT). */
  const SLOT_WINDOWS = Object.freeze({
    am:       { start: '07:00', end: '12:00', label: 'Morning tour' },
    pm:       { start: '15:00', end: '20:30', label: 'Evening tour' },
    full_day: { start: '08:00', end: '17:00', label: 'Full-day tour' },
  });

  /**
   * Default daily inventory.
   * `rule: "one_of"` means at most one of the listed slots is bookable per day.
   * Future spreadsheet may override both counts and rule mode.
   */
  const DEFAULT_INVENTORY = Object.freeze({
    slots: Object.freeze({
      am:       1,
      pm:       1,
      full_day: 1,
    }),
    rule: 'one_of',
    timezone: 'America/Denver',
    windows: SLOT_WINDOWS,
  });

  /**
   * For a given day (any date arg), return the baseline available slots.
   * Returns an array of slot ids the day OFFERS (before any booking
   * subtraction or cart subtraction).
   */
  function getDefaultDailySlots(/* _day */) {
    return [SLOT.AM, SLOT.PM, SLOT.FULL_DAY];
  }

  /** Window label for a slot, used by UI. */
  function getSlotLabel(slotId) {
    return (SLOT_WINDOWS[slotId] && SLOT_WINDOWS[slotId].label) || slotId;
  }

  global.RoverDefaultInventory = Object.freeze({
    SLOT,
    SLOT_WINDOWS,
    DEFAULT_INVENTORY,
    getDefaultDailySlots,
    getSlotLabel,
  });
})(typeof window !== 'undefined' ? window : globalThis);
