/* ==========================================================
   Makro Shift Scheduler — Data layer (LocalStorage) + helpers
   ใช้ร่วมกันระหว่าง index.html (หน้าหลัก) และ admin.html (ตั้งค่า)
   ========================================================== */
(function (global) {
  'use strict';

  const SHIFTS_KEY = 'makro.shifts.v1';
  const SCHEDULE_KEY = 'makro.schedule.v1';
  const PERIOD_KEY = 'makro.period.v1';
  const NOTE_MAX = 500;
  const FALLBACK_COLOR = '#6B7280';

  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  const DEFAULT_SHIFTS = [
    { id: 'morning', name: 'กะเช้า', start: '06:00', end: '15:00', color: '#F59E0B', isOff: false },
    { id: 'afternoon', name: 'กะบ่าย', start: '13:00', end: '22:00', color: '#2563EB', isOff: false },
    { id: 'off', name: 'วันหยุด (OFF)', start: '', end: '', color: '#6B7280', isOff: true }
  ];

  /* ---------- Low-level storage ---------- */
  function load(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- Generic helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function toBuddhistYear(y) { return y + 543; }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeColor(hex) {
    return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : FALLBACK_COLOR;
  }

  function parseHex(hex) {
    const h = safeColor(hex).slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function badgeStyle(color) {
    const c = parseHex(color);
    const text = c.map(function (v) { return Math.round(v * 0.6); });
    return 'background:rgba(' + c.join(',') + ',.15);' +
      'color:rgb(' + text.join(',') + ');' +
      'border:1px solid rgba(' + c.join(',') + ',.4)';
  }

  function formatRange(shift) {
    if (!shift) return '';
    return shift.isOff ? 'วันหยุด' : shift.start + ' – ' + shift.end + ' น.';
  }

  function badgeHtml(shift, withTime) {
    if (!shift) {
      return '<span class="text-xs text-gray-400">ยังไม่ได้เลือกกะ</span>';
    }
    const label = escapeHtml(shift.name) +
      (withTime && !shift.isOff ? ' · ' + escapeHtml(shift.start + '–' + shift.end) : '');
    return '<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style="' +
      badgeStyle(shift.color) + '">' + label + '</span>';
  }

  function uid() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- Shifts ---------- */
  function isValidShift(s) {
    return s && typeof s.id === 'string' && typeof s.name === 'string';
  }

  function getShifts() {
    const stored = load(SHIFTS_KEY, null);
    if (Array.isArray(stored)) return stored.filter(isValidShift);
    const seeded = DEFAULT_SHIFTS.map(function (s) { return Object.assign({}, s); });
    save(SHIFTS_KEY, seeded);
    return seeded;
  }

  function saveShifts(list) { return save(SHIFTS_KEY, list); }

  function upsertShift(shift) {
    const list = getShifts();
    const clean = {
      id: shift.id || uid(),
      name: String(shift.name || '').trim(),
      start: shift.isOff ? '' : String(shift.start || ''),
      end: shift.isOff ? '' : String(shift.end || ''),
      color: safeColor(shift.color),
      isOff: !!shift.isOff
    };
    const idx = list.findIndex(function (s) { return s.id === clean.id; });
    if (idx >= 0) list[idx] = clean; else list.push(clean);
    saveShifts(list);
    return clean;
  }

  function deleteShift(id) {
    saveShifts(getShifts().filter(function (s) { return s.id !== id; }));
    // วันที่เคยใช้กะนี้จะกลับเป็น "ยังไม่ได้เลือกกะ"
    const schedule = getSchedule();
    Object.keys(schedule).forEach(function (k) {
      if (schedule[k].shiftId === id) setDay(k, { shiftId: '' }, schedule);
    });
  }

  function resetShifts() {
    saveShifts(DEFAULT_SHIFTS.map(function (s) { return Object.assign({}, s); }));
  }

  /* ---------- Schedule ---------- */
  function getSchedule() {
    const stored = load(SCHEDULE_KEY, {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  }

  function setDay(key, patch, scheduleRef) {
    const schedule = scheduleRef || getSchedule();
    const entry = Object.assign({ shiftId: '', meal: '', good: '', bad: '' }, schedule[key], patch);
    if (!entry.shiftId && !entry.meal && !entry.good && !entry.bad) delete schedule[key]; else schedule[key] = entry;
    return save(SCHEDULE_KEY, schedule);
  }

  function clearMonth(year, month) {
    const prefix = year + '-' + pad(month + 1) + '-';
    const schedule = getSchedule();
    Object.keys(schedule).forEach(function (k) {
      if (k.indexOf(prefix) === 0) delete schedule[k];
    });
    return save(SCHEDULE_KEY, schedule);
  }

  function countUsage(shiftId) {
    const schedule = getSchedule();
    return Object.keys(schedule).filter(function (k) { return schedule[k].shiftId === shiftId; }).length;
  }

  /* ---------- Backup / Restore ---------- */
  function exportData() {
    return {
      app: 'makro-shift-scheduler',
      version: 2,
      exportedAt: new Date().toISOString(),
      shifts: getShifts(),
      schedule: getSchedule(),
      period: getPeriod()
    };
  }

  function importData(obj) {
    if (!obj || !Array.isArray(obj.shifts) || typeof obj.schedule !== 'object' || !obj.schedule) {
      return false;
    }
    const shifts = obj.shifts.filter(isValidShift).map(function (s) {
      return {
        id: String(s.id),
        name: String(s.name).slice(0, 60),
        start: /^\d{2}:\d{2}$/.test(s.start) ? s.start : '',
        end: /^\d{2}:\d{2}$/.test(s.end) ? s.end : '',
        color: safeColor(s.color),
        isOff: !!s.isOff
      };
    });
    const schedule = {};
    Object.keys(obj.schedule).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const e = obj.schedule[k] || {};
      const shiftId = typeof e.shiftId === 'string' ? e.shiftId : '';
      const meal = /^\d{2}:\d{2}$/.test(e.meal) ? e.meal : '';
      const good = typeof e.good === 'string' ? e.good.slice(0, NOTE_MAX) : '';
      const bad = typeof e.bad === 'string' ? e.bad.slice(0, NOTE_MAX) : '';
      if (shiftId || meal || good || bad) schedule[k] = { shiftId: shiftId, meal: meal, good: good, bad: bad };
    });
    const ok = saveShifts(shifts) && save(SCHEDULE_KEY, schedule);
    if (ok && obj.period) savePeriod(obj.period);
    return ok;
  }

  /* ---------- Period tracker (ปฏิทินรอบเดือน) ---------- */
  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function sanitizePeriod(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const days = Array.isArray(r.days)
      ? r.days.filter(function (k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k); })
      : [];
    return {
      days: Array.from(new Set(days)).sort(),
      cycleLength: clampInt(r.cycleLength, 21, 45, 28),
      periodLength: clampInt(r.periodLength, 2, 10, 5)
    };
  }

  function getPeriod() { return sanitizePeriod(load(PERIOD_KEY, null)); }
  function savePeriod(p) { return save(PERIOD_KEY, sanitizePeriod(p)); }

  global.MakroStore = {
    SHIFTS_KEY: SHIFTS_KEY,
    SCHEDULE_KEY: SCHEDULE_KEY,
    PERIOD_KEY: PERIOD_KEY,
    NOTE_MAX: NOTE_MAX,
    getPeriod: getPeriod,
    savePeriod: savePeriod,
    THAI_MONTHS: THAI_MONTHS,
    THAI_DAYS: THAI_DAYS,
    THAI_DAYS_SHORT: THAI_DAYS_SHORT,
    pad: pad,
    dateKey: dateKey,
    daysInMonth: daysInMonth,
    toBuddhistYear: toBuddhistYear,
    escapeHtml: escapeHtml,
    safeColor: safeColor,
    formatRange: formatRange,
    badgeHtml: badgeHtml,
    getShifts: getShifts,
    upsertShift: upsertShift,
    deleteShift: deleteShift,
    resetShifts: resetShifts,
    getSchedule: getSchedule,
    setDay: setDay,
    clearMonth: clearMonth,
    countUsage: countUsage,
    exportData: exportData,
    importData: importData
  };
})(window);
