import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signDownloadToken } from "@/lib/tokens";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      signers: { orderBy: { order: "asc" }, include: { fields: true } },
      fields: true,
      versions: { orderBy: { version: "desc" } },
      audits: { orderBy: { id: "desc" } },
    },
  });
  if (!doc) return NextResponse.json({ error: "dokumen tidak ditemukan" }, { status: 404 });
  const versions = doc.versions.map((v) => ({
    ...v,
    downloadToken: signDownloadToken(v.id),
  }));
  const totalSigner = doc.signers.length;
  const signed = doc.signers.filter((s) => s.status === "signed").length;
  return NextResponse.json({ ...doc, versions, totalSigner, signed });
}
