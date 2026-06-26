-- =====================================================================
--  Ayuda Venezuela – esquema inicial
--  Postgres + PostGIS + RLS (modelo de 3 niveles) + caducidad (pg_cron)
-- =====================================================================

-- 1) Extensiones --------------------------------------------------------
create extension if not exists postgis;
create extension if not exists pg_cron;   -- si falla, actívala en Dashboard > Database > Extensions

-- 2) Tipos --------------------------------------------------------------
do $$ begin
  create type public.estado_centro as enum ('pendiente','verificado','cerrado','caducado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_operador as enum
    ('ong','iglesia','universidad','asociacion','grupo_comunitario','consulado','ayuntamiento','empresa');
exception when duplicate_object then null; end $$;

-- 3) Tablas -------------------------------------------------------------
create table if not exists public.centros (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  operador           public.tipo_operador not null,
  estado             public.estado_centro not null default 'pendiente',
  ubicacion          geography(Point, 4326) not null,
  direccion          text,
  area               text,
  horario            text,
  contacto           text,
  acepta             text[] not null default '{}',
  no_acepta          text[] not null default '{}',
  proxima_salida     text,
  notas              text,
  fuente_url         text,
  fuente_descripcion text,
  ultima_verificacion timestamptz,
  verificado_por     uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_centros_ubicacion on public.centros using gist (ubicacion);
create index if not exists idx_centros_estado on public.centros (estado);

create table if not exists public.moderadores (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nombre    text,
  pais      text default 'ES',
  created_at timestamptz not null default now()
);

create table if not exists public.historial_cambios (
  id         bigint generated always as identity primary key,
  centro_id  uuid references public.centros(id) on delete cascade,
  accion     text not null,
  detalle    jsonb,
  actor      uuid,
  fuente     text,
  created_at timestamptz not null default now()
);
create index if not exists idx_historial_centro on public.historial_cambios (centro_id);

create table if not exists public.reportes (
  id         bigint generated always as identity primary key,
  centro_id  uuid references public.centros(id) on delete cascade,
  motivo     text not null,
  comentario text,
  resuelto   boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4) Helpers ------------------------------------------------------------
create or replace function public.is_moderator()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.moderadores m where m.user_id = auth.uid());
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_centros_updated on public.centros;
create trigger trg_centros_updated before update on public.centros
  for each row execute function public.set_updated_at();

create or replace function public.log_estado_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then
    insert into public.historial_cambios(centro_id, accion, detalle, actor)
    values (new.id, 'cambio_estado', jsonb_build_object('de', old.estado, 'a', new.estado), auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_log_estado on public.centros;
create trigger trg_log_estado after update on public.centros
  for each row execute function public.log_estado_change();

-- 5) Vista pública con lat/lon (RLS del usuario aplica) -----------------
create or replace view public.v_centros
with (security_invoker = true) as
select
  c.id, c.nombre, c.operador, c.estado,
  st_y(c.ubicacion::geometry) as lat,
  st_x(c.ubicacion::geometry) as lon,
  c.direccion, c.area, c.horario, c.contacto, c.acepta, c.no_acepta,
  c.proxima_salida, c.notas, c.fuente_url, c.fuente_descripcion,
  c.ultima_verificacion, c.created_at, c.updated_at
from public.centros c;

-- 6) RPC: centros cercanos (PostGIS) -----------------------------------
create or replace function public.centros_cercanos(
  p_lat double precision, p_lon double precision, p_radio_m double precision default 50000)
returns table (
  id uuid, nombre text, operador public.tipo_operador, estado public.estado_centro,
  lat double precision, lon double precision, direccion text, area text, horario text,
  contacto text, acepta text[], no_acepta text[], proxima_salida text, notas text,
  fuente_url text, fuente_descripcion text, ultima_verificacion timestamptz,
  created_at timestamptz, distancia_m double precision
) language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.nombre, c.operador, c.estado,
    st_y(c.ubicacion::geometry), st_x(c.ubicacion::geometry),
    c.direccion, c.area, c.horario, c.contacto, c.acepta, c.no_acepta,
    c.proxima_salida, c.notas, c.fuente_url, c.fuente_descripcion,
    c.ultima_verificacion, c.created_at,
    st_distance(c.ubicacion, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography) as distancia_m
  from public.centros c
  where c.estado = 'verificado'
    and st_dwithin(c.ubicacion, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography, p_radio_m)
  order by distancia_m asc;
