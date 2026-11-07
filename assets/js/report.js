import { getPhoto } from "./database.js";
import { escapeHTML, formatDate, formatDuration, localDateISO } from "./ui.js";
import { exportBackup } from "./settings.js";

let getRecords, getSettings;
let reportUrls = [];

export function initReport(options) {
  ({ getRecords, getSettings } = options);
  const input = document.getElementById("report-month");
  input.value = localDateISO().slice(0, 7);
  input.addEventListener("change", renderReport);
  document.getElementById("print-report").addEventListener("click", () => window.print());
  document.getElementById("report-export").addEventListener("click", exportBackup);
  renderReport();
}

export async function renderReport() {
  reportUrls.forEach((url) => URL.revokeObjectURL(url));
  reportUrls = [];
  const month = document.getElementById("report-month").value || localDateISO().slice(0, 7);
  const records = getRecords().filter((record) => record.date.startsWith(month))
    .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
  const minutes = records.reduce((sum, record) => sum + record.duration, 0);
  const teachingDays = new Set(records.map((record) => record.date)).size;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  const settings = getSettings();
  const entryHtml = await Promise.all(records.map(async (record) => {
    const photos = await Promise.all((record.photoIds || []).map(getPhoto));
    const images = photos.filter(Boolean);
    return `<article class="report-entry"><h3>${escapeHTML(formatDate(record.date))} · ${escapeHTML(record.title)}</h3><p>${escapeHTML(record.start)}–${escapeHTML(record.end)} · ${escapeHTML(formatDuration(record.duration))}</p><p><strong>Materi:</strong> ${escapeHTML(record.material)}</p>${record.notes ? `<p><strong>Catatan:</strong> ${escapeHTML(record.notes)}</p>` : ""}${images.length ? `<div class="report-photos">${images.map((photo) => { const url = URL.createObjectURL(photo.blob); reportUrls.push(url); return `<img src="${url}" alt="Dokumentasi kegiatan">`; }).join("")}</div>` : ""}</article>`;
  }));
  document.getElementById("report-content").innerHTML = `
    <header class="report-head"><p class="eyebrow">${escapeHTML(settings.appName)}</p><h2>Laporan Mengajar</h2><p class="muted">${escapeHTML(monthName)} · Pengajar: ${escapeHTML(settings.teacherName)}</p></header>
    <div class="report-stats"><div class="report-stat"><strong>${records.length}</strong><span>Total pertemuan</span></div><div class="report-stat"><strong>${teachingDays}</strong><span>Hari mengajar</span></div><div class="report-stat"><strong>${escapeHTML(formatDuration(minutes))}</strong><span>Total durasi</span></div><div class="report-stat"><strong>${escapeHTML(formatDuration(records.length ? Math.round(minutes / records.length) : 0))}</strong><span>Rata-rata sesi</span></div></div>
    <h3 style="font-size:14px">Daftar kegiatan</h3>${entryHtml.length ? entryHtml.join("") : '<div class="empty-state">Belum ada catatan pada bulan ini.</div>'}`;
}
