"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

type Doc = {
  id: number;
  title: string;
  status: string;
  mode: string;
  createdAt: string;
  totalSigner: number;
  signed: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  in_signing: "Proses Tanda Tangan",
  completed: "Selesai",
  rejected: "Ditolak",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  in_signing: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function Dashboard() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("sequential");

  const load = async () => {
    const r = await fetch("/api/documents");
    setDocs(await r.json());
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return alert("Judul wajib diisi");
    const r = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, mode }),
    });
    if (!r.ok) return alert("Gagal membuat dokumen");
    setTitle("");
    load();
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tanda Tangan Digital</h1>
        <Link href="/verify" className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Verifikasi PDF
        </Link>
      </div>

      <section className="mb-8 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-3 font-semibold">Dokumen Baru</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul dokumen"
            className="flex-1 min-w-[200px] rounded border px-3 py-2"
          />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded border px-3 py-2">
            <option value="sequential">Berurutan (sequential)</option>
            <option value="parallel">Bebas (parallel)</option>
          </select>
          <button onClick={create} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Buat
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Daftar Dokumen</h2>
        <div className="grid gap-4">
          {docs.map((d) => (
            <Link key={d.id} href={`/documents/${d.id}`} className="rounded-lg bg-white p-5 shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {d.mode === "sequential" ? "Berurutan" : "Bebas"} · dibuat {fmtDateTime(d.createdAt)}
                  </div>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLOR[d.status] ?? "bg-slate-200"}`}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>Progress tanda tangan</span>
                  <span>{d.signed}/{d.totalSigner}</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-200">
                  <div
                    className="h-2 rounded bg-blue-600"
                    style={{ width: d.totalSigner ? `${(d.signed / d.totalSigner) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            </Link>
          ))}
          {docs.length === 0 && <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
        </div>
      </section>
    </main>
  );
}
