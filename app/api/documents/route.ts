import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nowIso } from "@/lib/format";

const MODES = ["sequential", "parallel"];

export async function GET() {
  const docs = await prisma.document.findMany({
    orderBy: { id: "desc" },
    include: { signers: { select: { status: true } } },
  });
  const rows = docs.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    mode: d.mode,
    createdAt: d.createdAt,
    totalSigner: d.signers.length,
    signed: d.signers.filter((s) => s.status === "signed").length,
  }));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title wajib diisi" }, { status: 400 });
  }
  const mode = body.mode ?? "sequential";
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: "mode harus sequential|parallel" }, { status: 400 });
  }
  const doc = await prisma.document.create({
    data: {
      title: body.title.trim(),
      mode,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  });
  return NextResponse.json(doc, { status: 201 });
}