$$;

-- 7) RPC: proponer centro (público -> entra como 'pendiente') -----------
create or replace function public.proponer_centro(
  p_nombre text, p_operador public.tipo_operador, p_lat double precision, p_lon double precision,
  p_direccion text, p_area text, p_contacto text, p_acepta text[],
  p_fuente_url text, p_responsable text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare nuevo uuid;
begin
  insert into public.centros (nombre, operador, estado, ubicacion, direccion, area,
                              contacto, acepta, fuente_url, fuente_descripcion)
  values (p_nombre, p_operador, 'pendiente',
          st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography,
          p_direccion, p_area, p_contacto, coalesce(p_acepta, '{}'),
          p_fuente_url, 'Propuesto por: ' || coalesce(p_responsable, 'anónimo'))
  returning id into nuevo;

  insert into public.historial_cambios (centro_id, accion, detalle, fuente)
  values (nuevo, 'creado', jsonb_build_object('via', 'formulario público'), 'usuario');
  return nuevo;
end $$;

-- 8) RPC: reportar centro (público) ------------------------------------
create or replace function public.reportar_centro(
  p_centro_id uuid, p_motivo text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.reportes (centro_id, motivo, comentario)
  values (p_centro_id, p_motivo, p_comentario);
  insert into public.historial_cambios (centro_id, accion, detalle, fuente)
  values (p_centro_id, 'reportado', jsonb_build_object('motivo', p_motivo), 'usuario');
end $$;

-- 9) RPCs de moderación (requieren is_moderator) ------------------------
create or replace function public.aprobar_centro(p_centro_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'No autorizado'; end if;
  update public.centros
    set estado = 'verificado', ultima_verificacion = now(), verificado_por = auth.uid()
    where id = p_centro_id;
end $$;

create or replace function public.reverificar_centro(p_centro_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'No autorizado'; end if;
  update public.centros
    set estado = 'verificado', ultima_verificacion = now(), verificado_por = auth.uid()
    where id = p_centro_id;
end $$;

create or replace function public.cerrar_centro(p_centro_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'No autorizado'; end if;
  update public.centros set estado = 'cerrado' where id = p_centro_id;
end $$;

create or replace function public.rechazar_centro(p_centro_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'No autorizado'; end if;
  delete from public.centros where id = p_centro_id and estado = 'pendiente';
end $$;

-- 10) Caducidad: tras 48 h sin reverificar, 'verificado' -> 'caducado' --
create or replace function public.caducar_centros()
returns void language plpgsql security definer set search_path = public as $$
begin
  with vencidos as (
    update public.centros
      set estado = 'caducado'
      where estado = 'verificado'
        and ultima_verificacion is not null
        and ultima_verificacion < now() - interval '48 hours'
      returning id
  )
  insert into public.historial_cambios (centro_id, accion, detalle, fuente)
  select id, 'caducado', jsonb_build_object('motivo', 'sin reconfirmación en 48 h'), 'sistema'
  from vencidos;
end $$;

-- Programa el job cada hora (ignora error si pg_cron no está disponible)
do $$ begin
  perform cron.schedule('caducar-centros', '0 * * * *', $cron$ select public.caducar_centros(); $cron$);
exception when others then
  raise notice 'pg_cron no disponible: programa caducar_centros() manualmente.';
end $$;

-- 11) RLS ---------------------------------------------------------------
alter table public.centros           enable row level security;
alter table public.moderadores       enable row level security;
alter table public.historial_cambios enable row level security;
alter table public.reportes          enable row level security;

-- centros: el público solo ve verificados; los moderadores ven todo
drop policy if exists centros_select_public on public.centros;
create policy centros_select_public on public.centros for select
  to anon, authenticated
  using (estado = 'verificado' or public.is_moderator());

-- centros: edición directa solo para moderadores (las RPC ya cubren el resto)
drop policy if exists centros_write_mod on public.centros;
create policy centros_write_mod on public.centros for all
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- moderadores: cada quien se ve a sí mismo; moderadores ven la lista
drop policy if exists moderadores_select on public.moderadores;
create policy moderadores_select on public.moderadores for select
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- historial y reportes: solo moderadores los leen
drop policy if exists historial_select_mod on public.historial_cambios;
create policy historial_select_mod on public.historial_cambios for select
  to authenticated using (public.is_moderator());

drop policy if exists reportes_select_mod on public.reportes;
create policy reportes_select_mod on public.reportes for select
  to authenticated using (public.is_moderator());

-- 12) Grants ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.v_centros to anon, authenticated;
grant select on public.centros to anon, authenticated;
grant select, insert, update, delete on public.centros to authenticated;
grant execute on function public.centros_cercanos(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.proponer_centro(text, public.tipo_operador, double precision, double precision, text, text, text, text[], text, text) to anon, authenticated;
grant execute on function public.reportar_centro(uuid, text, text) to anon, authenticated;
grant execute on function public.aprobar_centro(uuid)      to authenticated;
grant execute on function public.reverificar_centro(uuid)  to authenticated;
grant execute on function public.cerrar_centro(uuid)       to authenticated;
grant execute on function public.rechazar_centro(uuid)     to authenticated;

-- 13) Semilla (datos de DEMOSTRACIÓN – no son centros reales) -----------
insert into public.centros (nombre, operador, estado, ubicacion, area, horario, contacto, acepta, no_acepta, proxima_salida, notas, fuente_url, ultima_verificacion)
select * from (values
  ('Parroquia San Ramón Nonato','iglesia'::public.tipo_operador,'verificado'::public.estado_centro,
   st_setsrid(st_makepoint(2.1010,41.3580),4326)::geography,'L''Hospitalet','L–V 17:00–20:00 · Sáb 10:00–13:00',
   'WhatsApp 6XX XXX XXX (Hna. Carmen)', array['Alimentos','Higiene','Mantas'],
   array['Ropa usada','Medicinas caducadas'],'Dom 6 jul','No perecederos sin abrir, bolsas etiquetadas.',
   'https://parroquia-sanramon.org/ayuda', now() - interval '4 hours'),
  ('ASOVEC – Venezolanos en Catalunya','ong','verificado',
   st_setsrid(st_makepoint(2.1620,41.3920),4326)::geography,'Barcelona, Eixample','L–S 10:00–19:00',
   'info@asovec.org', array['Higiene','Medicinas','Mantas','Niños'],
   array['Medicamentos sin caja'],'Por confirmar','Medicinas solo en envase original con fecha visible.',
   'https://asovec.org/recogida', now() - interval '2 hours'),
  ('Casal d''Entitats de Badalona','asociacion','verificado',
   st_setsrid(st_makepoint(2.2470,41.4500),4326)::geography,'Badalona','Mar–Sáb 16:00–20:00',
   'WhatsApp 6XX XXX XXX', array['Agua','Alimentos','Primeros auxilios','Niños'],
   array['Ropa','Muebles'],'Vie 4 jul','Agua en garrafas selladas.',
   'https://badalona.cat/solidaritat', now() - interval '9 hours'),
  ('Punto solidario Campus Sud (UB)','universidad','pendiente',
   st_setsrid(st_makepoint(2.1170,41.3840),4326)::geography,'L''Hospitalet','L–V 9:00–18:00',
   'Pendiente de reconfirmar', array['Alimentos','Higiene'], array[]::text[],null,
   'Reportado por estudiante, falta confirmar.','https://ub.edu', now() - interval '20 hours'),
  ('Grupo vecinal Santa Coloma','grupo_comunitario','pendiente',
   st_setsrid(st_makepoint(2.2080,41.4510),4326)::geography,'Santa Coloma','Fines de semana',
   'Grupo de WhatsApp', array['Ropa','Mantas'], array[]::text[],null,
   'Sin evidencia enlazada.',null, now() - interval '38 hours'),
  ('Local de barrio Collblanc','grupo_comunitario','cerrado',
   st_setsrid(st_makepoint(2.1180,41.3760),4326)::geography,'L''Hospitalet','—',
   '—', array[]::text[], array[]::text[],null,'Campaña terminada.',null, now() - interval '60 hours')
) as v
where not exists (select 1 from public.centros);
