# Tanda Tangan Digital

Aplikasi tanda tangan dokumen digital: upload PDF, tentukan penanda tangan
(sequential/parallel) beserta posisi tanda tangan, link publik per signer
berisi token unik, stempel tanda tangan dibakar ke PDF per penandatanganan,
audit trail lengkap, dan verifikasi keaslian PDF lewat SHA-256.

## Cara Menjalankan

```
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## Halaman

- `/` — dashboard dokumen + progress penanda tangan
- `/documents/[id]` — detail dokumen: signer, posisi tanda tangan, versi file, audit
- `/sign/[token]` — halaman tanda tangan publik untuk signer
- `/verify` — verifikasi keaslian file PDF

## API

- `GET/POST /api/documents`
- `GET /api/documents/[id]`
- `POST /api/documents/[id]/upload` (multipart PDF, maks 10 MB)
- `POST /api/documents/[id]/signers`
- `POST /api/documents/[id]/fields`
- `GET /api/documents/[id]/audit`
- `GET /api/sign/[token]` · `POST /api/sign/[token]` (aksi `viewed|sign|reject`)
- `GET /api/files/[versionId]?sig=..&exp=..` (unduh bertoken HMAC)
- `POST /api/verify` (multipart PDF → ASLI/TIDAK DIKENAL)
