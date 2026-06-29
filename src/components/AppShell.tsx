"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Heart, MapPin, Plus, Map as MapIcon, List, Clock, ChevronRight,
  Navigation, Share2, AlertTriangle, CheckCircle2, Ban, Link2, History, Copy, Mail,
} from "lucide-react";
import type { Centro } from "@/lib/types";
import {
  STATUS, OPERADOR_LABEL, CATEGORIAS, freshness, km, mapsUrl, whatsappText, whatsappMessage, buildCenterUrl, ME, distanceMeters,
} from "@/lib/util";
import { createClient } from "@/lib/supabase/client";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#dfe7e0]" />,
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const NEAREST_RADIUS_M = 20_000_000;
const YUMMY_DONATION_URL = "https://dona.yummyrides.com/";

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
  const [isDesktop, setIsDesktop] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(media.matches);
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const toggle = (c: string) =>
    setFilters((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]));

  const list = useMemo(() => {
    const estadoFilters = filters.filter((f) => f === "Confirmado");
    const categoryFilters = filters.filter((f) => f !== "Confirmado");
    return [...centros]
      .filter((c) => {
        if (estadoFilters.length > 0 && c.estado !== "verificado") return false;
        if (categoryFilters.length > 0 &&
          !categoryFilters.some((f) => c.acepta.some((a) => a.toLowerCase().includes(f.toLowerCase())))
        ) return false;
        return true;
      })
      .sort((a, b) => (a.distancia_m ?? 1e12) - (b.distancia_m ?? 1e12));
  }, [centros, filters]);

  const verifiedCount = centros.filter((c) => c.estado === "verificado").length;

  const demand = useMemo(() => {
    const d: Record<string, number> = {};
    centros.forEach((c) => c.acepta.forEach((a) => { d[a] = (d[a] || 0) + 1; }));
    return Object.entries(d).sort((a, b) => b[1] - a[1]);
  }, [centros]);

  const maxDemand = demand[0]?.[1] ?? 1;
  const bottomNavHeightClass = "pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6";

  async function sendReport(motivo: string) {
    if (!reporting) return;
    await supabase.rpc("reportar_centro", { p_centro_id: reporting.id, p_motivo: motivo });
    setReporting(null); setSelected(null);
    flash("Gracias. Pasa a revisión del equipo.");
  }

  const filtersBar = (variant: "overlay" | "panel") => (
    <div className={variant === "overlay"
      ? "absolute top-3 left-0 right-0 z-[500] px-3 flex gap-1.5 overflow-x-auto no-sb lg:top-4 lg:px-4"
      : "flex gap-1.5 overflow-x-auto no-sb pb-2"}
    >
      {["Confirmado", ...CATEGORIAS].map((c) => {
        const active = filters.includes(c);
        return (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={variant === "overlay"
              ? `shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium shadow-sm backdrop-blur ${active ? "bg-stone-900 text-white" : "bg-white/95 text-stone-600"}`
              : `shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600"}`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );

  const listContent = (compact = false) => (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold text-stone-900 lg:text-[22px]">
            {compact ? "Centros cercanos y verificados" : "Centros disponibles"}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500 lg:text-[13px]">
            {compact
              ? "En escritorio ves el mapa y la lista al mismo tiempo para comparar direcciones y distancia sin cambiar de pantalla."
              : "Ordenados por cercanía y filtrados según lo que necesitas donar ahora mismo."}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right shadow-sm">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-700">Confiables</p>
          <p className="text-[22px] font-extrabold leading-none text-emerald-800">{verifiedCount}</p>
        </div>
      </div>

      <div className="mt-4">{filtersBar("panel")}</div>

      {list.length === 0 && (
        <p className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-stone-500 shadow-sm ring-1 ring-stone-200">
          No hay centros con esos filtros. Quita alguno o propón uno nuevo con “Añadir”.
        </p>
      )}

      <div className={compact ? "space-y-3" : "grid gap-3 lg:grid-cols-2"}>
        {list.map((c) => {
          const f = freshness(c.ultima_verificacion);
          const s = STATUS[c.estado];
          return (
            <button key={c.id} onClick={() => setSelected(c)}
              className="w-full rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md active:scale-[0.99]">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${s.pill}`}>
                <CheckCircle2 size={11} /> {s.label}
              </span>
              <div className="mt-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-bold leading-tight">{c.nombre}</h3>
                  <p className="mt-0.5 text-[11.5px] text-stone-500">
                    {OPERADOR_LABEL[c.operador]} · {c.area}{km(c.distancia_m) ? ` · ${km(c.distancia_m)}` : ""}
                  </p>
                </div>
                <ChevronRight size={18} className="mt-1 shrink-0 text-stone-300" />
              </div>
              {c.acepta.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {c.acepta.map((a) => (
                    <span key={a} className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700">{a}</span>
                  ))}
                </div>
              )}
              <div className={`mt-2.5 flex items-center gap-1 text-[11px] ${f.cls}`}>
                <Clock size={11} /> {f.text}
                {!f.expired && f.left != null && <span className="text-stone-400">· caduca en {f.left} h</span>}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  const donationContent = (desktop = false) => (
    <>
      <h2 className="text-[19px] font-extrabold lg:text-[22px]">Lo más necesario ahora</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500 lg:text-[13px]">
        Priorizado según lo que piden los centros activos cerca de ti — no una lista genérica.
      </p>
      <div className={`mt-4 ${desktop ? "grid gap-3 lg:grid-cols-2" : "space-y-2.5"}`}>
        {demand.map(([cat, n]) => (
          <div key={cat} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-bold">{cat}</span>
              <span className="text-[11px] text-stone-500">pedido en {n} {n === 1 ? "centro" : "centros"}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / maxDemand) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] leading-relaxed text-amber-800 lg:text-[12px]">
        Lleva todo <b>sellado y etiquetado</b>. Las medicinas, solo en su envase original con fecha visible.
        Confirma el horario en la ficha antes de salir.
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-stone-200 lg:p-4 xl:p-6">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col overflow-hidden bg-stone-50 shadow-xl shadow-stone-300/40 lg:h-[calc(100dvh-2rem)] lg:min-h-0 lg:rounded-[30px] lg:border lg:border-stone-300/70 lg:shadow-2xl lg:shadow-stone-400/20 xl:h-[calc(100dvh-3rem)]">

        <header className="z-30 border-b border-stone-200 bg-white px-[18px] pb-3 pt-3.5 lg:px-7 lg:pb-5 lg:pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 text-center lg:max-w-3xl lg:flex-1 lg:text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <img src="/logo.png" alt="AcopiosVenezuela.com" className="h-9 w-auto lg:h-11" />
                </div>

                <div className="flex shrink-0 items-center gap-2 lg:hidden">
                  <Link href="/anadir" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                    <Plus size={12} /> Añadir centro
                  </Link>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 lg:mt-4">
                <h1 className="text-[20px] font-extrabold leading-[1.05] tracking-[-0.03em] text-stone-900 sm:text-[22px] lg:text-[32px] whitespace-nowrap">
                  Centros de Acopio para ayudar a Venezuela
                </h1>
                <p className="max-w-2xl text-[13px] leading-relaxed text-stone-600 lg:text-[15px]">
                  Encuentra centros cercanos dentro y fuera de Venezuela y prioriza los puntos ya verificados para donar con más confianza.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-stone-500 lg:mt-4 lg:justify-start lg:text-[13px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 lg:px-3 lg:text-[12px]">
                  <MapPin size={11} className="lg:h-3.5 lg:w-3.5" />
                  {userPos ? "Cerca de ti" : "Cerca de Plaza Venezuela, Caracas"}
                </span>
                <span>{centros.length} centros disponibles</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 lg:items-end lg:gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                <button
                  onClick={() => locateUser(true)}
                  disabled={locationStatus === "locating"}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10.5px] font-semibold text-sky-700 disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400 lg:px-4 lg:py-2 lg:text-[12.5px]"
                >
                  <Navigation size={11} /> {locationStatus === "locating" ? "Detectando ubicación…" : userPos ? "Actualizar mi ubicación" : "Usar mi ubicación real"}
                </button>

                <div className="flex items-center gap-2 lg:hidden">
                  <Link href="/contacto" className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-[11.5px] font-semibold text-stone-600 whitespace-nowrap">
                    <Mail size={12} /> Contacto
                  </Link>

                  <a
                    href={YUMMY_DONATION_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm whitespace-nowrap"
                  >
                    <Heart size={12} /> Dona en Yummy
                  </a>
                </div>

                <div className="hidden items-center gap-2 lg:flex">
                  <Link href="/anadir" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700">
                    <Plus size={13} /> Añadir centro
                  </Link>
                  <Link href="/contacto" className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-4 py-2 text-[13px] font-semibold text-stone-600">
                    <Mail size={13} /> Contacto
                  </Link>
                  <a
                    href={YUMMY_DONATION_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
                  >
                    <Heart size={13} /> Dona en Yummy
                  </a>
                </div>
              </div>

              {locationMessage && (
                <p className={`max-w-[540px] text-[10.5px] leading-snug lg:text-right lg:text-[12px] ${
                  locationStatus === "ready" ? "text-emerald-700" : locationStatus === "insecure" || locationStatus === "denied" ? "text-amber-700" : "text-stone-500"
                }`}>
                  {locationMessage}
                </p>
              )}

              <div className="hidden items-center gap-1 rounded-2xl border border-stone-200 bg-stone-100/80 p-1 lg:flex">
                {([
                  ["mapa", MapIcon, "Mapa"],
                  ["lista", List, "Centros"],
                  ["donar", Heart, "Necesidades"],
                ] as const).map(([k, Icon, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition ${
                      tab === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <Icon size={15} className={tab === k ? "text-emerald-600" : ""} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div data-testid="mobile-shell-body" className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:bg-stone-100/60">
          {isDesktop && (
            <aside className="hidden overflow-hidden border-r border-stone-200 bg-stone-50 lg:flex lg:min-h-0 lg:flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 xl:px-6">
                <div className="space-y-4">
                  {tab === "donar" ? donationContent(true) : listContent(true)}
                </div>
              </div>
            </aside>
          )}

          <section data-testid="mobile-content-region" className="relative min-h-0 flex-1 overflow-hidden bg-stone-200 lg:block">
            {tab === "mapa" && (
              <div className="absolute inset-0 lg:hidden">
                {filtersBar("overlay")}
                <MapView
                  centros={list}
                  userPos={userPos ?? ME}
                  selectedId={selected?.id ?? null}
                  onSelect={(c) => setSelected(c)}
                />
              </div>
            )}

            {tab === "lista" && (
              <div className={`absolute inset-0 overflow-y-auto px-[14px] py-3 lg:hidden ${bottomNavHeightClass}`}>
                {listContent(false)}
              </div>
            )}

            {tab === "donar" && (
              <div className={`absolute inset-0 overflow-y-auto px-[18px] py-5 lg:hidden ${bottomNavHeightClass}`}>
                {donationContent(false)}
              </div>
            )}

            {isDesktop && (
              <div className="hidden h-full lg:block">
                {filtersBar("overlay")}
                <MapView
                  centros={list}
                  userPos={userPos ?? ME}
                  selectedId={selected?.id ?? null}
                  onSelect={(c) => setSelected(c)}
                />
              </div>
            )}
          </section>
        </div>

        <nav className="sticky bottom-0 z-30 flex border-t border-stone-200 bg-white/95 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] shadow-[0_-6px_18px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden">
          {([["mapa", MapIcon, "Mapa"], ["lista", List, "Lista"], ["donar", Heart, "Qué donar"]] as const).map(
            ([k, Icon, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-2 pb-2 pt-2.5 text-[10.5px] font-medium ${
                  tab === k ? "text-stone-900" : "text-stone-400"}`}>
                <Icon size={20} className={tab === k ? "text-emerald-600" : ""} /> {label}
              </button>
            )
          )}
        </nav>

        {selected && (
          <Sheet onClose={() => setSelected(null)}>
            <CenterDetail
              c={selected}
              onShare={() => setSharing(selected)}
              onReport={() => setReporting(selected)}
            />
          </Sheet>
        )}

        {sharing && (
          <Sheet onClose={() => setSharing(null)}>
            <div className="px-5 pb-7 pt-2 lg:px-7 lg:pb-8 lg:pt-3">
              <h3 className="text-lg font-extrabold lg:text-[22px]">Compartir por WhatsApp</h3>
              {(() => {
                const origin = typeof window !== "undefined" ? window.location.origin : SITE;
                const url = buildCenterUrl(sharing.id, origin || SITE);
                const txt = whatsappMessage(sharing, url);
                return (
                  <>
                    <div className="mt-3 whitespace-pre-line rounded-xl bg-stone-100 p-3 text-[13px] leading-relaxed text-stone-700 lg:text-[14px]">
                      {txt}
                    </div>
                    <a href={whatsappText(sharing, url)} target="_blank" rel="noreferrer"
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-3 text-[14px] font-semibold text-white lg:text-[15px]">
                      <Share2 size={15} /> Abrir WhatsApp
                    </a>
                    <button onClick={() => { navigator.clipboard?.writeText(txt).catch(() => {}); flash("Texto copiado"); }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-2.5 text-[13px] font-medium text-stone-700 lg:text-[14px]">
                      <Copy size={14} /> Copiar texto
                    </button>
                  </>
                );
              })()}
            </div>
          </Sheet>
        )}

        {reporting && (
          <Sheet onClose={() => setReporting(null)}>
            <div className="px-5 pb-7 pt-2 lg:px-7 lg:pb-8 lg:pt-3">
              <h3 className="text-lg font-extrabold lg:text-[22px]">¿Qué pasa con este centro?</h3>
              <p className="mt-1 text-[12.5px] text-stone-500 lg:text-[13.5px]">{reporting.nombre}</p>
              <div className="mt-4 space-y-2">
                {["Ya no recibe donaciones", "La dirección u horario son incorrectos", "El contacto no responde", "Creo que no es real"].map((r) => (
                  <button key={r} onClick={() => sendReport(r)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-left text-[13.5px] active:bg-stone-50 lg:text-[14px]">
                    {r}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-stone-400 lg:text-[12px]">
                No se desmarca un centro solo por reportes. Un moderador revisa y reconfirma antes de cambiar el estado.
              </p>
            </div>
          </Sheet>
        )}

        {toast && (
          <div className="absolute bottom-20 left-1/2 z-[3000] -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-[12.5px] text-white shadow-lg lg:bottom-6 lg:right-6 lg:left-auto lg:translate-x-0">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[2000] flex items-end bg-black/30 lg:items-center lg:justify-center lg:p-6" onClick={onClose}>
      <div className="max-h-[92%] w-full overflow-y-auto rounded-t-2xl bg-stone-50 lg:max-h-[min(90vh,820px)] lg:max-w-2xl lg:rounded-[28px] lg:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-stone-300 lg:mt-3" />
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
    <div className="px-5 pb-7 lg:px-7 lg:pb-8">
      <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.pill}`}>
        <CheckCircle2 size={12} /> {s.label}
      </span>
      <h2 className="mt-2 text-xl font-extrabold leading-tight lg:text-[28px]">{c.nombre}</h2>
      <p className="mt-1 text-[12.5px] text-stone-500 lg:text-[14px]">
        {OPERADOR_LABEL[c.operador]} · {c.area}{km(c.distancia_m) ? ` · ${km(c.distancia_m)}` : ""}
      </p>

      <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] lg:text-[13px] ${fb}`}>
        <Clock size={13} /> <b>{f.text}.</b>
        {!f.expired && f.left != null && <span>Caduca en {f.left} h si nadie lo reconfirma.</span>}
      </div>

      {c.estado === "pendiente" && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12.5px] leading-relaxed text-amber-900 lg:text-[13px]">
          <b>Cuidado:</b> no sabemos si este punto es de confianza todavía. Este punto no ha sido verificado.
        </div>
      )}

      {c.acepta.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-stone-400 lg:text-[11px]">
            <CheckCircle2 size={12} className="text-emerald-600" /> Qué reciben
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.acepta.map((a) => (
              <span key={a} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] text-emerald-800 lg:text-[13px]">{a}</span>
            ))}
          </div>
        </>
      )}

      {c.no_acepta.length > 0 && (
        <>
          <p className="mb-1.5 mt-3 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-stone-400 lg:text-[11px]">
            <Ban size={12} className="text-rose-500" /> Qué NO reciben
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.no_acepta.map((a) => (
              <span key={a} className="rounded-md bg-stone-100 px-2.5 py-1 text-[12px] text-stone-500 line-through lg:text-[13px]">{a}</span>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 space-y-2.5 text-[13px] lg:text-[14px]">
        <Row label="Horario" value={c.horario} />
        <Row label="Próxima salida a Venezuela" value={c.proxima_salida} />
        <Row label="Contacto" value={c.contacto} />
        {c.notas && <Row label="Instrucciones" value={c.notas} />}
        {c.fuente_url && <Row label="Fuente" value={c.fuente_url} link />}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <a href={mapsUrl(c.lat, c.lon)} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-3 text-[13px] font-semibold text-white lg:text-[14px]">
          <Navigation size={15} /> Cómo llegar
        </a>
        <button onClick={onShare}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-3 text-[13px] font-semibold text-white lg:text-[14px]">
          <Share2 size={15} /> WhatsApp
        </button>
      </div>
      <button onClick={onReport}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white py-3 text-[13px] font-semibold text-rose-600 lg:text-[14px]">
        <AlertTriangle size={15} /> Reportar: Ya no está / info incorrecta / Engañoso.
      </button>

      <div className="mt-4 flex items-start gap-1.5 text-[11px] text-stone-400 lg:text-[12px]">
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
      <Link2 size={15} className="mt-0.5 shrink-0 text-stone-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
        {link ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer"
            className="break-all text-[13px] text-sky-700 underline lg:text-[14px]">{value}</a>
        ) : (
          <p className="text-[13px] text-stone-700 lg:text-[14px]">{value}</p>
        )}
      </div>
    </div>
  );
}
