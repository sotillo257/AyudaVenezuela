# Acopios Venezuela – Centros Verificados

Webapp móvil (Next.js App Router) para encontrar **centros de acopio verificados**:
mapa con tu ubicación, qué reciben hoy, horario, próxima salida hacia Venezuela,
estado de verificación, compartir por WhatsApp y URL propia por centro.

Stack: **Next 14 + React 18 + react-leaflet (OpenStreetMap) + Supabase (Postgres + PostGIS + RLS + pg_cron)**.

---

## 1. Configurar Supabase

1. En tu proyecto `ayudaVenezuela`, abre **SQL Editor** y ejecuta el contenido de
   `supabase/migrations/0001_init.sql`. Crea tablas, PostGIS, las RPC, las políticas RLS,
   el job base de `pg_cron` y 6 centros de **demostración**.
   - Si `create extension pg_cron` falla, actívalo en **Database → Extensions** y vuelve a correr.
2. Copia `.env.local.example` a `.env.local` y rellena con **Settings → API**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

### Hacerte moderador
Las acciones de moderación requieren estar en la tabla `moderadores`. Entra una vez en
`/moderar` (te llega un enlace mágico por email para crear tu usuario), copia tu `user_id`
desde **Authentication → Users** y ejecuta en SQL:
```sql
insert into public.moderadores (user_id, nombre, pais)
values ('TU-USER-ID', 'Jesús', 'ES');
```

---

## 2. Ejecutar en local
```bash
npm install
npm run dev   # http://localhost:3000
```

Rutas: `/` (mapa, lista, qué donar) · `/centro/[id]` (ficha pública + OpenGraph) ·
`/anadir` (proponer centro → entra como *pendiente*) · `/contacto` (formulario de contacto → guarda en Supabase) · `/moderar` (panel).

---

## 3. Desplegar en Vercel
1. Sube el repo a GitHub e impórtalo en Vercel.
2. En **Settings → Environment Variables** pon las tres variables del `.env.local`
   (con `NEXT_PUBLIC_SITE_URL` = tu dominio de producción, para que las tarjetas de WhatsApp salgan bien).
3. Deploy.

---

## Modelo de confianza (lo importante)
- **Público** ve centros `verificado` y `pendiente` (lo impone RLS en la base, no el frontend).
- **Proponer centro** (`proponer_centro`) siempre entra como `pendiente`; nadie puede crear un verificado desde fuera.
- **Caducidad automática**: desactivada. Los centros verificados ya no cambian solos a `caducado` por tiempo.
- **Reportes** de "ya no está activo" no desmarcan nada solos: quedan para revisión del moderador.
- **Historial**: cada cambio de estado y cada propuesta/reporte se registra en `historial_cambios`.

Si en el futuro quieres reactivar la caducidad automática, puedes volver a implementar la lógica dentro de `caducar_centros()`.

---

## Notas técnicas
- **Leaflet necesita `window`**: el mapa (`MapView`, `MapPicker`) se carga con
  `dynamic(..., { ssr: false })`. No lo importes en server components.
- **Distancia real**: el cliente llama a la RPC `centros_cercanos(lat, lon, radio)` que usa
  `ST_DWithin` / `ST_Distance` de PostGIS, no filtra en cliente.
- **Tile server**: usa OpenStreetMap público. Para producción con tráfico, cambia la URL de
  teselas a Mapbox/MapTiler (con token) en `MapView.tsx` y `MapPicker.tsx`.
- **Free tier de Supabase**: pausa el proyecto tras ~1 semana sin actividad. Para uso
  intermitente, considera el plan de pago o un ping de mantenimiento.

> Los 6 centros incluidos son **datos de demostración**, no centros reales. Bórralos antes de publicar:
> `delete from public.centros;`
