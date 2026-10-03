"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

type Info = {
  signer: { id: number; name: string; email: string; order: number; status: string; signedAt: string | null; fields: { page: number; x: number; y: number; width: number; height: number }[] };
  document: { id: number; title: string; status: string; mode: string };
  signers: { name: string; order: number; status: string }[];
};

export default function SignPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/sign/${params.token}`);
      if (r.status === 404) return setError("Tautan tidak valid atau sudah tidak berlaku (404).");
      if (!r.ok) return setError("Gagal memuat data.");
      const j = await r.json();
      setInfo(j);
      // catat "viewed"
      await fetch(`/api/sign/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "viewed" }),
      });
    })();
  }, [params.token]);

  const act = async (action: "sign" | "reject") => {
    if (action === "sign" && !confirm("Tanda tangani dokumen ini?")) return;
    if (action === "reject" && !confirm("Tolak dokumen ini?")) return;
    const r = await fetch(`/api/sign/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(`Gagal: ${j.error}`);
    setMsg(action === "sign" ? `Berhasil ditandatangani (versi ${j.version}).` : "Dokumen ditolak.");
    const rr = await fetch(`/api/sign/${params.token}`);
    if (rr.ok) setInfo(await rr.json());
  };

  if (error)
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-800">{error}</p>
          <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Ke beranda</Link>
        </div>
      </main>
    );
  if (!info) return <main className="p-6">Memuat…</main>;

  const canAct = info.signer.status === "pending" && info.document.status === "in_signing";
  const turnOk =
    info.document.mode !== "sequential" ||
    (info.signers.find((s) => s.status === "pending")?.name === info.signer.name);

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">{info.document.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Halo, <b>{info.signer.name}</b> ({info.signer.email}) — penanda tangan #{info.signer.order}.
          Mode: {info.document.mode === "sequential" ? "berurutan" : "bebas"}.
        </p>
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium">Urutan penanda tangan</div>
          <ol className="space-y-1 text-sm">
            {info.signers.map((s) => (
              <li key={s.order} className={`rounded border p-2 ${s.name === info.signer.name ? "border-blue-500 bg-blue-50" : ""}`}>
                #{s.order} {s.name} — {s.status === "signed" ? "✅ sudah tanda tangan" : s.status === "rejected" ? "❌ menolak" : "⏳ menunggu"}
              </li>
            ))}
          </ol>
        </div>
        {info.signer.status !== "pending" && (
          <p className="mt-4 rounded bg-slate-100 p-3 text-sm">
            Anda sudah {info.signer.status === "signed" ? "menandatangani" : "menolak"} dokumen ini
            {info.signer.signedAt ? ` pada ${fmtDateTime(info.signer.signedAt)}` : ""}.
          </p>
        )}
        {canAct && (
          <div className="mt-4">
            {!turnOk && info.document.mode === "sequential" && (
              <p className="mb-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
                Belum giliran Anda. Silakan tunggu penanda tangan sebelumnya.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => act("sign")} className="flex-1 rounded bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-500">
                ✍️ Tanda Tangani
              </button>
              <button onClick={() => act("reject")} className="flex-1 rounded bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-500">
                Tolak
              </button>
            </div>
          </div>
        )}
        {msg && <p className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-800">{msg}</p>}
      </div>
    </main>
  );
}
