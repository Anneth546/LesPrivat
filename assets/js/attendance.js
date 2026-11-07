import { getPhoto, getPhotos, removeAttendance, saveAttendanceWithPhotos } from "./database.js";
import { dateFromISO, durationMinutes, escapeHTML, formatDate, formatDuration, localDateISO, makeId, renderIcons, sortNewest } from "./ui.js";
import { getSettings } from "./settings.js";

let form, preview, currentPhotos = [], onChanged, showToast, showPage, getRecords;
let previewUrls = [];
let isSaving = false;

function revokePreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function fileAsBlob(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Pilih file gambar untuk dokumentasi."));
      return;
    }
    resolve(file);
  });
}

function renderPreviews() {
  revokePreviewUrls();
  preview.innerHTML = "";
  currentPhotos.forEach((photo, index) => {
    const url = photo.url || URL.createObjectURL(photo.blob);
    if (!photo.url) previewUrls.push(url);
    const wrapper = document.createElement("div");
    wrapper.className = "preview-wrap";
    wrapper.innerHTML = `<img src="${url}" alt="Pratinjau foto"><button type="button" aria-label="Hapus foto">×</button>`;
    wrapper.querySelector("button").addEventListener("click", () => {
      currentPhotos.splice(index, 1);
      renderPreviews();
    });
    preview.append(wrapper);
  });
}

function setDurationPreview() {
  const duration = durationMinutes(form.elements.start.value, form.elements.end.value);
  const box = document.getElementById("duration-preview");
  if (!form.elements.start.value || !form.elements.end.value) {
    box.classList.remove("invalid");
    box.innerHTML = '<span data-icon="clock"></span><span>Durasi sesi akan dihitung otomatis</span>';
  } else if (duration === null) {
    box.classList.add("invalid");
    box.innerHTML = '<span data-icon="clock"></span><span>Jam mulai dan selesai tidak boleh sama.</span>';
  } else {
    box.classList.remove("invalid");
    box.innerHTML = `<span data-icon="clock"></span><span>Durasi sesi: <strong>${formatDuration(duration)}</strong>${form.elements.end.value < form.elements.start.value ? " · melewati tengah malam" : ""}</span>`;
  }
  renderIcons(box);
}

function resetForm() {
  revokePreviewUrls();
  currentPhotos = [];
  form.reset();
  form.elements.id.value = "";
  const settings = getSettings();
  form.elements.date.value = localDateISO();
  form.elements.start.value = settings.defaultStart;
  form.elements.end.value = settings.defaultEnd;
  document.getElementById("entry-title").textContent = "Catat kehadiran";
  document.querySelector("#attendance-form button[type=submit]").textContent = "Simpan catatan";
  document.getElementById("cancel-edit").hidden = false;
  renderPreviews();
  setDurationPreview();
}

export function initAttendance(options) {
  ({ getRecords, onChanged, showToast, showPage } = options);
  form = document.getElementById("attendance-form");
  preview = document.getElementById("photo-preview");
  form.elements.date.value = localDateISO();
  form.elements.start.value = "15:00";
  form.elements.end.value = "17:00";
  document.getElementById("cancel-edit").hidden = false;

  form.addEventListener("input", setDurationPreview);
  form.addEventListener("change", async (event) => {
    if (!["photos-camera", "photos-gallery"].includes(event.target.name)) return;
    try {
      const files = Array.from(event.target.files || []);
      for (const file of files) currentPhotos.push({ blob: await fileAsBlob(file) });
      renderPreviews();
    } catch (error) {
      showToast(error.message);
    }
    event.target.value = "";
  });
  form.addEventListener("submit", saveForm);
  document.getElementById("cancel-edit").addEventListener("click", () => {
    resetForm();
    showPage("home");
  });
  resetForm();
}

export function startNewAttendance() {
  resetForm();
  showPage("entry");
}

