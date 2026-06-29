"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS, OPERADOR_LABEL } from "@/lib/util";
import type { Operador } from "@/lib/types";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";

const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full rounded-xl bg-stone-100" />,
});

const OPERADORES = Object.keys(OPERADOR_LABEL) as Operador[];

type AddressSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    county?: string;
  };
};

export default function AddCenterForm() {
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [acepta, setAcepta] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchLabel, setSelectedSearchLabel] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "", operador: "asociacion" as Operador, direccion: "", area: "",
    contacto: "", fuente_url: "", responsable: "",
    proponenteNombre: "", proponenteApellido: "", proponenteTelefono: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 3) {
      setSearchResults([]);
      setSearchError(null);
      setSearchingAddress(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchingAddress(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }

        const data = (await response.json()) as AddressSuggestion[];
        setSearchResults(data);
        if (data.length === 0) {
          setSearchError("No encontré una dirección clara. Prueba con calle, ciudad o una referencia más específica.");
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSearchResults([]);
        setSearchError("No he podido buscar la dirección ahora mismo. Puedes seguir marcando el punto en el mapa.");
      } finally {
        setSearchingAddress(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  async function submit() {
    setErr(null);
    if (!form.nombre || !pos) { setErr("Indica al menos el nombre y la ubicación en el mapa."); return; }
    if (!form.proponenteNombre.trim() || !form.proponenteApellido.trim() || !form.proponenteTelefono.trim()) {
      setErr("Necesitamos nombre, apellido y teléfono de quien propone el centro para poder validarlo.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("proponer_centro", {
      p_nombre: form.nombre, p_operador: form.operador, p_lat: pos[0], p_lon: pos[1],
      p_direccion: form.direccion, p_area: form.area, p_contacto: form.contacto,
      p_acepta: acepta, p_fuente_url: form.fuente_url, p_responsable: form.responsable,
      p_proponente_nombre: form.proponenteNombre.trim(),
      p_proponente_apellido: form.proponenteApellido.trim(),
      p_proponente_telefono: form.proponenteTelefono.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  function selectSuggestion(result: AddressSuggestion) {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    const area = result.address?.city
      ?? result.address?.town
      ?? result.address?.village
      ?? result.address?.municipality
      ?? result.address?.state
      ?? result.address?.county
      ?? "";

    setPos([lat, lon]);
    setForm((current) => ({
      ...current,
      direccion: current.direccion.trim() ? current.direccion : result.display_name,
      area: current.area.trim() ? current.area : area,
    }));
    setSelectedSearchLabel(result.display_name);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setSearchError(null);
  }

  if (done) {
    return (
      <div className="px-6 py-16 text-center lg:py-24">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <h2 className="text-xl font-extrabold mt-3 lg:text-2xl">Ya está visible en el mapa</h2>
        <p className="text-stone-500 text-sm mt-2 lg:text-base lg:max-w-md lg:mx-auto">
          Ya aparece en el mapa como punto sin verificar. Un moderador lo revisará para decidir si pasa a mostrarse como punto confiable.
        </p>
        <Link href="/" className="inline-block mt-5 text-emerald-700 font-semibold lg:text-lg">← Volver al mapa</Link>
      </div>
    );
  }

  const input = "block w-full min-w-0 text-[14px] bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 placeholder:text-stone-400 lg:text-[15px] lg:px-4 lg:py-3";
  const twoColRow = "grid w-full grid-cols-1 gap-3 lg:grid-cols-2";

  return (
    <div className="px-5 py-5 space-y-3 lg:px-8 lg:py-7 lg:space-y-4">
      <p className="text-[12.5px] text-stone-500 lg:text-[14px]">
        Se publica al instante como punto sin verificar. Cuanto mejor la evidencia, antes podrá revisarse y pasar a punto confiable.
      </p>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12.5px] leading-relaxed text-sky-900 lg:text-[14px] lg:px-5 lg:py-4">
        <b>Validación del centro:</b> necesitamos el nombre, apellido y teléfono de quien lo propone.
        Estos datos <b>no se mostrarán públicamente</b>; se usarán solo para validar el centro si hace falta contactarte.
      </div>

      <div className={twoColRow}>
        <input className={input} placeholder="Organización responsable *" value={form.nombre} onChange={set("nombre")} />

        <select className={input} value={form.operador} onChange={set("operador")}>
          {OPERADORES.map((o) => <option key={o} value={o}>{OPERADOR_LABEL[o]}</option>)}
        </select>
      </div>

      <div className={twoColRow}>
        <input className={input} placeholder="Dirección" value={form.direccion} onChange={set("direccion")} />
        <input className={input} placeholder="Zona / ciudad (ej. Caracas)" value={form.area} onChange={set("area")} />
      </div>
      <div className={twoColRow}>
        <input className={input} placeholder="Contacto público del centro (teléfono / email)" value={form.contacto} onChange={set("contacto")} />
        <input className={input} placeholder="Enlace público de evidencia (URL)" value={form.fuente_url} onChange={set("fuente_url")} />
      </div>
      <div className={twoColRow}>
        <input className={input} placeholder="Persona responsable del centro" value={form.responsable} onChange={set("responsable")} />
      </div>

      <div className={twoColRow}>
        <input className={input} placeholder="Tu nombre *" value={form.proponenteNombre} onChange={set("proponenteNombre")} />
        <input className={input} placeholder="Tu apellido *" value={form.proponenteApellido} onChange={set("proponenteApellido")} />
      </div>
      <div className={twoColRow}>
        <input className={input} placeholder="Tu teléfono *" value={form.proponenteTelefono} onChange={set("proponenteTelefono")} />
      </div>

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

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-stone-600">
          Buscar dirección o referencia
        </p>
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <label className="block">
            <span className="sr-only">Buscar dirección o referencia</span>
            <div className="relative">
              <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className={`${input} pl-9`}
                placeholder="Escribe una calle, zona o referencia para colocar el centro"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSearchLabel(null);
                }}
              />
              {searchingAddress && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-400" />}
            </div>
          </label>
          <p className="mt-2 text-[11.5px] leading-relaxed text-stone-500">
            Te sugiero direcciones para mover el mapa y dejar el marcador casi en el sitio correcto. Luego puedes ajustar el punto manualmente si hace falta.
          </p>

          {selectedSearchLabel && pos && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
              Punto aproximado colocado desde: <b>{selectedSearchLabel}</b>
            </p>
          )}

          {searchError && (
            <p className="mt-2 text-[11.5px] text-amber-700">{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200">
              <ul className="divide-y divide-stone-200 bg-white">
                {searchResults.map((result) => (
                  <li key={result.place_id}>
                    <button
                      type="button"
                      onClick={() => selectSuggestion(result)}
                      className="w-full px-3 py-3 text-left text-[12.5px] leading-relaxed text-stone-700 transition hover:bg-stone-50"
                    >
                      {result.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-stone-600 mb-1.5">
          Ubicación * {pos && <span className="text-stone-400 font-normal">({pos[0].toFixed(4)}, {pos[1].toFixed(4)})</span>}
        </p>
        <p className="text-[11px] text-stone-400 mb-1.5">
          Busca una dirección para acercarte más rápido y luego toca el mapa si quieres ajustar el punto exacto.
        </p>
        <MapPicker value={pos} onPick={(lat, lon) => setPos([lat, lon])} />
      </div>

      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}

      <button onClick={submit} disabled={busy}
        className="w-full bg-stone-900 text-white font-semibold py-3 rounded-xl text-[14px] disabled:opacity-50 lg:text-[15px] lg:py-3.5 lg:max-w-sm lg:mx-auto lg:block">
        {busy ? "Enviando…" : "Enviar a revisión"}
      </button>
    </div>
  );
}
