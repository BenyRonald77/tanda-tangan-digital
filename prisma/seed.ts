import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { createSamplePdf, sha256Hex } from "../lib/pdf";
import { newSignerToken } from "../lib/tokens";
import { nowIso } from "../lib/format";

const prisma = new PrismaClient();

async function storePdf(documentId: number, version: number, title: string, body: string, note: string) {
  const buf = await createSamplePdf(title, body);
  const dir = path.join(process.cwd(), "storage");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `doc${documentId}_v${version}.pdf`;
  const filePath = path.join("storage", fileName);
  await fs.writeFile(path.join(process.cwd(), filePath), buf);
  await prisma.docVersion.create({
    data: {
      documentId,
      version,
      filePath,
      sha256: sha256Hex(buf),
      note,
      createdAt: nowIso(),
    },
  });
}

async function main() {
  const n = await prisma.document.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }

  // Dokumen 1: sequential 2 signer
  const doc1 = await prisma.document.create({
    data: {
      title: "Surat Perjanjian Kerjasama",
      status: "in_signing",
      mode: "sequential",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  });
  await storePdf(
    doc1.id,
    1,
    "Surat Perjanjian Kerjasama",
    "Perjanjian ini dibuat antara PT Maju Bersama dan CV Sinar Abadi mengenai kerjasama distribusi produk.",
    "Versi awal (seed)"
  );
  const s1 = await prisma.signer.create({
    data: {
      documentId: doc1.id,
      name: "Andi Wijaya",
      email: "andi@example.com",
      order: 1,
      token: newSignerToken(),
      status: "pending",
    },
  });
  const s2 = await prisma.signer.create({
    data: {
      documentId: doc1.id,
      name: "Budi Santoso",
      email: "budi@example.com",
      order: 2,
      token: newSignerToken(),
      status: "pending",
    },
  });
  await prisma.signatureField.createMany({
    data: [
      { documentId: doc1.id, signerId: s1.id, page: 1, x: 50, y: 600, width: 200, height: 60 },
      { documentId: doc1.id, signerId: s2.id, page: 1, x: 320, y: 600, width: 200, height: 60 },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { documentId: doc1.id, actor: "admin", action: "created", ip: "127.0.0.1", userAgent: "seed", createdAt: nowIso() },
      { documentId: doc1.id, actor: "Andi Wijaya", action: "viewed", ip: "10.0.0.5", userAgent: "seed", createdAt: nowIso() },
    ],
  });

  // Dokumen 2: parallel 2 signer
  const doc2 = await prisma.document.create({
    data: {
      title: "Berita Acara Rapat",
      status: "in_signing",
      mode: "parallel",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  });
  await storePdf(
    doc2.id,
    1,
    "Berita Acara Rapat",
    "Rapat koordinasi bulanan membahas progres proyek dan tindak lanjut temuan audit internal.",
    "Versi awal (seed)"
  );
  const s3 = await prisma.signer.create({
    data: {
      documentId: doc2.id,
      name: "Citra Dewi",
      email: "citra@example.com",
      order: 1,
      token: newSignerToken(),
      status: "pending",
    },
  });
  const s4 = await prisma.signer.create({
    data: {
      documentId: doc2.id,
      name: "Dedi Kurniawan",
      email: "dedi@example.com",
      order: 2,
      token: newSignerToken(),
      status: "pending",
    },
  });
  await prisma.signatureField.createMany({
    data: [
      { documentId: doc2.id, signerId: s3.id, page: 1, x: 50, y: 640, width: 200, height: 60 },
      { documentId: doc2.id, signerId: s4.id, page: 1, x: 320, y: 640, width: 200, height: 60 },
    ],
  });
  await prisma.auditLog.create({
    data: {
      documentId: doc2.id,
      actor: "admin",
      action: "created",
      ip: "127.0.0.1",
      userAgent: "seed",
      createdAt: nowIso(),
    },
  });

  console.log("seed selesai: 2 dokumen, 4 signer, field, dan audit log");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
