# PT DBG Finance — Panduan Setup Firebase

## 1. Enable Firebase Authentication

1. Buka [Firebase Console](https://console.firebase.google.com/project/dbg-finance/authentication)
2. Klik **"Get started"**
3. Pilih **"Email/Password"** → Enable → Save
4. Klik **"Add user"** → masukkan email & password untuk login

## 2. Enable Firestore Database

1. Buka [Firestore](https://console.firebase.google.com/project/dbg-finance/firestore)
2. Klik **"Create database"**
3. Pilih mode: **"Production mode"** (kita akan set rules manual)
4. Pilih lokasi: **asia-southeast1 (Singapore)** → Create

## 3. Deploy Firestore Security Rules

Buka **Rules** tab di Firestore, salin dan paste:

```
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

Klik **"Publish"**

## 4. Jalankan Aplikasi

```bash
# Opsi 1: Python (sudah tersedia di Mac)
python3 -m http.server 8080 --directory "/path/to/DBG-finance"

# Opsi 2: VS Code Live Server
# Install extension "Live Server" → klik "Go Live"
```

Buka browser → http://localhost:8080

## 5. Login Pertama Kali

Gunakan email & password yang dibuat di langkah 1.

Setelah login:
- COA akan otomatis ter-seed dengan 68 akun default
- Buka **Pengaturan** untuk mengisi data perusahaan
- Mulai input transaksi!

## Struktur File

```
DBG-finance/
├── index.html          # Shell SPA (semua halaman)
├── index.css           # Design system (dark mode + glassmorphism)
├── app.js              # Logika utama (Firebase + CRUD)
├── firebase-config.js  # Konfigurasi Firebase SDK
└── firestore.rules     # Security rules (deploy manual ke console)
```
