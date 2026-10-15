/* ==========================================================
   ปฏิทินรอบเดือน — แตะวันที่เพื่อบันทึกวันที่มีประจำเดือน
   ระบบคำนวณรอบเฉลี่ย คาดการณ์ประจำเดือนครั้งถัดไป วันตกไข่ และช่วงเจริญพันธุ์ (ค่าประมาณ)
   ========================================================== */
(function () {
  'use strict';

  const S = window.MakroStore;
  const $ = function (sel) { return document.querySelector(sel); };

  const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const MERGE_GAP = 3;          // วันที่ห่างกันไม่เกิน 3 วัน นับเป็นประจำเดือนรอบเดียวกัน
  const CYCLE_MIN = 21;         // รอบที่อยู่นอกช่วง 21–45 วัน ไม่นำมาคำนวณค่าเฉลี่ย
  const CYCLE_MAX = 45;
  const LUTEAL = 14;            // ระยะหลังตกไข่ถึงมีประจำเดือน (ประมาณ 14 วัน)
  const FORECAST_CYCLES = 6;

  /* ---------- Date helpers ---------- */
  function parseKey(k) {
    const p = k.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function keyOf(d) { return S.dateKey(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(k, n) {
    const d = parseKey(k);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }
  function diffDays(a, b) {
    const da = parseKey(a), db = parseKey(b);
    return Math.round((Date.UTC(da.getFullYear(), da.getMonth(), da.getDate()) -
      Date.UTC(db.getFullYear(), db.getMonth(), db.getDate())) / 86400000);
  }
  function avg(list) {
    return list.reduce(function (s, v) { return s + v; }, 0) / list.length;
  }
  function formatDate(k) {
    const d = parseKey(k);
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + S.toBuddhistYear(d.getFullYear());
  }
  function formatShort(k) {
    const d = parseKey(k);
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  /* ---------- Core calculation (pure) ---------- */
  function groupPeriods(days) {
    const sorted = days.slice().sort();
    const groups = [];
    sorted.forEach(function (k) {
      const last = groups[groups.length - 1];
      if (last && diffDays(k, last.end) <= MERGE_GAP) {
        last.end = k;
      } else {
        groups.push({ start: k, end: k });
      }
    });
    groups.forEach(function (g) { g.length = diffDays(g.end, g.start) + 1; });
    return groups;
  }

  function compute(data) {
    const periods = groupPeriods(data.days);
    const starts = periods.map(function (p) { return p.start; });

    const cycles = [];
    for (let i = 1; i < starts.length; i++) cycles.push(diffDays(starts[i], starts[i - 1]));
    const usable = cycles.filter(function (c) { return c >= CYCLE_MIN && c <= CYCLE_MAX; }).slice(-6);
    const hasHistory = usable.length > 0;
    const cycleLength = hasHistory ? Math.round(avg(usable)) : data.cycleLength;

    // รอบล่าสุดอาจยังไม่จบ จึงไม่นำมาเฉลี่ยความยาวของประจำเดือน
    const finished = periods.slice(0, -1).map(function (p) { return p.length; })
      .filter(function (l) { return l >= 1 && l <= 12; }).slice(-6);
    const periodLength = finished.length ? Math.round(avg(finished)) : data.periodLength;

    const predictions = [];
    if (starts.length) {
      const last = starts[starts.length - 1];
      for (let k = 1; k <= FORECAST_CYCLES; k++) {
        const start = addDays(last, cycleLength * k);
        const ovulation = addDays(start, -LUTEAL);
        predictions.push({
          start: start,
          end: addDays(start, periodLength - 1),
          ovulation: ovulation,
          fertileStart: addDays(ovulation, -5),
          fertileEnd: addDays(ovulation, 1)
        });
      }
    }

    return {
      periods: periods,
      cycles: cycles,
      cycleLength: cycleLength,
      periodLength: periodLength,
      hasHistory: hasHistory,
      predictions: predictions
    };
  }

  function dayType(key, daySet, result) {
    if (daySet.has(key)) return 'period';
    let i, p;
    for (i = 0; i < result.predictions.length; i++) {
      p = result.predictions[i];
      if (key >= p.start && key <= p.end) return 'predicted';
    }
    for (i = 0; i < result.predictions.length; i++) {
      p = result.predictions[i];
      if (key === p.ovulation) return 'ovulation';
    }
    for (i = 0; i < result.predictions.length; i++) {
      p = result.predictions[i];
      if (key >= p.fertileStart && key <= p.fertileEnd) return 'fertile';
    }
    return '';
  }

  // เปิดให้ทดสอบจากภายนอกได้
  window.MakroPeriod = { compute: compute, groupPeriods: groupPeriods, dayType: dayType, addDays: addDays, diffDays: diffDays };

  /* ---------- UI ---------- */
  if (!$('#cal-grid')) return;

  const now = new Date();
  const todayKey = keyOf(now);
  const state = { year: now.getFullYear(), month: now.getMonth() };
  let data = S.getPeriod();
  let result = compute(data);
  let toastTimer = null;

  const el = {
    title: $('#cal-title'),
    grid: $('#cal-grid'),
    prev: $('#prev-month'),
    next: $('#next-month'),
    today: $('#today-btn'),
    stats: $('#stats'),
    cycleInput: $('#cycle-length'),
    periodInput: $('#period-length'),
    history: $('#history'),
    reset: $('#reset-btn'),
    toast: $('#toast')
  };

  const CELL_STYLE = {
    period: 'bg-makro text-white border-makro font-semibold',
    predicted: 'bg-makro-light text-makro border-makro/60 border-dashed',
    ovulation: 'bg-sky-500 text-white border-sky-500 font-semibold',
    fertile: 'bg-sky-100 text-sky-800 border-sky-200',
    '': 'bg-white text-ink border-gray-200 hover:bg-surface'
  };
  const CELL_LABEL = {
    period: 'มีประจำเดือน',
    predicted: 'คาดว่าจะมีประจำเดือน',
    ovulation: 'คาดว่าวันตกไข่',
    fertile: 'ช่วงเจริญพันธุ์ (ประมาณ)',
    '': ''
  };

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.add('opacity-0', 'translate-y-2');
    }, 2200);
  }

  function refresh() {
    data = S.getPeriod();
    result = compute(data);
    render();
  }

  function renderCalendar() {
    const y = state.year, m = state.month;
    el.title.textContent = S.THAI_MONTHS[m] + ' พ.ศ. ' + S.toBuddhistYear(y);

    const daySet = new Set(data.days);
    const lead = new Date(y, m, 1).getDay();
    const total = S.daysInMonth(y, m);
    let html = '';

    for (let i = 0; i < lead; i++) html += '<div></div>';
    for (let d = 1; d <= total; d++) {
      const key = S.dateKey(y, m, d);
      const type = dayType(key, daySet, result);
      const isToday = key === todayKey;
      const future = key > todayKey;
      html += '<button type="button" data-date="' + key + '" aria-pressed="' + (type === 'period') + '" ' +
        'aria-label="' + d + ' ' + S.THAI_MONTHS[m] + (CELL_LABEL[type] ? ' · ' + CELL_LABEL[type] : '') + (isToday ? ' · วันนี้' : '') + '" ' +
        'class="relative aspect-square rounded-xl border text-sm transition ' + CELL_STYLE[type] +
        (isToday ? ' ring-2 ring-ink ring-offset-1' : '') + (future && type === '' ? ' text-gray-400' : '') + '">' + d + '</button>';
    }
    el.grid.innerHTML = html;
  }

  function statTile(label, value, sub, cls) {
    return '<div class="rounded-xl border border-gray-200 bg-white p-3">' +
      '<div class="text-xs text-gray-500">' + label + '</div>' +
      '<div class="mt-0.5 text-lg font-bold leading-snug ' + (cls || 'text-ink') + '">' + value + '</div>' +
      (sub ? '<div class="mt-0.5 text-xs text-gray-500">' + sub + '</div>' : '') + '</div>';
  }

  function renderStats() {
    if (!result.periods.length) {
      el.stats.innerHTML =
        '<div class="col-span-2 rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 md:col-span-4">' +
        'ยังไม่มีข้อมูล — แตะวันที่ในปฏิทินที่เริ่มมีประจำเดือนและวันต่อ ๆ มา ระบบจะเริ่มคาดการณ์ให้</div>';
      return;
    }

    const next = result.predictions[0];
    const inPeriod = data.days.indexOf(todayKey) >= 0;
    const lastStart = result.periods[result.periods.length - 1].start;
    const cycleDay = lastStart <= todayKey ? diffDays(todayKey, lastStart) + 1 : null;

    let nextValue = formatDate(next.start);
    let nextSub;
    let nextCls = 'text-makro';
    const until = diffDays(next.start, todayKey);
    if (inPeriod) {
      nextSub = 'ตอนนี้อยู่ในช่วงมีประจำเดือน';
    } else if (until > 0) {
      nextSub = 'อีกประมาณ ' + until + ' วัน';
    } else if (until === 0) {
      nextSub = 'คาดว่าเริ่มวันนี้';
    } else {
      nextSub = 'เลยกำหนดมา ' + (-until) + ' วัน — อย่าลืมบันทึกเมื่อเริ่ม';
      nextCls = 'text-amber-600';
    }

    const fertileNow = result.predictions.some(function (p) { return todayKey >= p.fertileStart && todayKey <= p.fertileEnd; });
    const phase = inPeriod ? 'ช่วงมีประจำเดือน' : fertileNow ? 'ช่วงเจริญพันธุ์ (ประมาณ)' : 'ช่วงปกติ';

    el.stats.innerHTML =
      statTile('ประจำเดือนครั้งถัดไป', nextValue, nextSub, nextCls) +
      statTile('วันที่ของรอบ', cycleDay ? 'วันที่ ' + cycleDay : '-', phase) +
      statTile('รอบเฉลี่ย', result.cycleLength + ' วัน',
        result.hasHistory ? 'จากข้อมูลที่บันทึก' : 'ค่าที่ตั้งไว้ (ข้อมูลยังไม่พอ)') +
      statTile('ประจำเดือนเฉลี่ย', result.periodLength + ' วัน', null);
  }

  function renderHistory() {
    if (!result.periods.length) {
      el.history.innerHTML = '<li class="text-sm text-gray-500">ยังไม่มีประวัติ</li>';
      return;
    }
    el.history.innerHTML = result.periods.slice().reverse().map(function (p, i, arr) {
      const idx = result.periods.length - 1 - i;
      const gap = idx > 0 ? diffDays(p.start, result.periods[idx - 1].start) : null;
      const range = p.length > 1 ? formatShort(p.start) + ' – ' + formatDate(p.end) : formatDate(p.start);
      const odd = gap !== null && (gap < CYCLE_MIN || gap > CYCLE_MAX);
      return '<li class="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">' +
        '<span><span class="font-medium">' + range + '</span> <span class="text-gray-500">(' + p.length + ' วัน)</span></span>' +
        '<span class="text-xs ' + (odd ? 'text-amber-600' : 'text-gray-500') + '">' +
        (gap !== null ? 'รอบ ' + gap + ' วัน' + (odd ? ' · ไม่ถูกนำมาเฉลี่ย' : '') : 'รอบแรกที่บันทึก') + '</span></li>';
    }).join('');
  }

  function render() {
    el.cycleInput.value = data.cycleLength;
    el.periodInput.value = data.periodLength;
    renderCalendar();
    renderStats();
    renderHistory();
  }

  /* ---------- Events ---------- */
  el.grid.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-date]');
    if (!btn) return;
    const key = btn.dataset.date;
    if (key > todayKey) { toast('บันทึกได้เฉพาะวันนี้และวันที่ผ่านมาแล้ว'); return; }

    const days = new Set(data.days);
    if (days.has(key)) days.delete(key); else days.add(key);
    S.savePeriod(Object.assign({}, data, { days: Array.from(days) }));
    refresh();
  });

  function shiftMonth(delta) {
    const d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    renderCalendar();
  }
  el.prev.addEventListener('click', function () { shiftMonth(-1); });
  el.next.addEventListener('click', function () { shiftMonth(1); });
  el.today.addEventListener('click', function () {
    state.year = now.getFullYear();
    state.month = now.getMonth();
    renderCalendar();
  });

  function saveSettings() {
    S.savePeriod(Object.assign({}, data, {
      cycleLength: el.cycleInput.value,
      periodLength: el.periodInput.value
    }));
    refresh();
    toast('บันทึกการตั้งค่าแล้ว');
  }
  el.cycleInput.addEventListener('change', saveSettings);
  el.periodInput.addEventListener('change', saveSettings);

  el.reset.addEventListener('click', function () {
    if (window.confirm('ล้างข้อมูลรอบเดือนทั้งหมดในเบราว์เซอร์นี้ใช่หรือไม่?\nการกระทำนี้ย้อนกลับไม่ได้ (ถ้ามีไฟล์สำรองไว้ นำเข้ากลับได้)')) {
      S.savePeriod({ days: [], cycleLength: data.cycleLength, periodLength: data.periodLength });
      refresh();
      toast('ล้างข้อมูลรอบเดือนแล้ว');
    }
  });

  window.addEventListener('storage', function (e) { if (e.key === S.PERIOD_KEY) refresh(); });

  render();
})();
