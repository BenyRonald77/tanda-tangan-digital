"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  created: "Dibuat",
  viewed: "Dilihat",
  signed: "Ditandatangani",
  rejected: "Ditolak",
  downloaded: "Diunduh",
  verified: "Diverifikasi",
};

type Detail = {
  id: number; title: string; status: string; mode: string;
  totalSigner: number; signed: number;
  signers: { id: number; name: string; email: string; order: number; token: string; status: string; signedAt: string | null; fields: { id: number; page: number; x: number; y: number; width: number; height: number }[] }[];
  versions: { id: number; version: number; sha256: string; note: string; createdAt: string; downloadToken: string }[];
  audits: { id: number; actor: string; action: string; ip: string; userAgent: string; createdAt: string }[];
};

export default function DetailPage({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sOrder, setSOrder] = useState("");
  const [fSigner, setFSigner] = useState("");
  const [fPage, setFPage] = useState("1");
  const [fX, setFX] = useState("50");
  const [fY, setFY] = useState("600");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const r = await fetch(`/api/documents/${params.id}`);
    if (r.ok) setDoc(await r.json());
  };
  useEffect(() => { load(); }, [params.id]);

  const upload = async () => {
    if (!file) return setMsg("Pilih file PDF dulu");
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/documents/${params.id}/upload`, { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return setMsg(`Upload gagal: ${j.error}`);
    setMsg(`Upload OK — versi ${j.version}, SHA-256 ${j.sha256.slice(0, 16)}…`);
    setFile(null);
    load();
  };

  const addSigner = async () => {
    const r = await fetch(`/api/documents/${params.id}/signers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sName, email: sEmail, order: sOrder ? parseInt(sOrder, 10) : undefined }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(`Gagal tambah signer: ${j.error}`);
    setMsg(`Signer ditambahkan. Link: ${j.signUrl}`);
    setSName(""); setSEmail(""); setSOrder("");
    load();
  };

  const addField = async () => {
    const r = await fetch(`/api/documents/${params.id}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signerId: parseInt(fSigner, 10),
        page: parseInt(fPage, 10),
        x: parseFloat(fX),
        y: parseFloat(fY),
      }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(`Gagal tambah posisi: ${j.error}`);
    setMsg("Posisi tanda tangan ditambahkan.");
    load();
  };

  if (!doc) return <main className="p-6">Memuat…</main>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← Kembali</Link>
      <h1 className="mt-2 text-2xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mode: {doc.mode === "sequential" ? "Berurutan" : "Bebas"} · Status: <b>{doc.status}</b> ·
        Progress: {doc.signed}/{doc.totalSigner}
      </p>
      {msg && <p className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-800 break-all">{msg}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg bg-white p-5 shadow">
          <h2 className="mb-3 font-semibold">Upload PDF</h2>
          <div className="flex gap-2">
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <button onClick={upload} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">Upload</button>
          </div>
          <h3 className="mb-2 mt-4 font-medium text-sm">Versi Dokumen</h3>
          <ul className="space-y-2 text-sm">
            {doc.versions.map((v) => (
              <li key={v.id} className="rounded border p-2">
                <div className="flex justify-between">
                  <span className="font-medium">v{v.version}</span>
                  <a
                    href={`/api/files/${v.id}?sig=${v.downloadToken}`}
                    className="text-blue-600 hover:underline"
                  >
                    Unduh
                  </a>
                </div>
                <div className="text-xs text-slate-500">{v.note} · {fmtDateTime(v.createdAt)}</div>
                <div className="break-all font-mono text-xs text-slate-500">{v.sha256}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg bg-white p-5 shadow">
          <h2 className="mb-3 font-semibold">Penanda Tangan</h2>
          <div className="mb-3 space-y-2">
            <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Nama" className="w-full rounded border px-3 py-1.5 text-sm" />
            <input value={sEmail} onChange={(e) => setSEmail(e.target.value)} placeholder="Email" className="w-full rounded border px-3 py-1.5 text-sm" />
            <input value={sOrder} onChange={(e) => setSOrder(e.target.value)} placeholder="Urutan (opsional)" className="w-full rounded border px-3 py-1.5 text-sm" />
            <button onClick={addSigner} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">Tambah Signer</button>
          </div>
          <ul className="space-y-2 text-sm">
            {doc.signers.map((s) => (
              <li key={s.id} className="rounded border p-2">
                <div className="flex justify-between">
                  <span className="font-medium">#{s.order} {s.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${s.status === "signed" ? "bg-green-100 text-green-800" : s.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{s.email}</div>
                <div className="break-all font-mono text-xs text-slate-500">/sign/{s.token}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-3 font-semibold">Posisi Tanda Tangan</h2>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">Signer
            <select value={fSigner} onChange={(e) => setFSigner(e.target.value)} className="ml-1 rounded border px-2 py-1.5 text-sm">
              <option value="">— pilih —</option>
              {doc.signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Halaman <input value={fPage} onChange={(e) => setFPage(e.target.value)} className="ml-1 w-16 rounded border px-2 py-1.5 text-sm" /></label>
          <label className="text-sm">X <input value={fX} onChange={(e) => setFX(e.target.value)} className="ml-1 w-20 rounded border px-2 py-1.5 text-sm" /></label>
          <label className="text-sm">Y <input value={fY} onChange={(e) => setFY(e.target.value)} className="ml-1 w-20 rounded border px-2 py-1.5 text-sm" /></label>
          <button onClick={addField} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">Tambah</button>
        </div>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {doc.signers.flatMap((s) =>
            s.fields.map((f) => (
              <li key={f.id} className="rounded border p-2 text-xs">
                {s.name} — halaman {f.page}, x={f.x}, y={f.y}, {f.width}×{f.height}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-6 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-3 font-semibold">Audit Trail</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="py-2">Waktu</th><th>Pelaku</th><th>Aksi</th><th>IP</th>
            </tr>
          </thead>
          <tbody>
            {doc.audits.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2">{fmtDateTime(a.createdAt)}</td>
                <td>{a.actor}</td>
                <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                <td className="font-mono text-xs">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
