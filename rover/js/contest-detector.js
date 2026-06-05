/* ============================================================================
 * Rover — Contest Detector (W-R13)
 * ----------------------------------------------------------------------------
 * Pairwise ±3-day contest detection across concurrent shopper carts.
 * Spec: Rover_WISH_260415.md §r4-1.
 *
 * Definition (locked r4):
 *   Two carts A and B are "contesting" if ∃ (day_a ∈ A, day_b ∈ B) such that
 *   |day_a - day_b| <= 3 days (rolling pairwise across cart span).
 *
 * Input shape:
 *   carts = [
 *     { cart_id: 'c1', days: ['2026-05-02','2026-05-05'] },
 *     { cart_id: 'c2', days: ['2026-05-04'] },
 *     ...
 *   ]
 *
 * Output shape:
 *   {
 *     contested: true|false,
 *     pairs: [ { a: 'c1', b: 'c2', day_a, day_b, delta_days } ],
 *     by_cart: { c1: [c2], c2: [c1] }
 *   }
 *
 * Phase 0: local computation on client-known cart set (test palette + own
 * cart). Phase 1+: GAS `/carts/active?window=<iso>..<iso>` returns peer
 * carts server-side and we run detection on the merged set.
 *
 * Public API:
 *   RoverContestDetector.detect(carts, { windowDays: 3 })
 *   RoverContestDetector.contestsForCart(selfId, carts, { windowDays: 3 })
 * ========================================================================== */

(function (global) {
  'use strict';

  const DEFAULT_WINDOW_DAYS = 3;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function track(event, payload) {
    if (global.RoverAnalytics) global.RoverAnalytics.track(event, payload);
  }

  function isoToUtcMidnight(iso) {
    const parts = String(iso).split('-').map(Number);
    return Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function deltaDays(isoA, isoB) {
    return Math.abs(isoToUtcMidnight(isoA) - isoToUtcMidnight(isoB)) / MS_PER_DAY;
  }

  /**
   * Return all contest pairs across the cart set.
   * O(C^2 * D_avg^2) — fine for realistic shopper concurrency (<50 carts).
   */
  function detect(carts, opts) {
    const windowDays = (opts && typeof opts.windowDays === 'number') ? opts.windowDays : DEFAULT_WINDOW_DAYS;
    const list = Array.isArray(carts) ? carts : [];
    const pairs = [];
    const byCart = {};

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i] || {};
        const B = list[j] || {};
        const aDays = Array.isArray(A.days) ? A.days : [];
        const bDays = Array.isArray(B.days) ? B.days : [];
        let hit = null;
        for (let x = 0; x < aDays.length && !hit; x++) {
          for (let y = 0; y < bDays.length && !hit; y++) {
            const d = deltaDays(aDays[x], bDays[y]);
            if (d <= windowDays) {
              hit = { day_a: aDays[x], day_b: bDays[y], delta_days: d };
            }
          }
        }
        if (hit) {
          pairs.push({ a: A.cart_id, b: B.cart_id, day_a: hit.day_a, day_b: hit.day_b, delta_days: hit.delta_days });
          (byCart[A.cart_id] = byCart[A.cart_id] || []).push(B.cart_id);
          (byCart[B.cart_id] = byCart[B.cart_id] || []).push(A.cart_id);
        }
      }
    }

    const result = { contested: pairs.length > 0, pairs, by_cart: byCart };
    track('cart_contest_detected', { pair_count: pairs.length, cart_count: list.length, window_days: windowDays });
    return result;
  }

  /**
   * Convenience: return contests involving a specific cart id. Used by the
   * current shopper's session to decide whether to fire the warning toast.
   */
  function contestsForCart(selfId, carts, opts) {
    const r = detect(carts, opts);
    return r.pairs.filter(function (p) { return p.a === selfId || p.b === selfId; });
  }

  global.RoverContestDetector = Object.freeze({
    detect,
    contestsForCart,
    _internals: Object.freeze({ deltaDays, isoToUtcMidnight, DEFAULT_WINDOW_DAYS }),
  });
})(typeof window !== 'undefined' ? window : globalThis);
