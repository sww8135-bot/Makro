/* ==========================================================
   หน้าตั้งค่าหลังบ้าน — จัดการรูปแบบกะ (เพิ่ม/แก้ไข/ลบ) + สำรองข้อมูล
   ========================================================== */
(function () {
  'use strict';

  const S = window.MakroStore;
  const $ = function (sel) { return document.querySelector(sel); };
  const esc = S.escapeHtml;

  const PRESET_COLORS = [
    '#E31837', '#EA580C', '#F59E0B', '#059669', '#0891B2',
    '#2563EB', '#7C3AED', '#DB2777', '#6B7280', '#111827'
  ];

  const el = {
    list: $('#shift-list'),
    add: $('#add-shift-btn'),
    dialog: $('#shift-dialog'),
    form: $('#shift-form'),
    title: $('#dialog-title'),
    name: $('#f-name'),
    off: $('#f-off'),
    start: $('#f-start'),
    end: $('#f-end'),
    timeGroup: $('#f-time-group'),
    color: $('#f-color'),
    swatches: $('#swatches'),
    cancel: $('#cancel-btn'),
    reset: $('#reset-btn'),
    exportBtn: $('#export-btn'),
    importFile: $('#import-file'),
    toast: $('#toast')
  };

  let editingId = null;
  let toastTimer = null;

  /* ---------- Toast ---------- */
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.add('opacity-0', 'translate-y-2');
    }, 2200);
  }

  /* ---------- List ---------- */
  function render() {
    const shifts = S.getShifts();
    if (!shifts.length) {
      el.list.innerHTML =
        '<li class="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">' +
        'ยังไม่มีรูปแบบกะ — กด "เพิ่มรูปแบบกะ" เพื่อเริ่มต้น</li>';
      return;
    }

    el.list.innerHTML = shifts.map(function (s) {
      const used = S.countUsage(s.id);
      return '' +
        '<li class="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">' +
          '<span class="w-2 h-12 rounded-full shrink-0" style="background:' + S.safeColor(s.color) + '"></span>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<span class="font-semibold text-ink">' + esc(s.name) + '</span>' + S.badgeHtml(s, false) +
            '</div>' +
            '<p class="mt-1 text-xs text-gray-500">' + esc(S.formatRange(s)) + ' · ใช้ในตารางแล้ว ' + used + ' วัน</p>' +
          '</div>' +
          '<div class="flex shrink-0 gap-2">' +
            '<button type="button" data-action="edit" data-id="' + esc(s.id) + '" ' +
              'class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-surface">แก้ไข</button>' +
            '<button type="button" data-action="delete" data-id="' + esc(s.id) + '" ' +
              'class="rounded-lg border border-makro/40 px-3 py-1.5 text-sm text-makro hover:bg-makro-light">ลบ</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  /* ---------- Dialog ---------- */
  function renderSwatches(selected) {
    el.swatches.innerHTML = PRESET_COLORS.map(function (c) {
      const active = c.toLowerCase() === String(selected).toLowerCase();
      return '<button type="button" data-color="' + c + '" aria-label="สี ' + c + '" ' +
        'class="h-8 w-8 rounded-full border-2 ' + (active ? 'border-ink ring-2 ring-offset-1 ring-ink/30' : 'border-white shadow') + '" ' +
        'style="background:' + c + '"></button>';
    }).join('');
  }

  function setColor(hex) {
    const color = S.safeColor(hex);
    el.color.value = color;
    renderSwatches(color);
  }

  function syncOff() {
    const off = el.off.checked;
    el.timeGroup.classList.toggle('hidden', off);
    el.start.required = !off;
    el.end.required = !off;
  }

  function openDialog(shift) {
    editingId = shift ? shift.id : null;
    el.title.textContent = shift ? 'แก้ไขรูปแบบกะ' : 'เพิ่มรูปแบบกะ';
    el.name.value = shift ? shift.name : '';
    el.off.checked = shift ? !!shift.isOff : false;
    el.start.value = shift && shift.start ? shift.start : '06:00';
    el.end.value = shift && shift.end ? shift.end : '15:00';
    setColor(shift ? shift.color : PRESET_COLORS[0]);
    syncOff();
    el.dialog.showModal();
    el.name.focus();
  }

  /* ---------- Events ---------- */
  el.add.addEventListener('click', function () { openDialog(null); });
  el.cancel.addEventListener('click', function () { el.dialog.close(); });
  el.dialog.addEventListener('click', function (e) { if (e.target === el.dialog) el.dialog.close(); });
  el.off.addEventListener('change', syncOff);
  el.color.addEventListener('input', function () { renderSwatches(el.color.value); });

  el.swatches.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-color]');
    if (btn) setColor(btn.dataset.color);
  });

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = el.name.value.trim();
    if (!name) { el.name.focus(); return; }

    S.upsertShift({
      id: editingId,
      name: name,
      isOff: el.off.checked,
      start: el.start.value,
      end: el.end.value,
      color: el.color.value
    });
    el.dialog.close();
    render();
    toast(editingId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรูปแบบกะแล้ว');
  });

  el.list.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const shift = S.getShifts().find(function (s) { return s.id === btn.dataset.id; });
    if (!shift) return;

    if (btn.dataset.action === 'edit') {
      openDialog(shift);
    } else if (btn.dataset.action === 'delete') {
      const used = S.countUsage(shift.id);
      const note = used ? '\n\nมี ' + used + ' วันในตารางที่ใช้กะนี้ และจะกลับเป็น "ยังไม่ได้เลือกกะ"' : '';
      if (window.confirm('ลบรูปแบบกะ "' + shift.name + '" ใช่หรือไม่?' + note)) {
        S.deleteShift(shift.id);
        render();
        toast('ลบรูปแบบกะแล้ว');
      }
    }
  });

  el.reset.addEventListener('click', function () {
    if (window.confirm('รีเซ็ตรูปแบบกะกลับเป็นค่าเริ่มต้น (กะเช้า / กะบ่าย / OFF) ใช่หรือไม่?\nรูปแบบกะที่สร้างเองจะถูกลบ')) {
      S.resetShifts();
      render();
      toast('รีเซ็ตเป็นค่าเริ่มต้นแล้ว');
    }
  });

  /* ---------- Backup / Restore ---------- */
  el.exportBtn.addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(S.exportData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = 'makro-shift-backup-' + d.getFullYear() + '-' + S.pad(d.getMonth() + 1) + '-' + S.pad(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
  });

  el.importFile.addEventListener('change', function () {
    const file = el.importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const ok = S.importData(JSON.parse(reader.result));
        if (ok) { render(); toast('นำเข้าข้อมูลสำเร็จ'); } else { toast('ไฟล์ไม่ถูกต้อง'); }
      } catch (err) {
        toast('อ่านไฟล์ไม่สำเร็จ');
      }
      el.importFile.value = '';
    };
    reader.readAsText(file);
  });

  render();
})();
