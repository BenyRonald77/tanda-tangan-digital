import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/pdf";
import { clientIp, userAgent } from "@/lib/request";
import { nowIso } from "@/lib/format";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const doc = await prisma.document.findUnique({ where: { id }, include: { signers: true } });
  if (!doc) return NextResponse.json({ error: "dokumen tidak ditemukan" }, { status: 404 });
  if (doc.status === "completed" || doc.status === "rejected") {
    return NextResponse.json({ error: "dokumen sudah selesai/ditolak, tidak bisa upload" }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file wajib diisi (multipart field 'file')" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "file harus bertipe application/pdf" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ukuran file maksimal 10 MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // cek magic bytes PDF
  if (!bytes.subarray(0, 5).toString().startsWith("%PDF-")) {
    return NextResponse.json({ error: "file bukan PDF yang valid" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "storage");
  await fs.mkdir(dir, { recursive: true });
  const latest = await prisma.docVersion.findFirst({
    where: { documentId: id },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;
  const fileName = `doc${id}_v${version}_${Date.now()}.pdf`;
  const filePath = path.join("storage", fileName);
  await fs.writeFile(path.join(process.cwd(), filePath), bytes);

  const dv = await prisma.docVersion.create({
    data: {
      documentId: id,
      version,
      filePath,
      sha256: sha256Hex(bytes),
      note: "Upload PDF",
      createdAt: nowIso(),
    },
  });
  await prisma.auditLog.create({
    data: {
      documentId: id,
      actor: "admin",
      action: "created",
      ip: clientIp(req),
      userAgent: userAgent(req),
      createdAt: nowIso(),
    },
  });
  // dokumen siap ditandatangani bila sudah ada signer
  const newStatus = doc.signers.length > 0 ? "in_signing" : "draft";
  await prisma.document.update({ where: { id }, data: { status: newStatus, updatedAt: nowIso() } });

  return NextResponse.json(dv, { status: 201 });
}
