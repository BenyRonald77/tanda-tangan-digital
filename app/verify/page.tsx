"use client";
import { useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

type Result = {
  valid: boolean;
  sha256: string;
  document?: { id: number; title: string; status: string; mode: string; signers: { name: string; status: string; signedAt: string | null }[] };
  version?: { version: number; note: string; createdAt: string };
  versionHistory?: { version: number; note: string; createdAt: string; sha256: string }[];
};

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!file) return setError("Pilih file PDF dulu.");
    setLoading(true); setError(""); setRes(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/verify", { method: "POST", body: fd });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) return setError(j.error ?? "Gagal verifikasi");
    setRes(j);
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← Kembali</Link>
      <h1 className="mt-2 text-2xl font-bold">Verifikasi Keaslian Dokumen</h1>
      <p className="mt-1 text-sm text-slate-500">
        Unggah file PDF — sistem menghitung SHA-256 dan mencocokkannya dengan seluruh versi dokumen yang tercatat.
      </p>
      <div className="mt-4 rounded-lg bg-white p-5 shadow">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button onClick={submit} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            {loading ? "Memeriksa…" : "Verifikasi"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>

      {res && (
        <div className={`mt-4 rounded-lg p-5 shadow ${res.valid ? "bg-green-50" : "bg-red-50"}`}>
          {res.valid ? (
            <>
              <p className="text-lg font-bold text-green-800">✅ DOKUMEN ASLI</p>
              <p className="mt-2 font-semibold">{res.document?.title}</p>
              <p className="text-sm text-slate-600">
                Versi {res.version?.version} — {res.version?.note} ({fmtDateTime(res.version?.createdAt)})
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {res.document?.signers.map((s) => (
                  <li key={s.name}>{s.name} — {s.status}{s.signedAt ? ` (${fmtDateTime(s.signedAt)})` : ""}</li>
                ))}
              </ul>
              <p className="mt-3 break-all font-mono text-xs text-slate-500">SHA-256: {res.sha256}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-red-800">❌ TIDAK DIKENAL</p>
              <p className="mt-2 text-sm text-slate-600">
                Hash file tidak cocok dengan versi dokumen mana pun. File mungkin diubah atau bukan dokumen dari sistem ini.
              </p>
              <p className="mt-2 break-all font-mono text-xs text-slate-500">SHA-256: {res.sha256}</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
