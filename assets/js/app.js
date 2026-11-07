import { getAttendances, getPhoto } from "./database.js";
import { initAttendance, openRecordDetail, renderSessionRows, startNewAttendance } from "./attendance.js";
import { initCalendar, renderCalendar } from "./calendar.js";
import { initGallery, renderGallery } from "./gallery.js";
import { initReport, renderReport } from "./report.js";
import { getSettings, initSettings } from "./settings.js";
import { formatDate, formatDuration, localDateISO, releaseObjectUrls, renderIcons, replaceList, sortNewest } from "./ui.js";

let records = [];
let toastTimer;

function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function showPage(name) {
  const pageName = name === "profile" ? "settings" : name;
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${pageName}`));
  document.querySelectorAll(".nav-item[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });
  if (pageName === "calendar") renderCalendar();
  if (pageName === "gallery") renderGallery();
  if (pageName === "report") renderReport();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDetail(record) {
  if (record) openRecordDetail(record, refreshData);
}

async function refreshData() {
  try {
    records = await getAttendances();
    await renderDashboard();
    await renderHistory();
    await renderCalendar();
    await renderGallery();
    await renderReport();
  } catch (error) {
    notify(`Data tidak dapat dimuat: ${error.message}`);
    throw error;
  }
}

async function renderDashboard() {
  const now = new Date();
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(now);
  document.getElementById("month-heading").textContent = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now);
  const currentMonth = localDateISO(now).slice(0, 7);
  const current = records.filter((record) => record.date.startsWith(currentMonth));
  const minutes = current.reduce((sum, record) => sum + record.duration, 0);
  document.getElementById("stat-sessions").textContent = current.length;
  document.getElementById("stat-hours").textContent = formatDuration(minutes);
  document.getElementById("stat-days").textContent = new Set(current.map((record) => record.date)).size;
  document.getElementById("stat-average").textContent = formatDuration(current.length ? Math.round(minutes / current.length) : 0);

  const lastCard = document.getElementById("last-session-card");
  if (lastCard.dataset.photoUrl) URL.revokeObjectURL(lastCard.dataset.photoUrl);
  lastCard.dataset.photoUrl = "";
  const latest = sortNewest(records)[0];
  if (!latest) {
    lastCard.innerHTML = '<span class="session-mark">✦</span><div class="session-info"><h3>Belum ada aktivitas mengajar</h3><p>Catatan pertama Anda akan muncul di sini.</p></div>';
  } else {
    const photoId = latest.photoIds?.[0];
    const image = photoId ? await getPhoto(photoId) : undefined;
    const url = image ? URL.createObjectURL(image.blob) : "";
    lastCard.dataset.photoUrl = url;
    const thumb = image ? `<img class="session-thumb" src="${url}" alt="">` : '<span class="session-mark">✦</span>';
    lastCard.innerHTML = `${thumb}<div class="session-info"><p class="eyebrow">AKTIVITAS TERAKHIR</p><h3>${escapeForHTML(latest.title)}</h3><p>${formatDate(latest.date)} · ${latest.start}–${latest.end} · ${formatDuration(latest.duration)}</p></div>`;
  }
  const recent = sortNewest(records).slice(0, 3);
  const recentRoot = document.getElementById("recent-list");
  if (!recent.length) {
    releaseObjectUrls(recentRoot);
    recentRoot.innerHTML = '<div class="empty-state"><span class="empty-symbol">✦</span>Belum ada catatan. Mulai dengan mencatat sesi pertama Anda.</div>';
  } else {
    replaceList(recentRoot, await renderSessionRows(recent, openDetail));
  }
}

function escapeForHTML(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function renderHistory() {
  const query = document.getElementById("history-search").value.trim().toLocaleLowerCase();
  const month = document.getElementById("history-month").value;
  const filtered = sortNewest(records).filter((record) => {
    const matchesMonth = !month || record.date.startsWith(month);
    const searchable = `${record.material} ${record.notes || ""} ${record.title}`.toLocaleLowerCase();
    return matchesMonth && searchable.includes(query);
  });
  const root = document.getElementById("history-list");
  if (!filtered.length) {
    releaseObjectUrls(root);
    root.innerHTML = `<div class="empty-state"><span class="empty-symbol">✦</span>${records.length ? "Tidak ada catatan yang cocok dengan pencarian." : "Belum ada catatan kehadiran."}</div>`;
  } else {
    replaceList(root, await renderSessionRows(filtered, openDetail));
  }
}

async function start() {
  renderIcons();
  initSettings({ changed: refreshData, toast: notify });
  initAttendance({ getRecords: () => records, onChanged: refreshData, showToast: notify, showPage });
  initCalendar({ getRecords: () => records, renderRows: renderSessionRows, onSelect: openDetail, toast: notify });
  initGallery({ getRecords: () => records, onChanged: refreshData, toast: notify });
  initReport({ getRecords: () => records, getSettings });

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      showPage(pageButton.dataset.page);
      return;
    }
    if (event.target.closest("[data-action='new']")) startNewAttendance();
  });
  document.getElementById("header-settings").addEventListener("click", () => showPage("settings"));
  document.getElementById("history-search").addEventListener("input", renderHistory);
  document.getElementById("history-month").addEventListener("change", renderHistory);
  document.getElementById("image-dialog").addEventListener("close", () => {
    const image = document.getElementById("image-large");
    if (image.dataset.url) {
      URL.revokeObjectURL(image.dataset.url);
      image.dataset.url = "";
      image.removeAttribute("src");
    }
  });
  document.getElementById("detail-dialog").addEventListener("close", () => {
    document.querySelectorAll("#detail-content img[src^='blob:']").forEach((image) => URL.revokeObjectURL(image.src));
  });

  await refreshData();
  showPage("home");
}

start().catch((error) => {
  console.error(error);
  notify(`Aplikasi tidak dapat dimulai: ${error.message}`);
});
