import type { Estado, Operador } from "./types";

export const EXPIRY_H = 48;

export const ME: [number, number] = [10.5006, -66.8890]; // Plaza Venezuela, Caracas (fallback)

export const STATUS: Record<Estado, { label: string; color: string; pill: string }> = {
  verificado: { label: "Punto confiable", color: "#059669", pill: "bg-emerald-50 text-emerald-700" },
  pendiente: { label: "Punto sin verificar", color: "#F59E0B", pill: "bg-amber-50 text-amber-700" },
  caducado: { label: "Caducado · sin reconfirmar", color: "#F59E0B", pill: "bg-amber-50 text-amber-700" },
  cerrado: { label: "Cerrado · no recibe", color: "#A8A29E", pill: "bg-stone-100 text-stone-500" },
};

export const OPERADOR_LABEL: Record<Operador, string> = {
  ong: "ONG",
  iglesia: "Iglesia",
  universidad: "Universidad",
  asociacion: "Asociación",
  grupo_comunitario: "Grupo comunitario",
  consulado: "Consulado",
  ayuntamiento: "Ayuntamiento",
  empresa: "Empresa",
};

export const CATEGORIAS = [
  "Agua", "Alimentos", "Higiene", "Medicinas",
  "Primeros auxilios", "Mantas", "Ropa", "Niños",
];

export function freshness(ultima: string | null) {
  if (!ultima) return { text: "Sin verificar aún", cls: "text-amber-600", expired: false, left: null as number | null };
  const h = Math.max(0, Math.floor((Date.now() - new Date(ultima).getTime()) / 3.6e6));
  const left = EXPIRY_H - h;
  if (left <= 0) return { text: "Verificación caducada", cls: "text-rose-600", expired: true, left: 0 };
  const ago = h < 1 ? "hace menos de 1 h" : `hace ${h} h`;
  return { text: `Comprobado ${ago}`, cls: left <= 12 ? "text-amber-600" : "text-stone-500", expired: false, left };
}

export function km(distancia_m?: number) {
  if (distancia_m == null) return null;
  return distancia_m < 1000
    ? `${Math.round(distancia_m)} m`
    : `${(distancia_m / 1000).toFixed(1)} km`;
}

export function distanceMeters(from: [number, number], to: [number, number]) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const r = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mapsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export function buildCenterUrl(centerId: string, origin?: string) {
  const base = (origin ?? "").trim().replace(/\/$/, "");
  return base ? `${base}/centro/${centerId}` : `/centro/${centerId}`;
}

export function whatsappMessage(
  c: { nombre: string; area: string | null; acepta: string[]; horario: string | null },
  url: string
) {
  const area = c.area ?? "tu zona";
  const accepts = c.acepta.length > 0 ? c.acepta.join(", ") : "donaciones";
  return [
    `Centro de acopio en ${area}: ${c.nombre}.`,
    `Recibe ${accepts}.`,
    c.horario ? `Horario: ${c.horario}.` : null,
    "",
    `Info y ruta: ${url}`,
  ].filter((part): part is string => part !== null).join("\n");
}

export function whatsappText(
  c: { nombre: string; area: string | null; acepta: string[]; horario: string | null },
  url: string
) {
  return `https://wa.me/?text=${encodeURIComponent(whatsappMessage(c, url))}`;
}
