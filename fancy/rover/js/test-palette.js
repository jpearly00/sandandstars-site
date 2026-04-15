/* ============================================================================
 * Rover — Test Palette (W-R08)
 * ----------------------------------------------------------------------------
 * Floating dev panel for simulating test scenarios without a live backend.
 * Phase 0 shell — wires contest-detector + avail-reader + analytics buffer
 * so QA can eyeball state changes, event emissions, and toast triggers.
 *
 * Visibility: only injects when URL has `?palette=1` or
 * localStorage-free query flag — per W-R06 no tracking rule we prefer
 * query string activation. Palette never ships enabled by default.
 *
 * Scenarios are loaded from `fixtures/mock-carts.json`. Each button:
 *   - Sets window.ROVER_MOCK_CARTS = scenario.carts
 *   - Runs RoverContestDetector.detect(carts)
 *   - Echoes result to panel + console
 *
 * Extra buttons:
 *   - Reload avail   → RoverAvailReader.refresh()
 *   - Dump events    → render RoverAnalytics.getBuffer() snapshot
 *   - Clear events   → RoverAnalytics.clear()
 *
 * Keyboard: `~` toggles panel visibility once injected.
 * ========================================================================== */

(function (global) {
  'use strict';

  const PALETTE_PARAM = 'palette';
  const FIXTURE_URL = '/rover/fixtures/mock-carts.json';

  function qsFlag(name) {
    try {
      const params = new URLSearchParams(global.location ? global.location.search : '');
      return params.get(name) === '1';
    } catch (_) { return false; }
  }

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
      else if (k === 'onclick') n.addEventListener('click', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function log(panelLog, text) {
    const stamp = new Date().toISOString().slice(11, 19);
    panelLog.textContent = '[' + stamp + '] ' + text + '\n' + panelLog.textContent;
  }

  function runScenario(key, scenarios, panelLog) {
    const s = scenarios[key];
    if (!s) { log(panelLog, 'scenario not found: ' + key); return; }
    global.ROVER_MOCK_CARTS = s.carts;
    const detector = global.RoverContestDetector;
    if (!detector) { log(panelLog, 'contest-detector not loaded'); return; }
    const r = detector.detect(s.carts);
    const pass = (!!s.expected_contested === r.contested) && (s.expected_pairs == null || s.expected_pairs === r.pairs.length);
    log(panelLog, (pass ? 'PASS ' : 'FAIL ') + key + ' → contested=' + r.contested + ', pairs=' + r.pairs.length);
  }

  function dumpEvents(panelLog) {
    const buf = (global.RoverAnalytics && global.RoverAnalytics.getBuffer()) || [];
    log(panelLog, 'events (' + buf.length + '): ' + buf.slice(-5).map(function (e) { return e.event; }).join(', '));
  }

  function render(scenarios) {
    const panelLog = el('pre', { style: {
      maxHeight: '160px', overflow: 'auto', background: '#0b0d12', color: '#d6e1f5',
      padding: '6px', margin: '6px 0', fontSize: '11px', border: '1px solid #2a3040'
    } }, ['']);

    const scenarioBtns = Object.keys(scenarios).map(function (k) {
      return el('button', {
        style: { margin: '2px', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' },
        onclick: function () { runScenario(k, scenarios, panelLog); }
      }, [scenarios[k].label || k]);
    });

    const utilityBtns = [
      el('button', { onclick: function () {
        if (global.RoverAvailReader) global.RoverAvailReader.refresh().then(function () { log(panelLog, 'avail reloaded'); });
      }, style: { margin: '2px', padding: '4px 6px', fontSize: '11px' } }, ['Reload avail']),
      el('button', { onclick: function () { dumpEvents(panelLog); }, style: { margin: '2px', padding: '4px 6px', fontSize: '11px' } }, ['Dump events']),
      el('button', { onclick: function () {
        if (global.RoverAnalytics) { global.RoverAnalytics.clear(); log(panelLog, 'events cleared'); }
      }, style: { margin: '2px', padding: '4px 6px', fontSize: '11px' } }, ['Clear events']),
    ];

    const panel = el('div', {
      id: 'rover-test-palette',
      style: {
        position: 'fixed', bottom: '12px', right: '12px', width: '340px',
        background: '#151923', color: '#e6ecf8', border: '1px solid #e89866',
        borderRadius: '6px', padding: '8px', font: '12px/1.3 system-ui, sans-serif',
        zIndex: 99999, boxShadow: '0 4px 18px rgba(0,0,0,.4)'
      }
    }, [
      el('div', { style: { fontWeight: 700, color: '#e89866', marginBottom: '4px' } }, ['Rover Test Palette (W-R08)']),
      el('div', null, scenarioBtns),
      el('div', { style: { borderTop: '1px solid #2a3040', marginTop: '4px', paddingTop: '4px' } }, utilityBtns),
      panelLog,
      el('div', { style: { fontSize: '10px', color: '#7e8ba8' } }, ['press `~` to toggle'])
    ]);

    document.body.appendChild(panel);

    document.addEventListener('keydown', function (e) {
      if (e.key === '~') panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
  }

  function init() {
    if (!qsFlag(PALETTE_PARAM)) return;
    if (typeof fetch !== 'function') return;
    fetch(FIXTURE_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('fixture HTTP ' + r.status); return r.json(); })
      .then(function (json) { render((json && json.scenarios) || {}); })
      .catch(function (err) {
        // eslint-disable-next-line no-console
        console.warn('[RoverTestPalette] fixture load failed', err.message);
      });
  }

  if (global.document && document.readyState !== 'loading') init();
  else if (global.document) document.addEventListener('DOMContentLoaded', init);

  global.RoverTestPalette = Object.freeze({ init, runScenario, qsFlag });
})(typeof window !== 'undefined' ? window : globalThis);
