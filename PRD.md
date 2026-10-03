# PRD — Tanda Tangan Dokumen Digital

**Stack:** Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind (App Router).

Aplikasi tanda tangan dokumen digital: upload PDF, tentukan penanda tangan
(berurutan/sequential atau bebas/parallel) beserta posisi tanda tangan per
halaman, setiap signer menerima link publik berisi token unik untuk
menandatangani, stempel tanda tangan (nama + tanggal) dibakar ke PDF dengan
pdf-lib per penandatanganan, dan setiap aksi tercatat di audit trail. Halaman
verifikasi publik membuktikan keaslian file PDF lewat SHA-256.

## Model

- **Document** `{id, title, status: draft|in_signing|completed|rejected,
  mode: sequential|parallel, createdAt, updatedAt}`
- **Signer** `{id, documentId, name, email, order, token(unique),
  status: pending|signed|rejected, signedAt}`
- **SignatureField** `{id, documentId, signerId, page, x, y, width, height}`
  — x,y dalam koordinat dari kiri-atas halaman PDF.
- **DocVersion** `{id, documentId, version, filePath, sha256, note, createdAt}`
  — setiap penandatanganan membuat versi baru dengan hash baru.
- **AuditLog** `{id, documentId, actor, action:
  created|viewed|signed|rejected|downloaded|verified, ip, userAgent, createdAt}`

## Fungsionalitas

- **F0** — Scaffold + PRD + schema Prisma + seed.
- **F1** — Upload PDF: validasi `application/pdf`, batas 10 MB → simpan di
  `storage/` (gitignored, dilayani lewat route bertoken) → DocVersion v1 +
  SHA-256 + audit `created`.
- **F2** — Kelola penanda tangan: tambah (nama, email, order) + mode
  sequential|parallel; posisi tanda tangan per halaman (page, x, y);
  token unik per signer → link publik `/sign/[token]`.
- **F3** — Alur tanda tangan: buka `/sign/[token]` → audit `viewed` (catat IP
  dari header). Klik "Tanda tangani": validasi giliran — sequential: hanya
  signer dengan order terkecil yang masih pending (selain itu 409); parallel:
  semua pending boleh. Saat signed: stempel nama + tanggal ke PDF via pdf-lib
  → DocVersion baru + SHA-256 baru + audit `signed`. Tolak → status
  `rejected` + audit. Semua signer signed → dokumen `completed`.
- **F4** — Audit trail: endpoint + UI daftar lengkap per dokumen (siapa, aksi
  apa, kapan, IP).
- **F5** — Verifikasi publik `/verify`: upload PDF → SHA-256 → cocokkan dengan
  semua DocVersion → ASLI (dokumen, versi, riwayat) atau TIDAK DIKENAL.
  UI: dashboard dokumen + progress signer, detail dokumen + audit, halaman
  sign publik, halaman verify.

## Aturan Bisnis

- Upload hanya PDF (`application/pdf`) dan maksimal 10 MB, selain itu 400.
- Token signer unik dan tidak bisa ditebak; token salah → 404.
- Mode sequential: penandatangan di luar giliran → 409.
- Sign hanya boleh saat dokumen `in_signing` dan status signer `pending`.
- Penandatanganan bersifat atomik: conditional `updateMany` single-statement,
  cek jumlah row terpengaruh.
- Setiap aksi penting menulis AuditLog dengan IP (dari header
  `x-forwarded-for`) dan user-agent.
- Download file PDF hanya lewat link bertoken HMAC berkadaluarsa.

## API

- `GET/POST /api/documents` — daftar + buat dokumen.
- `GET /api/documents/[id]` — detail (signer, field, versi, audit).
- `POST /api/documents/[id]/upload` — upload PDF (multipart).
- `POST /api/documents/[id]/signers` — tambah signer.
- `POST /api/documents/[id]/fields` — tambah posisi tanda tangan.
- `GET /api/documents/[id]/audit` — audit trail.
- `GET /api/sign/[token]` — info penandatanganan.
- `POST /api/sign/[token]` — aksi `viewed|sign|reject`.
- `GET /api/files/[versionId]?sig=..&exp=..` — unduh PDF versi.
- `POST /api/verify` — verifikasi keaslian PDF (multipart).

## UI (Bahasa Indonesia)

- `/` — dashboard dokumen + progress penanda tangan.
- `/documents/[id]` — detail dokumen, kelola signer & posisi, riwayat audit.
- `/sign/[token]` — halaman tanda tangan publik.
- `/verify` — verifikasi keaslian PDF.

## Seed

1 dokumen sequential (2 signer) + 1 dokumen parallel (2 signer) + field
posisi + beberapa audit log.

## Cara Menjalankan

```
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```
