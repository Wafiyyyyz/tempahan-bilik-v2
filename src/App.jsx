import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Trash2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Lock, LogOut, ArrowLeft } from 'lucide-react';

// ============================================================
// PENTING: Tukar URL ini kepada URL Apps Script anda
// ============================================================
const APPS_SCRIPT_URL = 'MASUKKAN_URL_APPS_SCRIPT_DI_SINI';

const ROOMS = ['BMR', 'BMU', 'BMK', 'Dewan Q', 'Dewan Badminton'];
const SLOTS = [
  { id: '08:00-10:00', label: '8:00 pagi – 10:00 pagi' },
  { id: '10:00-12:00', label: '10:00 pagi – 12:00 tgh' },
  { id: '12:00-14:00', label: '12:00 tgh – 2:00 ptg' },
  { id: '14:00-16:00', label: '2:00 ptg – 4:00 ptg' },
];

const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const HARI_PENDEK = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

// Format Malaysia (GMT+8) date as YYYY-MM-DD
function todayMY() {
  const now = new Date();
  // Malaysia is GMT+8
  const my = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  return formatYMD(my);
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [page, setPage] = useState('client'); // 'client' | 'admin-login' | 'admin'

  return (
    <div className="min-h-screen bg-stone-50">
      {page === 'client' && <ClientView onAdminClick={() => setPage('admin-login')} />}
      {page === 'admin-login' && (
        <AdminLogin
          onSuccess={() => setPage('admin')}
          onBack={() => setPage('client')}
        />
      )}
      {page === 'admin' && <AdminView onLogout={() => setPage('client')} />}
    </div>
  );
}

