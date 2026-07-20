# 🏢 DBG Finance

Sistem Informasi Akuntansi & Keuangan khusus untuk **PT Dwi Bintang Global** (Perusahaan Garmen CMT). Aplikasi ini dirancang menggunakan arsitektur Single Page Application (SPA) berbasis Vanilla JavaScript dengan **Firebase** (Authentication & Firestore) sebagai backend.

Aplikasi ini mengadopsi desain *Modern Dark-Mode / Glassmorphism* yang elegan, ringan, dan cepat.

---

## 🎯 Fitur Utama

Sistem ini dirancang khusus untuk memenuhi kebutuhan akuntansi perusahaan CMT (Cut, Make, Trim) di mana bahan baku utama disediakan oleh *buyer*.

*   **🔒 Autentikasi**: Single-user login menggunakan Firebase Auth.
*   **📊 Chart of Accounts (COA)**: Dilengkapi dengan 68 akun default khusus industri garmen (Beban Jahit, Beban Bordir, dll) yang otomatis di-seed pada saat login pertama.
*   **👥 Manajemen Kontak**: Database *Buyer* (Customer) dan *Vendor/Supplier*.
*   **📝 Jurnal Umum**: Pencatatan *double-entry bookkeeping* yang memvalidasi *balance* secara otomatis.
*   **💰 Kas & Bank**: Ringkasan saldo dan pencatatan arus kas masuk/keluar.
*   **🧾 Account Receivable (Piutang)**: Pembuatan *Invoice* CMT ke *Buyer*, pelacakan aging, dan pencatatan pembayaran parsial.
*   **📋 Account Payable (Hutang)**: Pembuatan *Bill* dari *Vendor* (aksesori, sparepart, dll), pembebanan langsung ke COA, dan pencatatan pembayaran.
*   **📈 Laporan Keuangan Real-Time**:
    *   Buku Besar (General Ledger)
    *   Neraca Saldo (Trial Balance)
    *   Laba / Rugi (Profit & Loss)
    *   Neraca (Balance Sheet)
    *   Arus Kas (Cash Flow)
*   **⚙️ Pengaturan**: Konfigurasi identitas perusahaan (Nama, Alamat, Telepon, dsb).

---

## 🛠 Teknologi yang Digunakan

*   **Frontend UI**: HTML5, Vanilla CSS3 (Custom Design System, Flexbox, CSS Grid).
*   **Frontend Logic**: ES6 Modular JavaScript (`app.js`).
*   **Backend / Database**: Google Firebase (Firestore Database).
*   **Authentication**: Google Firebase Auth (Email/Password).

---

## 🚀 Panduan Instalasi & Setup

### Langkah 1: Setup Firebase
Aplikasi ini berjalan secara *serverless* dan sepenuhnya bergantung pada Firebase. Anda harus menghubungkannya ke project Firebase Anda.

1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru (misal: `dbg-finance`).
2. Masuk ke menu **Authentication**, klik **Get Started**, dan aktifkan opsi **Email/Password**.
3. Di halaman Authentication, klik tab **Users** -> **Add User**, lalu buat akun login (contoh: `admin@dbg.com` dengan password Anda).
4. Masuk ke menu **Firestore Database**, klik **Create database**, dan pilih lokasi server (disarankan *asia-southeast1* atau *asia-southeast2*).
5. Pada tab **Rules** di Firestore, ganti isinya dengan *Security Rules* berikut lalu klik **Publish**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    match /coa/{docId} { allow read, write: if isAuthenticated(); }
    match /contacts/{docId} { allow read, write: if isAuthenticated(); }
    match /journals/{docId} { allow read, write: if isAuthenticated(); }
    match /invoices/{docId} { allow read, write: if isAuthenticated(); }
    match /bills/{docId} { allow read, write: if isAuthenticated(); }
    match /settings/{docId} { allow read, write: if isAuthenticated(); }
    match /counters/{docId} { allow read, write: if isAuthenticated(); }
  }
}
```

### Langkah 2: Konfigurasi Project

1. Buka file `firebase-config.js` di dalam folder project.
2. Ganti nilai di dalam objek `firebaseConfig` dengan kredensial dari project Firebase Anda (didapatkan dari Project Settings > General > Your apps di Firebase Console).

### Langkah 3: Menjalankan Aplikasi secara Lokal

Karena menggunakan ES6 Modules (`type="module"` di HTML), file tidak bisa dibuka langsung dengan mengklik dua kali `index.html` (`file://`). Anda harus menjalankannya melalui web server lokal.

**Opsi 1: Menggunakan Python (Terminal/Command Prompt)**
Buka terminal di dalam folder project ini, lalu jalankan:
```bash
python3 -m http.server 8080
```
Buka browser dan akses: `http://localhost:8080`

**Opsi 2: Menggunakan Visual Studio Code**
1. Instal ekstensi **Live Server**.
2. Buka `index.html`.
3. Klik tombol **"Go Live"** di pojok kanan bawah VS Code.

---

## 📖 Panduan Penggunaan Harian (SOP)

