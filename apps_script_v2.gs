// Sistem Tempahan Bilik v2 — Google Apps Script
// Mode: no-cors compatible (return success/error message sahaja)
// Sheet column header: Tarikh | Bilik | Slot | Nama | Telefon | Tujuan | Timestamp | ID
//
// LANGKAH SETUP:
// 1. Buka Google Sheet anda
// 2. Tukar nama tab pertama kepada "Tempahan"
// 3. Pada baris 1, masukkan header berikut (case-sensitive):
//    A: Tarikh    B: Bilik    C: Slot    D: Nama    E: Telefon    F: Tujuan    G: Timestamp    H: ID
// 4. Extensions → Apps Script → tampal kod ini
// 5. Tukar SHEET_ID di bawah dengan ID Google Sheet anda
//    (ID adalah bahagian dalam URL antara /d/ dan /edit)
// 6. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone → Deploy
// 7. Copy URL Web app

// ============================================================
// MASUKKAN ID GOOGLE SHEET ANDA DI SINI
// ID = bahagian URL antara /d/ dan /edit
// Contoh: https://docs.google.com/spreadsheets/d/1aBcDeFgHiJk...XyZ/edit
//          ID adalah: 1aBcDeFgHiJk...XyZ
// ============================================================
const SHEET_ID = 'MASUKKAN_ID_GOOGLE_SHEET_DI_SINI';
const SHEET_NAME = 'Tempahan';

// Set timezone Malaysia
const TIMEZONE = 'Asia/Kuala_Lumpur';

function doGet(e) {
  // Untuk no-cors mode, client guna POST sahaja
  // GET hanya untuk admin baca data
  try {
    const action = e.parameter.action;
    const password = e.parameter.password;

    // Admin endpoint — perlu password
    if (action === 'admin' && password === 'admin123') {
      return jsonOut({ ok: true, bookings: getAllBookings() });
    }

    // Public — hanya bagi senarai tarikh yang sudah penuh
    if (action === 'fullDates') {
      return jsonOut({ ok: true, fullDates: getFullDates() });
    }

    // Public — bagi senarai slot yang ditempah untuk satu tarikh
    if (action === 'dayBookings' && e.parameter.date) {
      return jsonOut({ ok: true, slots: getDayBookings(e.parameter.date) });
    }

    return jsonOut({ ok: false, error: 'Akses tidak dibenarkan' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  // Mode no-cors: client tidak akan baca response, tapi kita tetap return
  // mesej untuk debug & sebagai backup jika mode ditukar
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'create') return jsonOut(createBooking(body.booking));
    if (action === 'delete') {
      // Delete hanya untuk admin
      if (body.password !== 'admin123') {
        return jsonOut({ ok: false, error: 'Akses tidak dibenarkan' });
      }
      return jsonOut(deleteBooking(body.id));
    }
    return jsonOut({ ok: false, error: 'Tindakan tidak diketahui' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ============================================================
// FUNCTIONS
// ============================================================

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}

function getAllBookings() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  return values
    .filter(row => row[0])
    .map(row => ({
      tarikh: formatDate(row[0]),
      bilik: String(row[1] || ''),
      slot: String(row[2] || ''),
      nama: String(row[3] || ''),
      telefon: String(row[4] || '').replace(/^'/, ''),
      tujuan: String(row[5] || ''),
      timestamp: row[6] ? formatDateTime(row[6]) : '',
      id: String(row[7] || ''),
    }));
}

// Berapa bilik & slot total - untuk kira "penuh"
const ROOMS_LIST = ['BMR', 'BMU', 'BMK', 'Dewan Q', 'Dewan Badminton'];
const SLOTS_LIST = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00'];
const TOTAL_SLOTS_PER_DAY = ROOMS_LIST.length * SLOTS_LIST.length;

// Tarikh dikira "penuh" jika SEMUA bilik + SEMUA slot sudah ditempah
function getFullDates() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const counter = {}; // { 'YYYY-MM-DD': Set of 'bilik|slot' }

  values.forEach(row => {
    if (!row[0]) return;
    const tarikh = formatDate(row[0]);
    const bilik = String(row[1] || '');
    const slot = String(row[2] || '');
    if (!counter[tarikh]) counter[tarikh] = new Set();
    // Slot mungkin ada banyak (contoh: "08:00-10:00,10:00-12:00")
    String(slot).split(',').forEach(s => {
      counter[tarikh].add(`${bilik}|${s.trim()}`);
    });
  });

  const fullDates = [];
  Object.keys(counter).forEach(tarikh => {
    if (counter[tarikh].size >= TOTAL_SLOTS_PER_DAY) {
      fullDates.push(tarikh);
    }
  });
  return fullDates;
}

// Bagi maklumat slot yang ditempah untuk satu tarikh
function getDayBookings(date) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const result = []; // [{bilik, slot}, ...]
  values.forEach(row => {
    if (!row[0]) return;
    const tarikh = formatDate(row[0]);
    if (tarikh !== date) return;
    const bilik = String(row[1] || '');
    String(row[2] || '').split(',').forEach(s => {
      result.push({ bilik, slot: s.trim() });
    });
  });
  return result;
}

function createBooking(b) {
  if (!b || !b.tarikh || !b.bilik || !b.slot || !b.nama || !b.telefon) {
    return { ok: false, error: 'Maklumat tidak lengkap' };
  }

  // Server-side conflict check: pastikan slot belum ditempah
  const slotsRequested = String(b.slot).split(',').map(s => s.trim());
  const dayBookings = getDayBookings(b.tarikh);
  for (const requested of slotsRequested) {
    const taken = dayBookings.find(x => x.bilik === b.bilik && x.slot === requested);
    if (taken) {
      return { ok: false, error: `Slot ${requested} untuk ${b.bilik} telah ditempah` };
    }
  }

  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const timestamp = new Date();
  const sheet = getSheet();
  const phone = "'" + String(b.telefon); // simpan sebagai text supaya 0 di hadapan kekal

  sheet.appendRow([
    b.tarikh,
    b.bilik,
    b.slot,
    b.nama,
    phone,
    b.tujuan || '',
    timestamp,
    id,
  ]);

  return { ok: true, message: 'Tempahan berjaya disimpan', id };
}

function deleteBooking(id) {
  if (!id) return { ok: false, error: 'ID tiada' };
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Tempahan tidak dijumpai' };

  const ids = sheet.getRange(2, 8, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { ok: true, message: 'Tempahan dipadam' };
    }
  }
  return { ok: false, error: 'Tempahan tidak dijumpai' };
}

function formatDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
  }
  return String(v);
}

function formatDateTime(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
