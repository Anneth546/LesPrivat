# Aniza Private Tutoring — Attendance

Aplikasi pencatatan les privat statis berbasis HTML, CSS, dan JavaScript. Data kegiatan disimpan pada browser menggunakan IndexedDB dan pengaturan aplikasi menggunakan localStorage. Tidak ada backend atau data contoh.

## Menjalankan secara lokal

Buka `index.html` melalui server lokal, misalnya dengan Live Server di VS Code. Modul JavaScript dan IndexedDB memerlukan origin browser yang konsisten; hindari berpindah-pindah antara `file://`, localhost, dan domain GitHub Pages karena masing-masing memiliki penyimpanan lokal terpisah.

## Menerbitkan di GitHub Pages

1. Buat repository GitHub bernama `LesPrivat` pada akun pemilik.
2. Push seluruh isi repository ini ke branch `main`.
3. Buka **Settings → Pages** pada repository.
4. Pada **Build and deployment**, pilih **Deploy from a branch**, lalu pilih branch `main` dan folder `/(root)`, kemudian **Save**.
5. Setelah deployment selesai, situs tersedia di `https://anneth546.github.io/LesPrivat/`.

GitHub Pages pada paket gratis memerlukan repository publik. Saat pertama kali membuka situs di GitHub Pages, browser akan membuat penyimpanan lokal yang terpisah dari localhost; backup dan restore JSON dapat digunakan untuk memindahkan data antar-origin atau perangkat.

## Backup data

Gunakan **Pengaturan → Backup JSON** untuk mengunduh catatan, foto, dan pengaturan. Simpan file backup di tempat yang aman. **Pulihkan JSON** mengganti seluruh data yang tersimpan di browser saat ini.
