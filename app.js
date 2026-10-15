/* ==========================================================
   หน้าหลัก — รายการวันที่ของเดือน + เลือกกะ + เวลาทานอาหาร
   ========================================================== */
(function () {
  'use strict';

  const S = window.MakroStore;
  const $ = function (sel) { return document.querySelector(sel); };
  const esc = S.escapeHtml;

  const now = new Date();
  const state = { year: now.getFullYear(), month: now.getMonth() };
  let shifts = [];
  let schedule = {};

  const el = {
    month: $('#month-select'),
    year: $('#year-select'),
    prev: $('#prev-month'),
    next: $('#next-month'),
    today: $('#today-btn'),
    print: $('#print-btn'),
    clear: $('#clear-btn'),
    title: $('#period-title'),
    summary: $('#summary'),
    list: $('#day-list'),
    hint: $('#empty-hint')
  };

  /* ---------- Selectors ---------- */
  function initSelectors() {
    el.month.innerHTML = S.THAI_MONTHS.map(function (name, i) {
      return '<option value="' + i + '">' + name + '</option>';
    }).join('');

    const base = now.getFullYear();
    let years = '';
    for (let y = base - 5; y <= base + 5; y++) {
      years += '<option value="' + y + '">พ.ศ. ' + S.toBuddhistYear(y) + '</option>';
    }
    el.year.innerHTML = years;
  }

  function shiftMonth(delta) {
    const d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    render();
  }

  /* ---------- Rendering ---------- */
  function findShift(id) {
    return shifts.find(function (s) { return s.id === id; });
  }

  function optionsHtml(selectedId) {
    return '<option value="">— เลือกกะ —</option>' + shifts.map(function (s) {
      const label = s.isOff ? s.name : s.name + ' (' + s.start + '–' + s.end + ')';
      return '<option value="' + esc(s.id) + '"' + (s.id === selectedId ? ' selected' : '') + '>' +
        esc(label) + '</option>';
    }).join('');
  }

  function rowHtml(day, todayKey) {
    const date = new Date(state.year, state.month, day);
    const dow = date.getDay();
    const key = S.dateKey(state.year, state.month, day);
    const entry = schedule[key] || {};
    const shift = findShift(entry.shiftId);
    const isToday = key === todayKey;
    const weekend = dow === 0 || dow === 6;

    const dateBox = isToday
      ? 'bg-makro text-white'
      : weekend ? 'bg-makro-light text-makro' : 'bg-surface text-ink';
    const accent = shift ? S.safeColor(shift.color) : '#E5E7EB';
    const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ' +
      'focus:outline-none focus:ring-2 focus:ring-makro/40 focus:border-makro disabled:bg-gray-100 disabled:text-gray-400';

    return '' +
      '<li data-date="' + key + '" class="day-row bg-white rounded-xl border border-gray-200 border-l-4 p-3 ' +
      'flex flex-col gap-3" style="border-left-color:' + accent + '">' +
      '<div class="flex flex-col gap-3 md:flex-row md:items-center">' +
        '<div class="flex items-center gap-3 md:w-64 shrink-0">' +
          '<div class="w-12 h-12 rounded-xl flex flex-col items-center justify-center ' + dateBox + '">' +
            '<span class="text-lg font-bold leading-none">' + day + '</span>' +
            '<span class="text-[10px] mt-0.5">' + S.THAI_DAYS_SHORT[dow] + '</span>' +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="text-sm font-semibold ' + (weekend ? 'text-makro' : 'text-ink') + '">' +
              'วัน' + S.THAI_DAYS[dow] +
              (isToday ? ' <span class="ml-1 rounded bg-makro px-1.5 py-0.5 text-[10px] font-medium text-white">วันนี้</span>' : '') +
            '</div>' +
            '<div class="badge-slot mt-1">' + S.badgeHtml(shift, true) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">' +
          '<label class="block"><span class="mb-1 block text-xs text-gray-500">กะทำงาน</span>' +
            '<select class="shift-select ' + inputCls + '" aria-label="เลือกกะวันที่ ' + day + '">' +
              optionsHtml(entry.shiftId) + '</select></label>' +
          '<label class="block"><span class="mb-1 block text-xs text-gray-500">เวลาทานอาหาร</span>' +
            '<input type="time" class="meal-input ' + inputCls + '" value="' + esc(entry.meal || '') + '"' +
            (shift && shift.isOff ? ' disabled' : '') + ' aria-label="เวลาทานอาหารวันที่ ' + day + '"></label>' +
        '</div>' +
      '</div>' +
      '<div class="grid grid-cols-1 gap-2 md:grid-cols-2">' +
        '<label class="block"><span class="mb-1 block text-xs font-medium text-emerald-700">✅ วันนี้ทำอะไรสำเร็จ</span>' +
          '<textarea rows="2" maxlength="' + S.NOTE_MAX + '" placeholder="จดสิ่งที่ทำสำเร็จในวันนี้…" ' +
          'class="note-good w-full resize-y rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm ' +
          'placeholder:text-emerald-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500" ' +
          'aria-label="โน้ตสิ่งที่ทำสำเร็จวันที่ ' + day + '">' + esc(entry.good || '') + '</textarea></label>' +
        '<label class="block"><span class="mb-1 block text-xs font-medium text-red-700">⚠️ วันนี้ทำอะไรไม่ดี</span>' +
          '<textarea rows="2" maxlength="' + S.NOTE_MAX + '" placeholder="จดสิ่งที่ยังทำได้ไม่ดีในวันนี้…" ' +
          'class="note-bad w-full resize-y rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm ' +
          'placeholder:text-red-700/50 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500" ' +
          'aria-label="โน้ตสิ่งที่ทำไม่ดีวันที่ ' + day + '">' + esc(entry.bad || '') + '</textarea></label>' +
      '</div>' +
      '</li>';
  }

  function renderSummary() {
    const total = S.daysInMonth(state.year, state.month);
    const counts = {};
    let work = 0, off = 0, unassigned = 0;

    for (let d = 1; d <= total; d++) {
      const entry = schedule[S.dateKey(state.year, state.month, d)] || {};
      const shift = findShift(entry.shiftId);
      if (!shift) { unassigned++; continue; }
      counts[shift.id] = (counts[shift.id] || 0) + 1;
      if (shift.isOff) off++; else work++;
    }

    const tile = function (label, value, cls) {
      return '<div class="rounded-xl bg-white border border-gray-200 p-3">' +
        '<div class="text-xs text-gray-500">' + label + '</div>' +
        '<div class="text-2xl font-bold ' + cls + '">' + value + '</div></div>';
    };

    const chips = shifts.filter(function (s) { return counts[s.id]; }).map(function (s) {
      return S.badgeHtml(s, false).replace('</span>', ' × ' + counts[s.id] + '</span>');
    }).join(' ');

    el.summary.innerHTML =
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
        tile('ทั้งเดือน (วัน)', total, 'text-ink') +
        tile('วันทำงาน', work, 'text-makro') +
        tile('วันหยุด (OFF)', off, 'text-ink') +
        tile('ยังไม่ได้เลือกกะ', unassigned, unassigned ? 'text-amber-600' : 'text-ink') +
      '</div>' +
      (chips ? '<div class="mt-3 flex flex-wrap gap-2">' + chips + '</div>' : '');
  }

  function render() {
    shifts = S.getShifts();
    schedule = S.getSchedule();

    el.month.value = String(state.month);
    el.year.value = String(state.year);
    el.title.textContent = S.THAI_MONTHS[state.month] + ' พ.ศ. ' + S.toBuddhistYear(state.year);
    el.hint.classList.toggle('hidden', shifts.length > 0);

    const total = S.daysInMonth(state.year, state.month);
    const todayKey = S.dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    let html = '';
    for (let d = 1; d <= total; d++) html += rowHtml(d, todayKey);
    el.list.innerHTML = html;
    renderSummary();
  }

  /* อัปเดตเฉพาะแถวที่แก้ไข เพื่อไม่ให้หน้าเด้ง */
  function refreshRow(li) {
    const entry = schedule[li.dataset.date] || {};
    const shift = findShift(entry.shiftId);
    li.style.borderLeftColor = shift ? S.safeColor(shift.color) : '#E5E7EB';
    li.querySelector('.badge-slot').innerHTML = S.badgeHtml(shift, true);
    const meal = li.querySelector('.meal-input');
    meal.disabled = !!(shift && shift.isOff);
    meal.value = entry.meal || '';
  }

  /* ---------- Events ---------- */
  el.list.addEventListener('change', function (e) {
    const li = e.target.closest('li[data-date]');
    if (!li) return;
    const key = li.dataset.date;

    if (e.target.matches('.shift-select')) {
      const shift = findShift(e.target.value);
      const patch = { shiftId: e.target.value };
      if (shift && shift.isOff) patch.meal = ''; // วันหยุดไม่ต้องมีเวลาทานอาหาร
      S.setDay(key, patch);
    } else if (e.target.matches('.meal-input')) {
      S.setDay(key, { meal: e.target.value });
    } else {
      return;
    }

    schedule = S.getSchedule();
    refreshRow(li);
    renderSummary();
  });

  // โน้ตรายวัน: บันทึกทุกครั้งที่พิมพ์ (ไม่ re-render เพื่อไม่ให้เคอร์เซอร์เด้ง)
  el.list.addEventListener('input', function (e) {
    const isGood = e.target.matches('.note-good');
    if (!isGood && !e.target.matches('.note-bad')) return;
    const li = e.target.closest('li[data-date]');
    if (!li) return;
    S.setDay(li.dataset.date, isGood ? { good: e.target.value } : { bad: e.target.value });
  });

  el.month.addEventListener('change', function () { state.month = Number(el.month.value); render(); });
  el.year.addEventListener('change', function () { state.year = Number(el.year.value); render(); });
  el.prev.addEventListener('click', function () { shiftMonth(-1); });
  el.next.addEventListener('click', function () { shiftMonth(1); });

  el.today.addEventListener('click', function () {
    state.year = now.getFullYear();
    state.month = now.getMonth();
    render();
    const row = el.list.querySelector('li[data-date="' + S.dateKey(state.year, state.month, now.getDate()) + '"]');
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  el.print.addEventListener('click', function () { window.print(); });

  el.clear.addEventListener('click', function () {
    const label = S.THAI_MONTHS[state.month] + ' พ.ศ. ' + S.toBuddhistYear(state.year);
    if (window.confirm('ล้างข้อมูลกะ เวลาทานอาหาร และโน้ตทั้งหมดของ ' + label + ' ใช่หรือไม่?')) {
      S.clearMonth(state.year, state.month);
      render();
    }
  });

  // ซิงก์เมื่อแก้ไขจากแท็บอื่น หรือกลับมาจากหน้าตั้งค่า
  window.addEventListener('storage', function (e) {
    if (e.key === S.SHIFTS_KEY || e.key === S.SCHEDULE_KEY) render();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });

  initSelectors();
  render();
})();
