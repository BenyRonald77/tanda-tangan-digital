import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "dokumen tidak ditemukan" }, { status: 404 });
  const logs = await prisma.auditLog.findMany({
    where: { documentId: id },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(logs);
}
