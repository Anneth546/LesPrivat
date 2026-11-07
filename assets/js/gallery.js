import { getAllPhotos, removePhotoFromAttendance } from "./database.js";
import { formatDate, escapeHTML } from "./ui.js";
import { showImage } from "./attendance.js";

let getRecords, onChanged, toast, urls = [];

export function initGallery(options) {
  ({ getRecords, onChanged, toast } = options);
  renderGallery();
}

function cleanupUrls() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];
}

export async function renderGallery() {
  cleanupUrls();
  const root = document.getElementById("gallery-content");
  const records = getRecords();
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const photos = await getAllPhotos();
  const groups = new Map();
  photos.forEach((photo) => {
    const record = recordMap.get(photo.recordId);
    if (!record || !(record.photoIds || []).includes(photo.id)) return;
    const key = record.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ photo, record });
  });
  if (!groups.size) {
    root.innerHTML = '<div class="empty-state"><span class="empty-symbol">✦</span>Belum ada foto dokumentasi.<br>Foto yang Anda tambahkan pada catatan akan muncul di sini.</div>';
    return;
  }
  root.innerHTML = [...groups.keys()].sort().reverse().map((key) => {
    const items = groups.get(key).sort((a, b) => b.record.date.localeCompare(a.record.date));
    const heading = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
    return `<section class="month-group"><h2>${escapeHTML(heading)} <span class="muted small">· ${items.length} foto</span></h2><div class="gallery-grid">${items.map(({ photo, record }) => `<div class="gallery-item-wrap"><button class="gallery-item" type="button" data-open="${escapeHTML(photo.id)}" aria-label="Lihat foto ${escapeHTML(formatDate(record.date))}"><img src="${URL.createObjectURL(photo.blob)}" alt="Dokumentasi ${escapeHTML(record.title)}"><span>${escapeHTML(formatDate(record.date, { day: "numeric", month: "short" }))}</span></button><button class="gallery-delete" type="button" data-delete="${escapeHTML(photo.id)}" aria-label="Hapus foto">×</button></div>`).join("")}</div></section>`;
  }).join("");
  root.querySelectorAll(".gallery-item img").forEach((image) => {
    if (image.src.startsWith("blob:")) urls.push(image.src);
  });
  root.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const photo = photos.find((item) => item.id === button.dataset.open);
      const record = photo && recordMap.get(photo.recordId);
      if (photo) showImage(photo.blob, `${formatDate(record.date)} · ${record.title}`);
    });
  });
  root.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const photo = photos.find((item) => item.id === button.dataset.delete);
      const record = photo && recordMap.get(photo.recordId);
      if (!photo || !record) return;
      if (!window.confirm(`Hapus foto dokumentasi tanggal ${formatDate(record.date)}? Catatan kehadiran tetap tersimpan.`)) return;
      try {
        await removePhotoFromAttendance(record.id, photo.id);
      } catch (error) {
        toast(`Foto tidak dapat dihapus: ${error.message}`);
        return;
      }
      try {
        await onChanged();
        await renderGallery();
        toast("Foto berhasil dihapus. Catatan kehadiran tetap tersimpan.");
      } catch (error) {
        console.error("Foto terhapus, tetapi tampilan galeri gagal diperbarui.", error);
        toast("Foto terhapus, tetapi galeri belum berhasil diperbarui. Muat ulang halaman.");
      }
    });
  });
}