async function saveForm(event) {
  event.preventDefault();
  if (isSaving) return;
  const data = new FormData(form);
  const date = data.get("date");
  const start = data.get("start");
  const end = data.get("end");
  const duration = durationMinutes(start, end);
  if (!date || Number.isNaN(dateFromISO(date).getTime())) {
    showToast("Pilih tanggal mengajar yang valid.");
    return;
  }
  if (duration === null) {
    showToast("Jam selesai harus berbeda dari jam mulai.");
    return;
  }
  const title = String(data.get("title") || "").trim();
  const material = String(data.get("material") || "").trim();
  if (!title || !material) {
    showToast("Nama kegiatan dan materi wajib diisi.");
    return;
  }
  const editingId = String(data.get("id") || "");
  const duplicate = getRecords().find((record) =>
    record.id !== editingId && record.date === date && record.start === start && record.end === end
    && record.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase()
    && record.material.trim().toLocaleLowerCase() === material.toLocaleLowerCase()
  );
  if (duplicate) {
    showToast("Catatan dengan tanggal, waktu, kegiatan, dan materi yang sama sudah ada.");
    return;
  }
  const old = editingId ? getRecords().find((record) => record.id === editingId) : null;
  const recordId = editingId || makeId();
  const retained = currentPhotos.filter((photo) => photo.id).map((photo) => photo.id);
  const submitButton = form.querySelector('button[type="submit"]');
  isSaving = true;
  submitButton.disabled = true;
  submitButton.textContent = "Menyimpan...";
  try {
    const photos = currentPhotos.filter((photo) => photo.blob).map((photo) => ({
      id: makeId(), recordId, blob: photo.blob, type: photo.blob.type, createdAt: new Date().toISOString()
    }));
    const record = {
      id: recordId, date, start, end, duration, title, material,
      notes: String(data.get("notes") || "").trim(),
      photoIds: [...retained, ...photos.map((photo) => photo.id)],
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const removedPhotoIds = (old?.photoIds || []).filter((id) => !record.photoIds.includes(id));
    await saveAttendanceWithPhotos(record, photos, removedPhotoIds);
    resetForm();
    showToast(editingId ? "Catatan berhasil diperbarui." : "Kehadiran berhasil disimpan.");
    showPage("home");
  } catch (error) {
    showToast(`Catatan gagal disimpan: ${error.message}`);
    return;
  } finally {
    isSaving = false;
    submitButton.disabled = false;
    submitButton.textContent = form.elements.id.value ? "Simpan perubahan" : "Simpan catatan";
  }
  try {
    await onChanged();
  } catch (error) {
    console.error("Catatan tersimpan, tetapi tampilan gagal diperbarui.", error);
    showToast("Catatan tersimpan, tetapi tampilan belum berhasil diperbarui. Muat ulang halaman.");
  }
}

export async function beginEdit(record) {
  revokePreviewUrls();
  currentPhotos = [];
  const blobs = await getPhotos(record.photoIds || []);
  currentPhotos = blobs.filter(Boolean).map((photo) => ({ id: photo.id, blob: photo.blob }));
  form.elements.id.value = record.id;
  form.elements.date.value = record.date;
  form.elements.start.value = record.start;
  form.elements.end.value = record.end;
  form.elements.title.value = record.title;
  form.elements.material.value = record.material;
  form.elements.notes.value = record.notes || "";
  document.getElementById("entry-title").textContent = "Edit kehadiran";
  document.querySelector("#attendance-form button[type=submit]").textContent = "Simpan perubahan";
  document.getElementById("cancel-edit").hidden = false;
  renderPreviews();
  setDurationPreview();
  showPage("entry");
}

export async function openRecordDetail(record, onDelete) {
  const dialog = document.getElementById("detail-dialog");
  const content = document.getElementById("detail-content");
  const photos = (await getPhotos(record.photoIds || [])).filter(Boolean);
  content.innerHTML = `
    <p class="eyebrow">${escapeHTML(formatDate(record.date))}</p>
    <h2>${escapeHTML(record.title)}</h2>
    <p>${escapeHTML(record.start)}–${escapeHTML(record.end)} · ${escapeHTML(formatDuration(record.duration))}</p>
    <p><strong>Materi</strong><br>${escapeHTML(record.material)}</p>
    ${record.notes ? `<p><strong>Catatan</strong><br>${escapeHTML(record.notes).replace(/\n/g, "<br>")}</p>` : ""}
    ${photos.length ? `<div class="detail-photos">${photos.map((photo) => `<img src="${URL.createObjectURL(photo.blob)}" data-photo="${escapeHTML(photo.id)}" alt="Dokumentasi ${escapeHTML(record.title)}">`).join("")}</div>` : ""}
    <div class="detail-actions"><button class="button button-primary" type="button" data-edit>Ubah catatan</button><button class="button button-danger" type="button" data-delete>Hapus catatan</button></div>`;
  content.querySelectorAll(".detail-photos img").forEach((image) => {
    image.addEventListener("click", async () => {
      const photo = await getPhoto(image.dataset.photo);
      if (photo) showImage(photo.blob, `${formatDate(record.date)} · ${record.title}`);
    });
  });
  content.querySelector("[data-edit]").addEventListener("click", async () => {
    dialog.close();
    await beginEdit(record);
  });
  content.querySelector("[data-delete]").addEventListener("click", async () => {
    if (!window.confirm(`Hapus catatan "${record.title}" beserta foto-fotonya? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await removeAttendance(record.id);
      dialog.close();
    } catch (error) {
      showToast(`Catatan tidak dapat dihapus: ${error.message}`);
      return;
    }
    try {
      await onDelete();
      showToast("Catatan berhasil dihapus.");
    } catch (error) {
      console.error("Catatan terhapus, tetapi tampilan gagal diperbarui.", error);
      showToast("Catatan terhapus, tetapi tampilan belum berhasil diperbarui. Muat ulang halaman.");
    }
  });
  dialog.showModal();
}

export function showImage(blob, caption = "") {
  const dialog = document.getElementById("image-dialog");
  const image = document.getElementById("image-large");
  if (image.dataset.url) URL.revokeObjectURL(image.dataset.url);
  const url = URL.createObjectURL(blob);
  image.src = url;
  image.dataset.url = url;
  document.getElementById("image-caption").textContent = caption;
  dialog.showModal();
}

export async function renderSessionRows(records, onSelect) {
  const result = [];
  for (const record of sortNewest(records)) {
    const photo = await getPhoto(record.photoIds?.[0]);
    const thumb = photo ? `<img class="session-thumb" src="${URL.createObjectURL(photo.blob)}" alt="">` : '<span class="session-mark">✦</span>';
    result.push(`<article class="session-row" data-id="${escapeHTML(record.id)}" tabindex="0" role="button" aria-label="Detail ${escapeHTML(record.title)}">${thumb}<div class="session-info"><h3>${escapeHTML(record.title)}</h3><p class="session-meta">${escapeHTML(formatDate(record.date, { day: "numeric", month: "short", year: "numeric" }))} · ${escapeHTML(record.start)}–${escapeHTML(record.end)}<br>${escapeHTML(record.material)} · ${escapeHTML(formatDuration(record.duration))}</p></div><span class="row-arrow">›</span></article>`);
  }
  const wrapper = document.createElement("div");
  wrapper.innerHTML = result.join("");
  wrapper.querySelectorAll(".session-row").forEach((row) => {
    const record = records.find((item) => item.id === row.dataset.id);
    row.addEventListener("click", () => onSelect(record));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(record);
      }
    });
  });
  return wrapper;
}

export async function getRecordPhotos(record) {
  return (await getPhotos(record.photoIds || [])).filter(Boolean);
}
