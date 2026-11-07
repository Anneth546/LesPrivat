import { formatDate, formatDuration, localDateISO, releaseObjectUrls, replaceList } from "./ui.js";

let month, selectedDate, getRecords, renderRows, onSelect, toast;

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function initCalendar(options) {
  ({ getRecords, renderRows, onSelect, toast } = options);
  const now = new Date();
  month = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDate = localDateISO(now);
  document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
  renderCalendar();
}

function shiftMonth(offset) {
  month = new Date(month.getFullYear(), month.getMonth() + offset, 1);
  renderCalendar();
}

export async function renderCalendar() {
  const records = getRecords();
  const dayCounts = new Map();
  records.forEach((record) => dayCounts.set(record.date, (dayCounts.get(record.date) || 0) + 1));
  const monthRecords = records.filter((record) => record.date.startsWith(monthKey(month)));
  document.getElementById("calendar-month").textContent = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(month);
  const total = monthRecords.reduce((sum, item) => sum + item.duration, 0);
  document.getElementById("calendar-summary").textContent = `${monthRecords.length} pertemuan · ${formatDuration(total)}`;
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay);
  const today = localDateISO();
  const days = document.getElementById("calendar-days");
  days.innerHTML = "";
  for (let index = 0; index < 42; index++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = localDateISO(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    if (date.getMonth() !== month.getMonth()) button.classList.add("outside");
    if (key === today) button.classList.add("today");
    if (key === selectedDate) button.classList.add("selected");
    if (dayCounts.has(key)) button.classList.add("has-entry");
    button.textContent = date.getDate();
    button.setAttribute("aria-label", `${formatDate(key)}${dayCounts.has(key) ? `, ${dayCounts.get(key)} pertemuan` : ""}`);
    button.addEventListener("click", () => {
      if (date.getMonth() !== month.getMonth()) month = new Date(date.getFullYear(), date.getMonth(), 1);
      selectedDate = key;
      renderCalendar();
    });
    days.append(button);
  }
  await renderSelectedDate();
}

async function renderSelectedDate() {
  const label = document.getElementById("selected-date-label");
  const list = document.getElementById("day-entries");
  label.textContent = formatDate(selectedDate);
  const records = getRecords().filter((record) => record.date === selectedDate);
  if (!records.length) {
    releaseObjectUrls(list);
    list.innerHTML = '<div class="empty-state"><span class="empty-symbol">✦</span>Belum ada catatan pada tanggal ini.<br>Tanggal kosong bukan berarti absen.</div>';
    return;
  }
  const rows = await renderRows(records, onSelect);
  replaceList(list, rows);
}
