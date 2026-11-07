# Aniza Private Tutoring — Attendance

Aplikasi pencatatan les privat statis berbasis HTML, CSS, dan JavaScript. Data kegiatan disimpan pada browser menggunakan IndexedDB dan pengaturan aplikasi menggunakan localStorage. Tidak ada backend atau data contoh.

## Situs

**Buka aplikasi:** <https://anneth546.github.io/LesPrivat/>

## Menjalankan secara lokal

Buka `index.html` melalui server lokal, misalnya dengan Live Server di VS Code. Modul JavaScript dan IndexedDB memerlukan origin browser yang konsisten; hindari berpindah-pindah antara `file://`, localhost, dan domain GitHub Pages karena masing-masing memiliki penyimpanan lokal terpisah.

## Deployment GitHub Pages

GitHub Pages menggunakan **Deploy from a branch** pada branch `main` dan folder `/(root)`. Push perubahan ke `main` untuk menerbitkan versi terbaru; progres build dapat dilihat pada tab **Actions** repository.

GitHub Pages pada paket gratis memerlukan repository publik. Saat pertama kali membuka situs di GitHub Pages, browser akan membuat penyimpanan lokal yang terpisah dari localhost; backup dan restore JSON dapat digunakan untuk memindahkan data antar-origin atau perangkat.

## Backup data

Gunakan **Pengaturan → Backup JSON** untuk mengunduh catatan, foto, dan pengaturan. Simpan file backup di tempat yang aman. **Pulihkan JSON** mengganti seluruh data yang tersimpan di browser saat ini.
