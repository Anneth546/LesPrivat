import { clearAllData, getAllPhotos, getAttendances, replaceAllData } from "./database.js";
import { durationMinutes, localDateISO } from "./ui.js";

const STORAGE_KEY = "aniza.settings";
const defaults = { teacherName: "Aniza", appName: "Aniza Private Tutoring", defaultStart: "15:00", defaultEnd: "17:00" };
let settings = { ...defaults };
let changed, toast;

export function getSettings() {
  return { ...settings };
}

function readSettings() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Pengaturan lokal tidak dapat dibaca.", error);
    return { value: { ...defaults }, invalid: true };
  }
  if (!raw) return { value: { ...defaults }, invalid: false };
  try {
    const saved = JSON.parse(raw);
    return { value: {
      teacherName: validText(saved.teacherName, defaults.teacherName, 60),
      appName: validText(saved.appName, defaults.appName, 80),
      defaultStart: validTime(saved.defaultStart, defaults.defaultStart),
      defaultEnd: validTime(saved.defaultEnd, defaults.defaultEnd)
    }, invalid: false };
  } catch (error) {
    console.error("Pengaturan tersimpan tidak dapat dibaca.", error);
    return { value: { ...defaults }, invalid: true };
  }
}

function validText(value, fallback, maxLength) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function validTime(value, fallback) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export function initSettings(options) {
  ({ changed, toast } = options);
  const savedSettings = readSettings();
  settings = savedSettings.value;
  if (savedSettings.invalid) toast("Pengaturan tersimpan tidak dapat dibaca; nilai awal digunakan.");
  const form = document.getElementById("settings-form");
  Object.entries(settings).forEach(([key, value]) => { form.elements[key].value = value; });
  applySettings();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const next = {
      teacherName: validText(data.get("teacherName"), defaults.teacherName, 60),
      appName: validText(data.get("appName"), defaults.appName, 80),
      defaultStart: validTime(data.get("defaultStart"), defaults.defaultStart),
      defaultEnd: validTime(data.get("defaultEnd"), defaults.defaultEnd)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      settings = next;
      applySettings();
      toast("Pengaturan berhasil disimpan.");
    } catch (error) {
      toast(`Pengaturan gagal disimpan: ${error.message}`);
    }
  });

  document.getElementById("export-data").addEventListener("click", exportBackup);
  document.getElementById("import-data").addEventListener("change", restoreBackup);
  document.getElementById("clear-data").addEventListener("click", eraseAll);
}

