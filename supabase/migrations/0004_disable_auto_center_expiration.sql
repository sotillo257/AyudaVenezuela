-- Disable automatic center expiration.
-- Keep public visibility limited to verified and pending centers,
-- and stop the hourly job from converting verified centers to caducado.

-- Undo the public visibility expansion in case it was applied.
drop policy if exists centros_select_public on public.centros;
create policy centros_select_public on public.centros for select
  to anon, authenticated
  using (estado in ('verificado', 'pendiente') or public.is_moderator());

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
  where c.estado in ('verificado', 'pendiente')
    and st_dwithin(c.ubicacion, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography, p_radio_m)
  order by distancia_m asc;
$$;

-- Restore any previously expired centers.
update public.centros
set estado = 'verificado'
where estado = 'caducado';

-- Leave the scheduled job in place but make the function a no-op.
create or replace function public.caducar_centros()
returns void language plpgsql security definer set search_path = public as $$
begin
  return;
end $$;
