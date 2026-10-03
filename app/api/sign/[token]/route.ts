import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { stampSignatures, sha256Hex } from "@/lib/pdf";
import { clientIp, userAgent } from "@/lib/request";
import { nowIso } from "@/lib/format";

type Ctx = { params: { token: string } };

async function findSigner(token: string) {
  return prisma.signer.findUnique({
    where: { token },
    include: {
      document: true,
      fields: true,
    },
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const signer = await findSigner(params.token);
  if (!signer) return NextResponse.json({ error: "token tidak dikenal" }, { status: 404 });
  const { document } = signer;
  const signers = await prisma.signer.findMany({
    where: { documentId: document.id },
    orderBy: { order: "asc" },
    select: { name: true, order: true, status: true },
  });
  return NextResponse.json({
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      order: signer.order,
      status: signer.status,
      signedAt: signer.signedAt,
      fields: signer.fields,
    },
    document: {
      id: document.id,
      title: document.title,
      status: document.status,
      mode: document.mode,
    },
    signers,
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const signer = await findSigner(params.token);
  if (!signer) return NextResponse.json({ error: "token tidak dikenal" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const doc = signer.document;
  const ip = clientIp(req);
  const ua = userAgent(req);

  if (action === "viewed") {
    await prisma.auditLog.create({
      data: { documentId: doc.id, actor: signer.name, action: "viewed", ip, userAgent: ua, createdAt: nowIso() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (signer.status !== "pending") {
      return NextResponse.json({ error: "signer sudah memproses dokumen ini" }, { status: 409 });
    }
    if (doc.status !== "in_signing") {
      return NextResponse.json({ error: "dokumen tidak dalam tahap penandatanganan" }, { status: 409 });
    }
    const res = await prisma.signer.updateMany({
      where: { id: signer.id, status: "pending" },
      data: { status: "rejected", signedAt: nowIso() },
    });
    if (res.count === 0) return NextResponse.json({ error: "gagal memproses" }, { status: 409 });
    await prisma.document.update({ where: { id: doc.id }, data: { status: "rejected", updatedAt: nowIso() } });
    await prisma.auditLog.create({
      data: { documentId: doc.id, actor: signer.name, action: "rejected", ip, userAgent: ua, createdAt: nowIso() },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (action !== "sign") {
    return NextResponse.json({ error: "action harus viewed|sign|reject" }, { status: 400 });
  }

  // --- validasi giliran ---
  if (signer.status !== "pending") {
    return NextResponse.json({ error: "signer sudah memproses dokumen ini" }, { status: 409 });
  }
  if (doc.status !== "in_signing") {
    return NextResponse.json({ error: "dokumen tidak dalam tahap penandatanganan" }, { status: 409 });
  }
  if (doc.mode === "sequential") {
    const firstPending = await prisma.signer.findFirst({
      where: { documentId: doc.id, status: "pending" },
      orderBy: { order: "asc" },
    });
    if (!firstPending || firstPending.id !== signer.id) {
      return NextResponse.json(
        { error: `belum giliran Anda. Giliran saat ini: ${firstPending?.name ?? "-"}` },
        { status: 409 }
      );
    }
  }

  // --- stempel tanda tangan ke PDF ---
  const latest = await prisma.docVersion.findFirst({
    where: { documentId: doc.id },
    orderBy: { version: "desc" },
  });
  if (!latest) return NextResponse.json({ error: "dokumen belum punya file PDF" }, { status: 409 });
  const prevBytes = await fs.readFile(path.join(process.cwd(), latest.filePath));
  const stamped = await stampSignatures(
    prevBytes,
    signer.fields.map((f) => ({ page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, name: signer.name }))
  );
  const dir = path.join(process.cwd(), "storage");
  await fs.mkdir(dir, { recursive: true });
  const newVersion = latest.version + 1;
  const fileName = `doc${doc.id}_v${newVersion}_${Date.now()}.pdf`;
  const filePath = path.join("storage", fileName);
  await fs.writeFile(path.join(process.cwd(), filePath), stamped);
  const dv = await prisma.docVersion.create({
    data: {
      documentId: doc.id,
      version: newVersion,
      filePath,
      sha256: sha256Hex(stamped),
      note: `Ditandatangani oleh ${signer.name}`,
      createdAt: nowIso(),
    },
  });

  // --- update atomik: conditional updateMany single-statement ---
  const upd = await prisma.signer.updateMany({
    where: { id: signer.id, status: "pending" },
    data: { status: "signed", signedAt: nowIso() },
  });
  if (upd.count === 0) {
    // rollback versi yang baru dibuat agar konsisten
    await prisma.docVersion.delete({ where: { id: dv.id } }).catch(() => {});
    return NextResponse.json({ error: "gagal memproses (sudah diproses sebelumnya)" }, { status: 409 });
  }
  await prisma.auditLog.create({
    data: { documentId: doc.id, actor: signer.name, action: "signed", ip, userAgent: ua, createdAt: nowIso() },
  });

  const remaining = await prisma.signer.count({ where: { documentId: doc.id, status: "pending" } });
  let docStatus = "in_signing";
  if (remaining === 0) {
    docStatus = "completed";
    await prisma.document.update({ where: { id: doc.id }, data: { status: "completed", updatedAt: nowIso() } });
  }
  return NextResponse.json({
    ok: true,
    version: dv.version,
    sha256: dv.sha256,
    documentStatus: docStatus,
  });
}