function applySettings() {
  document.getElementById("brand-name").textContent = settings.appName;
  document.getElementById("welcome-title").innerHTML = `Selamat datang, ${escapeHtml(settings.teacherName)} <span>✦</span>`;
  document.title = `${settings.appName} — Kehadiran`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Foto tidak dapat dibaca untuk backup."));
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl, fallbackType) {
  if (typeof dataUrl !== "string" || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) {
    throw new Error("Format foto pada file backup tidak valid.");
  }
  const [header, encoded] = dataUrl.split(",", 2);
  const type = header.match(/^data:([^;]+)/)?.[1] || fallbackType || "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

export async function exportBackup() {
  try {
    const [attendances, photos] = await Promise.all([getAttendances(), getAllPhotos()]);
    const backup = {
      format: "aniza-private-attendance",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      attendances,
      photos: await Promise.all(photos.map(async (photo) => ({
        id: photo.id, recordId: photo.recordId, type: photo.type || photo.blob.type,
        createdAt: photo.createdAt, data: await blobToDataURL(photo.blob)
      })))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `aniza-attendance-backup-${localDateISO()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup JSON berhasil dibuat.");
  } catch (error) {
    toast(`Backup gagal dibuat: ${error.message}`);
  }
}

function validateBackup(data) {
  if (!data || data.format !== "aniza-private-attendance" || data.version !== 1
      || !Array.isArray(data.attendances) || !Array.isArray(data.photos)) {
    throw new Error("File bukan backup Aniza Private Tutoring yang didukung.");
  }
  const records = data.attendances.map((record) => {
    const dateParts = typeof record?.date === "string" ? record.date.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
    const dateIsValid = dateParts && (() => {
      const date = new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]));
      return date.getFullYear() === Number(dateParts[1])
        && date.getMonth() === Number(dateParts[2]) - 1 && date.getDate() === Number(dateParts[3]);
    })();
    const duration = record && durationMinutes(record.start, record.end);
    if (!record || typeof record.id !== "string" || !dateIsValid
      || !validTime(record.start, "") || !validTime(record.end, "")
      || !Number.isInteger(duration) || record.duration !== duration
      || typeof record.title !== "string" || typeof record.material !== "string") {
      throw new Error("Ada catatan kehadiran dengan format tidak valid.");
    }
    const photoIds = Array.isArray(record.photoIds) ? record.photoIds : [];
    if (photoIds.some((id) => typeof id !== "string") || new Set(photoIds).size !== photoIds.length) {
      throw new Error("Ada daftar foto dengan format tidak valid.");
    }
    return { ...record, photoIds, notes: String(record.notes || "") };
  });
  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) throw new Error("File backup berisi ID catatan ganda.");
  const photos = data.photos.map((photo) => {
    if (!photo || typeof photo.id !== "string" || !ids.has(photo.recordId)) {
      throw new Error("Ada foto yang tidak terhubung dengan catatan.");
    }
    return {
      id: photo.id, recordId: photo.recordId, type: String(photo.type || "image/jpeg"),
      createdAt: String(photo.createdAt || new Date().toISOString()),
      blob: dataURLToBlob(photo.data, photo.type)
    };
  });
  const photoIds = new Set(photos.map((photo) => photo.id));
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  if (photoIds.size !== photos.length || records.some((record) =>
    record.photoIds.some((id) => !photoIds.has(id) || photoById.get(id).recordId !== record.id)
  ) || photos.some((photo) => !records.find((record) => record.id === photo.recordId)?.photoIds.includes(photo.id))) {
    throw new Error("Daftar foto dan catatan di file backup tidak cocok.");
  }
  const restoredSettings = data.settings && typeof data.settings === "object" ? {
    teacherName: validText(data.settings.teacherName, defaults.teacherName, 60),
    appName: validText(data.settings.appName, defaults.appName, 80),
    defaultStart: validTime(data.settings.defaultStart, defaults.defaultStart),
    defaultEnd: validTime(data.settings.defaultEnd, defaults.defaultEnd)
  } : { ...defaults };
  return { records, photos, settings: restoredSettings };
}

async function restoreBackup(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const backup = validateBackup(parsed);
    if (!window.confirm(`Pulihkan ${backup.records.length} catatan dan ${backup.photos.length} foto? Data yang ada saat ini akan diganti.`)) return;
    await replaceAllData(backup.records, backup.photos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.settings));
    settings = backup.settings;
    applySettings();
    document.querySelectorAll("#settings-form [name]").forEach((inputElement) => {
      inputElement.value = settings[inputElement.name];
    });
    await changed();
    toast("Backup berhasil dipulihkan.");
  } catch (error) {
    toast(`Pemulihan gagal: ${error.message}`);
  } finally {
    input.value = "";
  }
}

async function eraseAll() {
  if (!window.confirm("Hapus seluruh catatan dan foto? Data yang dihapus tidak dapat dikembalikan.")) return;
  const confirmation = window.prompt('Ketik HAPUS untuk mengonfirmasi penghapusan seluruh data.');
  if (confirmation !== "HAPUS") {
    toast("Penghapusan dibatalkan.");
    return;
  }
  try {
    await clearAllData();
    localStorage.removeItem(STORAGE_KEY);
    settings = { ...defaults };
    applySettings();
    document.querySelectorAll("#settings-form [name]").forEach((inputElement) => {
      inputElement.value = settings[inputElement.name];
    });
    await changed();
    toast("Seluruh catatan, foto, dan pengaturan berhasil dihapus.");
  } catch (error) {
    toast(`Data tidak dapat dihapus: ${error.message}`);
  }
}
