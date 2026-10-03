import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { verifyDownloadToken } from "@/lib/tokens";

export async function GET(req: Request, { params }: { params: { versionId: string } }) {
  const versionId = parseInt(params.versionId, 10);
  if (!versionId) return NextResponse.json({ error: "versionId tidak valid" }, { status: 400 });
  const url = new URL(req.url);
  const sig = url.searchParams.get("sig");
  if (!verifyDownloadToken(versionId, sig)) {
    return NextResponse.json({ error: "token unduhan tidak valid/kedaluwarsa" }, { status: 403 });
  }
  const dv = await prisma.docVersion.findUnique({
    where: { id: versionId },
    include: { document: { select: { title: true } } },
  });
  if (!dv) return NextResponse.json({ error: "versi tidak ditemukan" }, { status: 404 });
  const absPath = path.join(process.cwd(), dv.filePath);
  try {
    const bytes = await fs.readFile(absPath);
    const res = new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${dv.document.title.replace(/[^\w\- ]/g, "")}_v${dv.version}.pdf"`,
      },
    });
    return res;
  } catch {
    return NextResponse.json({ error: "file tidak ditemukan di penyimpanan" }, { status: 404 });
  }
}
