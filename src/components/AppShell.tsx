"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Heart, MapPin, Plus, Map as MapIcon, List, Clock, ChevronRight,
  Navigation, Share2, AlertTriangle, X, CheckCircle2, Ban, Link2, History, Copy,
} from "lucide-react";
import type { Centro } from "@/lib/types";
import {
  STATUS, OPERADOR_LABEL, CATEGORIAS, freshness, km, mapsUrl, whatsappText, ME, distanceMeters,
} from "@/lib/util";
import { createClient } from "@/lib/supabase/client";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#dfe7e0]" />,
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const NEAREST_RADIUS_M = 20_000_000;

type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "insecure";

export default function AppShell({ initialCentros }: { initialCentros: Centro[]; loadError?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"mapa" | "lista" | "donar">("mapa");
  const [centros, setCentros] = useState<Centro[]>(initialCentros);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const [selected, setSelected] = useState<Centro | null>(null);
  const [sharing, setSharing] = useState<Centro | null>(null);
  const [reporting, setReporting] = useState<Centro | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1900); };

  const applyDistances = useCallback((items: Centro[], pos: [number, number]) => {
    return items
      .map((c) => ({
        ...c,
        distancia_m: distanceMeters(pos, [c.lat, c.lon]),
      }))
      .sort((a, b) => (a.distancia_m ?? 1e12) - (b.distancia_m ?? 1e12));
  }, []);

  const loadNearest = useCallback(async (pos: [number, number]) => {
    const { data, error } = await supabase.rpc("centros_cercanos", {
      p_lat: pos[0], p_lon: pos[1], p_radio_m: NEAREST_RADIUS_M,
    });

    if (error) {
      console.warn("No se pudieron cargar centros cercanos desde Supabase", error);
      setCentros((current) => applyDistances(current.length ? current : initialCentros, pos));
      setLocationMessage("Ubicación detectada. Ordeno por distancia calculada en el móvil.");
      return;
    }

    const nearest = (data ?? []) as Centro[];
    setCentros(nearest.length ? nearest : applyDistances(initialCentros, pos));
    setLocationMessage(nearest.length ? "Centros ordenados por cercanía real." : "No hay centros en el radio; muestro los disponibles ordenados por distancia.");
  }, [applyDistances, initialCentros, supabase]);

  const locateUser = useCallback((manual = false) => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      setLocationMessage("Este navegador no permite detectar ubicación.");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setLocationStatus("insecure");
      setLocationMessage("Para usar GPS real abre la app por HTTPS. En HTTP el navegador bloquea la ubicación.");
      return;
    }

    setLocationStatus("locating");
    setLocationMessage(manual ? "Pidiendo permiso de ubicación…" : null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setUserPos(pos);
        setLocationStatus("ready");
        setLocationMessage(`Ubicación detectada con precisión aprox. ${Math.round(coords.accuracy)} m.`);
        await loadNearest(pos);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setLocationStatus(denied ? "denied" : "unavailable");
        setLocationMessage(
          denied
            ? "Permiso de ubicación denegado. Actívalo en el navegador para ver los centros más cercanos."
            : "No he podido obtener tu ubicación. Prueba de nuevo o revisa el GPS del dispositivo."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [loadNearest]);

  useEffect(() => {
    locateUser(false);
  }, [locateUser]);

  const toggle = (c: string) =>
    setFilters((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]));

  const list = useMemo(() => {
    return [...centros]
      .filter((c) =>
        filters.length === 0 ||
        filters.some((f) => c.acepta.some((a) => a.toLowerCase().includes(f.toLowerCase())))
      )
      .sort((a, b) => (a.distancia_m ?? 1e12) - (b.distancia_m ?? 1e12));
  }, [centros, filters]);

  const verifiedCount = centros.filter((c) => c.estado === "verificado").length;

  // Qué donar ahora: agrega lo que piden los centros activos
  const demand = useMemo(() => {
    const d: Record<string, number> = {};
    centros.forEach((c) => c.acepta.forEach((a) => { d[a] = (d[a] || 0) + 1; }));
    return Object.entries(d).sort((a, b) => b[1] - a[1]);
  }, [centros]);
  const maxDemand = demand[0]?.[1] ?? 1;
  const bottomNavHeightClass = "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]";

  async function sendReport(motivo: string) {
    if (!reporting) return;
    await supabase.rpc("reportar_centro", { p_centro_id: reporting.id, p_motivo: motivo });
    setReporting(null); setSelected(null);
    flash("Gracias. Pasa a revisión del equipo.");
  }

  return (
    <div className="min-h-[100dvh] bg-stone-200 flex justify-center">
      <div className="w-full max-w-md bg-stone-50 min-h-[100dvh] relative flex flex-col overflow-hidden shadow-xl shadow-stone-300/40">

        {/* Header */}
        <header className="bg-white border-b border-stone-200 px-[18px] pt-4 pb-3 z-30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-extrabold text-[18px] tracking-tight">
                <Heart size={17} className="text-emerald-600 fill-emerald-600" /> Ayuda Venezuela
              </div>
              <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {userPos ? "Cerca de ti" : "Cerca de Plaza Venezuela, Caracas"} · {verifiedCount} puntos confiables
              </div>
              <button
                onClick={() => locateUser(true)}
                disabled={locationStatus === "locating"}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 disabled:text-stone-400"
              >
                <Navigation size={12} /> {locationStatus === "locating" ? "Detectando ubicación…" : userPos ? "Actualizar mi ubicación" : "Usar mi ubicación real"}
              </button>
              {locationMessage && (
                <p className={`mt-1 max-w-[250px] text-[10.5px] leading-snug ${
                  locationStatus === "ready" ? "text-emerald-700" : locationStatus === "insecure" || locationStatus === "denied" ? "text-amber-700" : "text-stone-500"
                }`}>
                  {locationMessage}
                </p>
              )}
            </div>
            <Link href="/anadir" className="flex items-center gap-1 text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
              <Plus size={13} /> Añadir
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">

          {/* MAPA */}
          {tab === "mapa" && (
            <div className="absolute inset-0">
              <div className="absolute top-2.5 left-0 right-0 z-[500] px-3 flex gap-1.5 overflow-x-auto no-sb">
                {CATEGORIAS.map((c) => (
                  <button key={c} onClick={() => toggle(c)}
                    className={`shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-full shadow-sm ${
                      filters.includes(c) ? "bg-stone-900 text-white" : "bg-white text-stone-600"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <MapView
                centros={list}
                userPos={userPos ?? ME}
                selectedId={selected?.id ?? null}
                onSelect={(c) => setSelected(c)}
              />
            </div>
          )}

          {/* LISTA */}
          {tab === "lista" && (
            <div className={`absolute inset-0 overflow-y-auto px-[14px] py-3 ${bottomNavHeightClass}`}>
              <div className="flex gap-1.5 overflow-x-auto no-sb pb-2">
                {CATEGORIAS.map((c) => (
                  <button key={c} onClick={() => toggle(c)}
                    className={`shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-full border ${
                      filters.includes(c) ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
              {list.length === 0 && (
                <p className="text-center text-stone-500 text-sm py-12 px-6">
                  No hay centros con esos filtros. Quita alguno o propón uno nuevo con “Añadir”.
                </p>
              )}
              <div className="space-y-3">
                {list.map((c) => {
                  const f = freshness(c.ultima_verificacion);
                  const s = STATUS[c.estado];
                  return (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className="w-full text-left bg-white rounded-2xl border border-stone-200 p-3.5 active:scale-[0.99] transition">
                      <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${s.pill}`}>
                        <CheckCircle2 size={11} /> {s.label}
                      </span>
                      <div className="flex items-start justify-between gap-2 mt-1.5">
                        <div className="min-w-0">
                          <h3 className="font-bold text-[15px] leading-tight truncate">{c.nombre}</h3>
                          <p className="text-[11.5px] text-stone-500 mt-0.5">
                            {OPERADOR_LABEL[c.operador]} · {c.area}{km(c.distancia_m) ? ` · ${km(c.distancia_m)}` : ""}
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-stone-300 shrink-0 mt-1" />
                      </div>
                      {c.acepta.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {c.acepta.map((a) => (
                            <span key={a} className="text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">{a}</span>
                          ))}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 mt-2.5 text-[11px] ${f.cls}`}>
                        <Clock size={11} /> {f.text}
                        {!f.expired && f.left != null && <span className="text-stone-400">· caduca en {f.left} h</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DONAR */}
          {tab === "donar" && (
            <div className={`absolute inset-0 overflow-y-auto px-[18px] py-5 ${bottomNavHeightClass}`}>
              <h2 className="text-[19px] font-extrabold">Lo más necesario ahora</h2>
              <p className="text-[12.5px] text-stone-500 mt-1 leading-relaxed">
                Priorizado según lo que piden los centros activos cerca de ti — no una lista genérica.
              </p>
              <div className="space-y-2.5 mt-4">
                {demand.map(([cat, n]) => (
                  <div key={cat} className="bg-white rounded-2xl border border-stone-200 p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[14px]">{cat}</span>
                      <span className="text-[11px] text-stone-500">pedido en {n} {n === 1 ? "centro" : "centros"}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(n / maxDemand) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
                Lleva todo <b>sellado y etiquetado</b>. Las medicinas, solo en su envase original con fecha visible.
                Confirma el horario en la ficha antes de salir.
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <nav className="sticky bottom-0 z-30 flex border-t border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] shadow-[0_-6px_18px_rgba(0,0,0,0.06)]">
          {([["mapa", MapIcon, "Mapa"], ["lista", List, "Lista"], ["donar", Heart, "Qué donar"]] as const).map(
            ([k, Icon, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 pt-2.5 pb-2 text-[10.5px] font-medium ${
                  tab === k ? "text-stone-900" : "text-stone-400"}`}>
                <Icon size={20} className={tab === k ? "text-emerald-600" : ""} /> {label}
              </button>
            )
          )}
        </nav>

        {/* Ficha (sheet) */}
        {selected && (
          <Sheet onClose={() => setSelected(null)}>
            <CenterDetail
              c={selected}
              onShare={() => setSharing(selected)}
              onReport={() => setReporting(selected)}
            />
          </Sheet>
        )}

        {/* Compartir */}
        {sharing && (
          <Sheet onClose={() => setSharing(null)}>
            <div className="px-5 pb-7 pt-2">
              <h3 className="text-lg font-extrabold">Compartir por WhatsApp</h3>
              {(() => {
                const url = `${SITE}/centro/${sharing.id}`;
                const txt = `Centro de acopio en ${sharing.area}: ${sharing.nombre}. Recibe ${sharing.acepta.join(", ")}.`;
                return (
                  <>
                    <div className="bg-stone-100 rounded-xl p-3 text-[13px] text-stone-700 leading-relaxed mt-3">
                      {txt} {url}
                    </div>
                    <a href={whatsappText(sharing, url)} target="_blank" rel="noreferrer"
                      className="mt-3 w-full flex items-center justify-center gap-1.5 bg-[#25D366] text-white font-semibold py-3 rounded-xl text-[14px]">
                      <Share2 size={15} /> Abrir WhatsApp
                    </a>
                    <button onClick={() => { navigator.clipboard?.writeText(`${txt} ${url}`).catch(() => {}); flash("Texto copiado"); }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-700 font-medium py-2.5 rounded-xl text-[13px]">
                      <Copy size={14} /> Copiar texto
                    </button>
                  </>
                );
              })()}
            </div>
          </Sheet>
        )}

        {/* Reportar */}
        {reporting && (
          <Sheet onClose={() => setReporting(null)}>
            <div className="px-5 pb-7 pt-2">
              <h3 className="text-lg font-extrabold">¿Qué pasa con este centro?</h3>
              <p className="text-[12.5px] text-stone-500 mt-1">{reporting.nombre}</p>
              <div className="space-y-2 mt-4">
                {["Ya no recibe donaciones", "La dirección u horario son incorrectos", "El contacto no responde", "Creo que no es real"].map((r) => (
                  <button key={r} onClick={() => sendReport(r)}
                    className="w-full text-left text-[13.5px] bg-white border border-stone-200 px-3.5 py-3 rounded-xl active:bg-stone-50">
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 mt-3">
                No se desmarca un centro solo por reportes. Un moderador revisa y reconfirma antes de cambiar el estado.
              </p>
            </div>
          </Sheet>
        )}

        {toast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[3000] bg-stone-900 text-white text-[12.5px] px-4 py-2 rounded-full shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[2000] bg-black/30 flex items-end" onClick={onClose}>
      <div className="w-full bg-stone-50 rounded-t-2xl max-h-[92%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-2.5" />
        {children}
      </div>
    </div>
  );
}

function CenterDetail({ c, onShare, onReport }: { c: Centro; onShare: () => void; onReport: () => void }) {
  const f = freshness(c.ultima_verificacion);
  const s = STATUS[c.estado];
  const fb = f.expired ? "bg-rose-50 text-rose-700 border-rose-200"
    : f.cls.includes("amber") ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <div className="px-5 pb-7">
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full mt-3 ${s.pill}`}>
        <CheckCircle2 size={12} /> {s.label}
      </span>
      <h2 className="text-xl font-extrabold leading-tight mt-2">{c.nombre}</h2>
      <p className="text-[12.5px] text-stone-500 mt-1">
        {OPERADOR_LABEL[c.operador]} · {c.area}{km(c.distancia_m) ? ` · ${km(c.distancia_m)}` : ""}
      </p>

      <div className={`flex items-center gap-2 text-[12px] border rounded-xl px-3 py-2 mt-3 ${fb}`}>
        <Clock size={13} /> <b>{f.text}.</b>
        {!f.expired && f.left != null && <span>Caduca en {f.left} h si nadie lo reconfirma.</span>}
      </div>

      {c.estado === "pendiente" && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <b>Cuidado:</b> no sabemos si este punto es de confianza todavía. Este punto no ha sido verificado.
        </div>
      )}

      {c.acepta.length > 0 && (
        <>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-stone-400 flex items-center gap-1 mt-4 mb-1.5">
            <CheckCircle2 size={12} className="text-emerald-600" /> Qué reciben
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.acepta.map((a) => (
              <span key={a} className="text-[12px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md">{a}</span>
            ))}
          </div>
        </>
      )}

      {c.no_acepta.length > 0 && (
        <>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-stone-400 flex items-center gap-1 mt-3 mb-1.5">
            <Ban size={12} className="text-rose-500" /> Qué NO reciben
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.no_acepta.map((a) => (
              <span key={a} className="text-[12px] bg-stone-100 text-stone-500 px-2.5 py-1 rounded-md line-through">{a}</span>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 space-y-2.5 text-[13px]">
        <Row label="Horario" value={c.horario} />
        <Row label="Próxima salida a Venezuela" value={c.proxima_salida} />
        <Row label="Contacto" value={c.contacto} />
        {c.notas && <Row label="Instrucciones" value={c.notas} />}
        {c.fuente_url && <Row label="Fuente" value={c.fuente_url} link />}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-5">
        <a href={mapsUrl(c.lat, c.lon)} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 bg-stone-900 text-white text-[13px] font-semibold py-3 rounded-xl">
          <Navigation size={15} /> Cómo llegar
        </a>
        <button onClick={onShare}
          className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white text-[13px] font-semibold py-3 rounded-xl">
          <Share2 size={15} /> WhatsApp
        </button>
      </div>
      <button onClick={onReport}
        className="w-full mt-2.5 flex items-center justify-center gap-1.5 bg-white border border-rose-200 text-rose-600 text-[13px] font-semibold py-3 rounded-xl">
        <AlertTriangle size={15} /> Este centro ya no está activo / info incorrecta
      </button>

      <div className="flex items-start gap-1.5 text-[11px] text-stone-400 mt-4">
        <History size={12} className="mt-0.5 shrink-0" />
        <span>El historial de cambios y la fuente quedan registrados para cada centro.</span>
      </div>
    </div>
  );
}

function Row({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2.5">
      <Link2 size={15} className="text-stone-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-stone-400 font-bold">{label}</p>
        {link ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer"
            className="text-[13px] text-sky-700 underline break-all">{value}</a>
        ) : (
          <p className="text-[13px] text-stone-700">{value}</p>
        )}
      </div>
    </div>
  );
}
