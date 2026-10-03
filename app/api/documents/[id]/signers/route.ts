import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newSignerToken } from "@/lib/tokens";
import { nowIso } from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const doc = await prisma.document.findUnique({ where: { id }, include: { signers: true } });
  if (!doc) return NextResponse.json({ error: "dokumen tidak ditemukan" }, { status: 404 });
  if (doc.status === "completed" || doc.status === "rejected") {
    return NextResponse.json({ error: "dokumen sudah selesai/ditolak" }, { status: 409 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });
  }
  if (typeof body.email !== "string" || !EMAIL_RE.test(body.email.trim())) {
    return NextResponse.json({ error: "email tidak valid" }, { status: 400 });
  }
  const order = body.order !== undefined ? parseInt(String(body.order), 10) : doc.signers.length + 1;
  if (!order || order < 1) return NextResponse.json({ error: "order harus >= 1" }, { status: 400 });
  if (doc.signers.some((s) => s.order === order)) {
    return NextResponse.json({ error: `order ${order} sudah dipakai signer lain` }, { status: 409 });
  }

  const signer = await prisma.signer.create({
    data: {
      documentId: id,
      name: body.name.trim(),
      email: body.email.trim(),
      order,
      token: newSignerToken(),
      status: "pending",
    },
  });
  // jika dokumen sudah punya versi PDF, langsung masuk tahap penandatanganan
  const hasVersion = await prisma.docVersion.count({ where: { documentId: id } });
  const newStatus = hasVersion > 0 ? "in_signing" : "draft";
  if (newStatus !== doc.status) {
    await prisma.document.update({ where: { id }, data: { status: newStatus, updatedAt: nowIso() } });
  }
  return NextResponse.json(
    { ...signer, signUrl: `/sign/${signer.token}` },
    { status: 201 }
  );
}