### 1. Login Pertama Kali
Gunakan email dan password yang telah Anda buat di Firebase Console. Saat pertama kali login:
*   Aplikasi akan otomatis mendeteksi bahwa database masih kosong.
*   Aplikasi akan otomatis mengunggah (seed) **68 Chart of Accounts (COA) standar** ke database.
*   Segera masuk ke menu **Pengaturan (⚙️)** di pojok kiri bawah untuk mengisi profil perusahaan (Nama, Alamat, No Telepon).

### 2. Mengelola Kontak
Sebelum membuat Invoice atau Tagihan Hutang, pastikan Anda telah mendaftarkan mitra bisnis di menu **Kontak**.
*   **Customer (Buyer)**: Perusahaan/pihak pemberi order CMT (contoh: H&M, Uniqlo).
*   **Supplier (Vendor)**: Pihak yang menyediakan alat/aksesoris di luar yang diberikan buyer.

### 3. Mencatat Piutang (Invoice) - Uang Masuk dari Buyer
Ketika pengerjaan CMT selesai dan Anda menagih buyer:
1. Masuk ke menu **Piutang / AR**.
2. Klik **+ Buat Invoice**.
3. Pilih Buyer, tanggal, dan tenggat waktu (Jatuh Tempo).
4. Masukkan rincian tagihan (misal: "Jasa Jahit Baju Kemeja - 1000 pcs").
5. Jika Invoice disimpan, sistem otomatis akan **mencatat Jurnal Piutang Usaha (Debit) vs Pendapatan Jasa CMT (Kredit)**.

### 4. Menerima Pembayaran dari Buyer
Saat buyer sudah membayar tagihan (transfer ke Bank):
1. Masuk ke menu **Piutang / AR**.
2. Cari Invoice yang bersangkutan, klik ikon **$ (Catat Pembayaran)**.
3. Masukkan nominal yang diterima dan pilih **Akun Kas/Bank** tujuan.
4. Sistem otomatis mencatat Jurnal Kas/Bank (Debit) vs Piutang Usaha (Kredit) dan mengurangi saldo terutang di Invoice.

### 5. Mencatat Hutang (Bill) - Tagihan dari Vendor
Ketika Anda membeli perlengkapan/aksesori dari vendor namun belum dibayar:
1. Masuk ke menu **Hutang / AP**.
2. Klik **+ Buat Tagihan**.
3. Pilih Vendor.
4. Masukkan rincian barang, dan **pilih akun Beban** yang relevan (misal: Beban Perlengkapan Jahit).
5. Sistem otomatis mencatat Beban (Debit) vs Hutang Usaha (Kredit).

### 6. Membayar Hutang ke Vendor
Saat Anda mentransfer pembayaran ke vendor:
1. Masuk ke menu **Hutang / AP**.
2. Cari tagihan bersangkutan, klik ikon **$ (Catat Pembayaran)**.
3. Pilih akun Bank sumber dana.
4. Sistem otomatis mencatat Hutang Usaha (Debit) vs Kas/Bank (Kredit).

### 7. Transaksi Kas/Bank Lainnya
Untuk transaksi operasional yang **tidak berkaitan dengan hutang piutang** (contoh: bayar listrik tunai, bayar gaji tunai, beli token listrik):
1. Masuk ke menu **Kas & Bank**.
2. Klik **+ Transaksi Kas**.
3. Pilih apakah itu "Penerimaan" (In) atau "Pengeluaran" (Out).
4. Pilih Akun Bank/Kas yang digunakan, dan Akun Lawan (misal: Beban Listrik).
5. Jurnal otomatis terbuat dan saldo kas terupdate.

### 8. Membaca Laporan Keuangan
Semua laporan di-generate secara real-time berdasarkan tanggal yang Anda pilih di filter atas layar:
*   **Neraca Saldo**: Pastikan kolom Debit dan Kredit seimbang.
*   **Laba Rugi**: Melihat kinerja perusahaan (Pendapatan dikurangi Beban operasional).
*   **Neraca**: Melihat posisi keuangan (Aset = Kewajiban + Ekuitas).
*   **Buku Besar**: Melihat rincian riwayat transaksi per spesifik akun.

---

## 📁 Struktur Direktori

```text
DBG-finance/
│
├── index.html          # File entry point, struktur UI dasar (SPA Shell)
├── index.css           # Styling utama, Design System, CSS Variables
├── app.js              # Jantung aplikasi: Logika Firebase, Routing, CRUD, & Engine Akuntansi
├── firebase-config.js  # Konfigurasi koneksi ke server Firebase
├── firestore.rules     # (Referensi) Aturan keamanan Firebase Database
└── README.md           # Panduan ini
```

## 🐛 Troubleshooting

*   **Layar Blank atau Terus Loading**:
    *   Buka *Developer Tools* browser (F12 / Cmd+Opt+J), lihat console error.
    *   Pastikan rules Firestore sudah disetel dengan benar ke `allow read, write: if isAuthenticated();`.
*   **Gagal Login**: Pastikan email/password benar, dan akun tersebut sudah dibuat di dalam Firebase Console (Tab Authentication).
*   **Laporan Tidak Seimbang (Unbalanced)**: Sistem mencegah pembuatan jurnal yang tidak *balance*. Jika terjadi *unbalanced* pada Neraca Saldo, pastikan Anda mengatur filter tanggal awal (Dari Tanggal) secara benar, biasanya dibiarkan kosong agar menarik saldo dari awal waktu.
