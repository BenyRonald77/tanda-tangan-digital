import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/pdf";
import { clientIp, userAgent } from "@/lib/request";
import { nowIso } from "@/lib/format";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file wajib diisi (multipart field 'file')" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ukuran file maksimal 10 MB" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = sha256Hex(bytes);

  const match = await prisma.docVersion.findFirst({
    where: { sha256: hash },
    include: {
      document: {
        include: {
          signers: { orderBy: { order: "asc" }, select: { name: true, status: true, signedAt: true } },
          versions: { orderBy: { version: "asc" }, select: { version: true, note: true, createdAt: true, sha256: true } },
        },
      },
    },
  });
  if (!match) {
    return NextResponse.json({ valid: false, sha256: hash });
  }
  await prisma.auditLog.create({
    data: {
      documentId: match.documentId,
      actor: "publik (verifikasi)",
      action: "verified",
      ip: clientIp(req),
      userAgent: userAgent(req),
      createdAt: nowIso(),
    },
  });
  return NextResponse.json({
    valid: true,
    sha256: hash,
    document: {
      id: match.document.id,
      title: match.document.title,
      status: match.document.status,
      mode: match.document.mode,
      signers: match.document.signers,
    },
    version: {
      version: match.version,
      note: match.note,
      createdAt: match.createdAt,
    },
    versionHistory: match.document.versions,
  });
}
