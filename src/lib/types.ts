export type Estado = "pendiente" | "verificado" | "cerrado" | "caducado";

export type Operador =
  | "ong" | "iglesia" | "universidad" | "asociacion"
  | "grupo_comunitario" | "consulado" | "ayuntamiento" | "empresa";

export interface Centro {
  id: string;
  nombre: string;
  operador: Operador;
  estado: Estado;
  lat: number;
  lon: number;
  direccion: string | null;
  area: string | null;
  horario: string | null;
  contacto: string | null;
  acepta: string[];
  no_acepta: string[];
  proxima_salida: string | null;
  notas: string | null;
  fuente_url: string | null;
  fuente_descripcion: string | null;
  ultima_verificacion: string | null;
  created_at: string;
  distancia_m?: number;
}
