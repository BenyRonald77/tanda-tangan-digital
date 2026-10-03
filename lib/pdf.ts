import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { nowIso } from "./format";

export const sha256Hex = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest("hex");

/** Buat PDF contoh satu halaman (untuk seed / pengujian). */
export async function createSamplePdf(title: string, body: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title, { x: 50, y: 780, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  const lines = body.match(/.{1,80}(\s|$)/g) ?? [body];
  let y = 740;
  for (const line of lines.slice(0, 30)) {
    page.drawText(line.trim(), { x: 50, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
  }
  page.drawText(`Dibuat: ${nowIso()}`, { x: 50, y: 60, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/** Gambar stempel tanda tangan (nama + tanggal) di koordinat field.
 *  x,y diukur dari kiri-atas halaman; pdf-lib memakai kiri-bawah. */
export async function stampSignatures(
  pdfBytes: Buffer,
  stamps: { page: number; x: number; y: number; width: number; height: number; name: string }[]
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const stampDate = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  for (const s of stamps) {
    const pageIdx = s.page - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;
    const page = pages[pageIdx];
    const { height } = page.getSize();
    const px = s.x;
    const py = height - s.y - s.height; // konversi kiri-atas -> kiri-bawah
    // kotak tanda tangan
    page.drawRectangle({
      x: px,
      y: py,
      width: s.width,
      height: s.height,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1.5,
      color: rgb(0.95, 0.97, 1),
    });
    page.drawText("Ditandatangani secara digital oleh:", {
      x: px + 6,
      y: py + s.height - 16,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(s.name, {
      x: px + 6,
      y: py + s.height / 2 - 2,
      size: 14,
      font,
      color: rgb(0.1, 0.2, 0.6),
    });
    page.drawText(`pada ${stampDate}`, {
      x: px + 6,
      y: py + 8,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