// ============================================================
// CLIENT VIEW
// ============================================================
function ClientView({ onAdminClick }) {
  const today = todayMY();
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(today + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [fullDates, setFullDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayBookings, setDayBookings] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [success, setSuccess] = useState(null);
  const [toast, setToast] = useState(null);

  // Form state
  const [room, setRoom] = useState(ROOMS[0]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [nama, setNama] = useState('');
  const [telefon, setTelefon] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load full dates on mount + when month changes
  useEffect(() => { loadFullDates(); }, []);

  const loadFullDates = async () => {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=fullDates`);
      const data = await res.json();
      if (data.ok) setFullDates(data.fullDates || []);
    } catch (e) {
      // silent fail — calendar still works
    }
  };

  const loadDayBookings = async (date) => {
    setLoadingDay(true);
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=dayBookings&date=${date}`);
      const data = await res.json();
      if (data.ok) setDayBookings(data.slots || []);
      else setDayBookings([]);
    } catch (e) {
      setDayBookings([]);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleDateClick = (date) => {
    if (date < today) return; // tarikh lepas
    if (fullDates.includes(date)) return; // penuh
    setSelectedDate(date);
    setSelectedSlots([]);
    setRoom(ROOMS[0]);
    setNama('');
    setTelefon('');
    setTujuan('');
    loadDayBookings(date);
  };

  const isSlotTaken = (bilik, slotId) =>
    dayBookings.some(b => b.bilik === bilik && b.slot === slotId);

  const toggleSlot = (slotId) => {
    if (isSlotTaken(room, slotId)) return;
    setSelectedSlots(prev =>
      prev.includes(slotId) ? prev.filter(s => s !== slotId) : [...prev, slotId]
    );
  };

  // Bila tukar bilik, buang slot yang tidak available untuk bilik baru
  const handleRoomChange = (newRoom) => {
    setRoom(newRoom);
    setSelectedSlots(prev => prev.filter(s => !dayBookings.some(b => b.bilik === newRoom && b.slot === s)));
  };

  const isValidPhone = (p) => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  };

  const handleSubmit = async () => {
    if (!nama.trim()) return showToast('Sila masukkan nama', 'error');
    if (!telefon.trim()) return showToast('Sila masukkan no. telefon', 'error');
    if (!isValidPhone(telefon)) return showToast('No. telefon tidak sah', 'error');
    if (selectedSlots.length === 0) return showToast('Sila pilih sekurang-kurangnya satu slot masa', 'error');
    if (!tujuan.trim()) return showToast('Sila masukkan tujuan', 'error');

    setSubmitting(true);
    try {
      // Mode no-cors: response tak boleh dibaca, tapi data tetap dihantar
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'create',
          booking: {
            tarikh: selectedDate,
            bilik: room,
            slot: selectedSlots.sort().join(','),
            nama: nama.trim(),
            telefon: telefon.trim(),
            tujuan: tujuan.trim(),
          },
        }),
      });

      // Anggap berjaya kerana mode no-cors tidak boleh baca response
      setSuccess({
        tarikh: selectedDate,
        bilik: room,
        slots: [...selectedSlots].sort(),
        nama: nama.trim(),
        telefon: telefon.trim(),
        tujuan: tujuan.trim(),
      });

      // Reload data
      setTimeout(() => {
        loadFullDates();
      }, 1500);
    } catch (e) {
      showToast('Ralat: ' + e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // SUCCESS PAGE
  // ============================================================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-medium text-center text-stone-900 mb-2">Tempahan anda telah dihantar</h2>
          <p className="text-center text-stone-600 text-sm mb-6">Sila simpan butiran berikut sebagai rujukan.</p>
          <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm mb-6">
            <Row label="Bilik" value={success.bilik} />
            <Row label="Tarikh" value={formatDateLong(success.tarikh)} />
            <Row label="Masa" value={success.slots.map(s => SLOTS.find(x => x.id === s)?.label || s).join(', ')} />
            <Row label="Nama" value={success.nama} />
            <Row label="Telefon" value={success.telefon} />
            <Row label="Tujuan" value={success.tujuan} />
          </div>
          <button
            onClick={() => { setSuccess(null); setSelectedDate(null); }}
            className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition-colors"
          >
            Tempahan baharu
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // BOOKING FORM (after date selected)
  // ============================================================
  if (selectedDate) {
    return (
      <div className="p-4 md:p-8" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setSelectedDate(null)}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke kalendar
          </button>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-medium text-stone-900 mb-1">Tempahan baharu</h2>
            <p className="text-stone-600 mb-6">{formatDateLong(selectedDate)}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Bilik</label>
                <select
                  value={room}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 outline-none focus:border-stone-900"
                >
                  {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Slot masa <span className="text-stone-500 font-normal">(boleh pilih lebih dari satu untuk tempahan lebih panjang)</span>
                </label>
                {loadingDay ? (
                  <div className="text-sm text-stone-500 py-3">Memeriksa slot…</div>
                ) : (
                  <div className="space-y-2">
                    {SLOTS.map(slot => {
                      const taken = isSlotTaken(room, slot.id);
                      const checked = selectedSlots.includes(slot.id);
                      return (
                        <label
                          key={slot.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            taken
                              ? 'bg-stone-100 border-stone-200 cursor-not-allowed opacity-60'
                              : checked
                                ? 'bg-green-50 border-green-400 cursor-pointer'
                                : 'bg-white border-stone-300 hover:border-stone-500 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={taken}
                            onChange={() => toggleSlot(slot.id)}
                            className="w-4 h-4"
                          />
                          <Clock className="w-4 h-4 text-stone-500" />
                          <span className="flex-1 text-sm text-stone-900">{slot.label}</span>
                          {taken && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                              Telah ditempah
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Nama penuh</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama penuh anda"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">No. telefon</label>
                <input
                  type="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="cth. 012-345 6789"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Tujuan tempahan</label>
                <input
                  type="text"
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                  placeholder="cth. Mesyuarat jabatan, latihan"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 outline-none focus:border-stone-900"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 mt-2"
              >
                {submitting ? 'Menghantar…' : 'Tempah sekarang'}
              </button>
            </div>
          </div>

          {toast && <Toast toast={toast} />}
        </div>
      </div>
    );
  }

  // ============================================================
  // CALENDAR VIEW (default)
  // ============================================================
  return (
    <div className="p-4 md:p-8" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium text-stone-900 mb-1">Tempahan Bilik</h1>
            <p className="text-stone-600 text-sm">Pilih tarikh dari kalendar untuk membuat tempahan</p>
          </div>
          <button
            onClick={onAdminClick}
            className="text-stone-500 hover:text-stone-900 text-sm flex items-center gap-1.5"
            title="Admin"
          >
            <Lock className="w-3.5 h-3.5" /> Admin
          </button>
        </div>

        <CalendarMonth
          year={viewMonth.year}
          month={viewMonth.month}
          today={today}
          fullDates={fullDates}
          onDateClick={handleDateClick}
          onPrev={() => {
            const m = viewMonth.month - 1;
            setViewMonth(m < 0 ? { year: viewMonth.year - 1, month: 11 } : { year: viewMonth.year, month: m });
          }}
          onNext={() => {
            const m = viewMonth.month + 1;
            setViewMonth(m > 11 ? { year: viewMonth.year + 1, month: 0 } : { year: viewMonth.year, month: m });
          }}
        />

        {/* Legend */}
        <div className="mt-4 bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-400"></div>
            <span className="text-stone-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-400"></div>
            <span className="text-stone-700">Not available (penuh)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-stone-100 border border-stone-200"></div>
            <span className="text-stone-700">Tarikh lepas</span>
          </div>
        </div>
      </div>

      {toast && <Toast toast={toast} />}
    </div>
  );
}

// ============================================================
// CALENDAR COMPONENT
// ============================================================
function CalendarMonth({ year, month, today, fullDates, onDateClick, onPrev, onNext }) {
  // Build grid
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  // Leading blanks
  for (let i = 0; i < firstDay; i++) cells.push(null);
  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }
  // Trailing blanks to fill 6 weeks (42 cells)
  while (cells.length < 42) cells.push(null);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <button onClick={onPrev} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-stone-700" />
        </button>
        <h2 className="text-lg font-medium text-stone-900">{BULAN[month]} {year}</h2>
        <button onClick={onNext} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-stone-700" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
        {HARI_PENDEK.map(d => (
          <div key={d} className="p-2 text-center text-xs font-medium text-stone-500 uppercase tracking-wide">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((dateStr, i) => {
          if (!dateStr) {
            return <div key={i} className="aspect-square border-b border-r border-stone-100 bg-stone-50/50"></div>;
          }
          const day = parseInt(dateStr.slice(8), 10);
          const isPast = dateStr < today;
          const isToday = dateStr === today;
          const isFull = fullDates.includes(dateStr);
          const isAvailable = !isPast && !isFull;

          let cellStyle = '';
          if (isPast) {
            cellStyle = 'bg-stone-100 text-stone-400 cursor-not-allowed';
          } else if (isFull) {
            cellStyle = 'bg-red-100 text-red-700 cursor-not-allowed border-red-300';
          } else {
            cellStyle = 'bg-green-50 text-green-900 cursor-pointer hover:bg-green-100 border-green-300';
          }

          return (
            <button
              key={i}
              onClick={() => isAvailable && onDateClick(dateStr)}
              disabled={!isAvailable}
              className={`aspect-square border-b border-r border-stone-100 flex flex-col items-center justify-center transition-colors p-1 relative ${cellStyle}`}
            >
              <div className={`text-base font-medium ${isToday ? 'ring-2 ring-stone-900 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                {day}
              </div>
              {isFull && <div className="text-[10px] mt-0.5 font-medium">Penuh</div>}
              {isAvailable && <div className="text-[10px] mt-0.5 text-green-700">Available</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN LOGIN
// ============================================================
function AdminLogin({ onSuccess, onBack }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (id === 'admin' && pw === 'admin123') {
      // Store password in sessionStorage so admin view can use it
      sessionStorage.setItem('admin_pw', pw);
      onSuccess();
    } else {
      setError('ID atau password salah');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-sm w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
            <Lock className="w-6 h-6 text-stone-700" />
          </div>
        </div>
        <h2 className="text-xl font-medium text-center text-stone-900 mb-1">Admin login</h2>
        <p className="text-center text-stone-500 text-sm mb-5">Masukkan kredential admin</p>

        <div className="space-y-3">
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ID"
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 outline-none focus:border-stone-900"
          />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 outline-none focus:border-stone-900"
          />
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-stone-900 text-white py-2.5 rounded-lg font-medium hover:bg-stone-800 transition-colors"
          >
            Log masuk
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN VIEW
// ============================================================
function AdminView({ onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'all' | 'past'
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const pw = sessionStorage.getItem('admin_pw') || 'admin123';
      const res = await fetch(`${APPS_SCRIPT_URL}?action=admin&password=${encodeURIComponent(pw)}`);
      const data = await res.json();
      if (data.ok) {
        const sorted = (data.bookings || []).sort((a, b) => {
          if (a.tarikh !== b.tarikh) return b.tarikh.localeCompare(a.tarikh);
          return (a.slot || '').localeCompare(b.slot || '');
        });
        setBookings(sorted);
      } else {
        showToast(data.error || 'Gagal memuat data', 'error');
      }
    } catch (e) {
      showToast('Ralat rangkaian', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Padam tempahan ini?')) return;
    try {
      const pw = sessionStorage.getItem('admin_pw') || 'admin123';
      // For delete we need to read response, so use cors mode
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', id, password: pw }),
      });
      // Anggap berjaya & reload
      setTimeout(load, 800);
      showToast('Tempahan dipadam', 'success');
    } catch (e) {
      showToast('Ralat: ' + e.message, 'error');
    }
  };

  const today = todayMY();
  const filtered = bookings.filter(b => {
    if (filter === 'upcoming') return b.tarikh >= today;
    if (filter === 'past') return b.tarikh < today;
    return true;
  });

  return (
    <div className="p-4 md:p-8" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-medium text-stone-900 mb-1">Panel Admin</h1>
            <p className="text-stone-600 text-sm">Senarai semua tempahan</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('admin_pw'); onLogout(); }}
            className="text-stone-600 hover:text-stone-900 text-sm flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Log keluar
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {['upcoming', 'all', 'past'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-stone-900 text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {f === 'upcoming' ? 'Akan datang' : f === 'past' ? 'Lepas' : 'Semua'}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-white border border-stone-300 text-stone-700 hover:bg-stone-50"
          >
            Muat semula
          </button>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-stone-500">Memuatkan…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <div className="text-sm">Tiada tempahan</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <Th>Tarikh</Th>
                    <Th>Bilik</Th>
                    <Th>Slot</Th>
                    <Th>Nama</Th>
                    <Th>Telefon</Th>
                    <Th>Tujuan</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50">
                      <Td>{formatDateShort(b.tarikh)}</Td>
                      <Td><span className="font-medium">{b.bilik}</span></Td>
                      <Td className="text-xs">{b.slot}</Td>
                      <Td>{b.nama}</Td>
                      <Td>
                        <a href={`tel:${b.telefon}`} className="text-stone-600 hover:text-stone-900">{b.telefon}</a>
                      </Td>
                      <Td className="text-stone-600">{b.tujuan}</Td>
                      <Td>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="text-stone-400 hover:text-red-600 transition-colors p-1.5"
                          title="Padam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast toast={toast} />}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================
function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-stone-500 shrink-0">{label}:</span>
      <span className="text-stone-900 text-right">{value}</span>
    </div>
  );
}

function Th({ children }) {
  return <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">{children}</th>;
}

function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 text-stone-900 ${className}`}>{children}</td>;
}

function Toast({ toast }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
        toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
      }`}>
        {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        {toast.msg}
      </div>
    </div>
  );
}

// ============================================================
// FORMATTERS
// ============================================================
function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const bulanPendek = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  return `${d.getDate()} ${bulanPendek[d.getMonth()]} ${d.getFullYear()}`;
}
