import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "dokumen tidak ditemukan" }, { status: 404 });
  if (doc.status === "completed" || doc.status === "rejected") {
    return NextResponse.json({ error: "dokumen sudah selesai/ditolak" }, { status: 409 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body JSON wajib" }, { status: 400 });
  const signerId = parseInt(String(body.signerId), 10);
  const signer = await prisma.signer.findFirst({ where: { id: signerId, documentId: id } });
  if (!signer) return NextResponse.json({ error: "signer tidak ditemukan di dokumen ini" }, { status: 404 });
  const page = parseInt(String(body.page ?? 1), 10);
  const x = parseFloat(body.x), y = parseFloat(body.y);
  if (!page || page < 1) return NextResponse.json({ error: "page harus >= 1" }, { status: 400 });
  if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) {
    return NextResponse.json({ error: "x dan y harus angka >= 0" }, { status: 400 });
  }
  const width = body.width !== undefined ? parseFloat(body.width) : 150;
  const height = body.height !== undefined ? parseFloat(body.height) : 50;
  if (Number.isNaN(width) || Number.isNaN(height) || width <= 0 || height <= 0) {
    return NextResponse.json({ error: "width/height harus angka > 0" }, { status: 400 });
  }
  const field = await prisma.signatureField.create({
    data: { documentId: id, signerId, page, x, y, width, height },
  });
  return NextResponse.json(field, { status: 201 });
}
