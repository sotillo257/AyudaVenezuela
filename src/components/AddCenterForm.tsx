"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS, OPERADOR_LABEL } from "@/lib/util";
import type { Operador } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="h-48 w-full bg-stone-100 rounded-xl" />,
});

const OPERADORES = Object.keys(OPERADOR_LABEL) as Operador[];

export default function AddCenterForm() {
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [acepta, setAcepta] = useState<string[]>([]);
  const [form, setForm] = useState({
    nombre: "", operador: "asociacion" as Operador, direccion: "", area: "",
    contacto: "", fuente_url: "", responsable: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setErr(null);
    if (!form.nombre || !pos) { setErr("Indica al menos el nombre y la ubicación en el mapa."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("proponer_centro", {
      p_nombre: form.nombre, p_operador: form.operador, p_lat: pos[0], p_lon: pos[1],
      p_direccion: form.direccion, p_area: form.area, p_contacto: form.contacto,
      p_acepta: acepta, p_fuente_url: form.fuente_url, p_responsable: form.responsable,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <h2 className="text-xl font-extrabold mt-3">Enviado a revisión</h2>
        <p className="text-stone-500 text-sm mt-2">
          No aparece en el mapa hasta que un moderador confirme la fuente y que sigue activo. Gracias.
        </p>
        <Link href="/" className="inline-block mt-5 text-emerald-700 font-semibold">← Volver al mapa</Link>
      </div>
    );
  }

  const input = "w-full text-[14px] bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 placeholder:text-stone-400";

  return (
    <div className="px-5 py-5 space-y-3">
      <p className="text-[12.5px] text-stone-500">
        Entra a revisión, no se publica automáticamente. Cuanto mejor la evidencia, antes se aprueba.
      </p>

      <input className={input} placeholder="Organización responsable *" value={form.nombre} onChange={set("nombre")} />

      <select className={input} value={form.operador} onChange={set("operador")}>
        {OPERADORES.map((o) => <option key={o} value={o}>{OPERADOR_LABEL[o]}</option>)}
      </select>

      <input className={input} placeholder="Dirección" value={form.direccion} onChange={set("direccion")} />
      <input className={input} placeholder="Zona / ciudad (ej. L'Hospitalet)" value={form.area} onChange={set("area")} />
      <input className={input} placeholder="Contacto (teléfono / email)" value={form.contacto} onChange={set("contacto")} />
      <input className={input} placeholder="Enlace público de evidencia (URL)" value={form.fuente_url} onChange={set("fuente_url")} />
      <input className={input} placeholder="Persona responsable" value={form.responsable} onChange={set("responsable")} />

      <div>
        <p className="text-[12px] font-semibold text-stone-600 mb-1.5">¿Qué acepta?</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => (
            <button key={c} type="button"
              onClick={() => setAcepta((a) => a.includes(c) ? a.filter((x) => x !== c) : [...a, c])}
              className={`text-[12px] px-3 py-1.5 rounded-full border ${
                acepta.includes(c) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-stone-600 border-stone-200"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-stone-600 mb-1.5">
          Ubicación * {pos && <span className="text-stone-400 font-normal">({pos[0].toFixed(4)}, {pos[1].toFixed(4)})</span>}
        </p>
        <p className="text-[11px] text-stone-400 mb-1.5">Toca el mapa para fijar el punto exacto.</p>
        <MapPicker value={pos} onPick={(lat, lon) => setPos([lat, lon])} />
      </div>

      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}

      <button onClick={submit} disabled={busy}
        className="w-full bg-stone-900 text-white font-semibold py-3 rounded-xl text-[14px] disabled:opacity-50">
        {busy ? "Enviando…" : "Enviar a revisión"}
      </button>
    </div>
  );
}
