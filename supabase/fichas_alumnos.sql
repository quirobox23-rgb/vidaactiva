-- Fichas de alumno: DNI, contacto de emergencia, lesiones, salud…
-- Van en una tabla aparte y protegida: solo se pueden leer o cambiar
-- entrando con usuario y contraseña (Supabase › Authentication › Users).
-- La página pública de reservas NO puede verlas.
-- Ejecutar una vez en Supabase > SQL Editor.

do $$
declare
  tipo_id text;
begin
  -- Usa el mismo tipo que alumnos.id (uuid o número).
  select format_type(atttypid, atttypmod) into tipo_id
  from pg_attribute where attrelid = 'public.alumnos'::regclass and attname = 'id';

  execute format($f$
    create table if not exists public.fichas_alumnos (
      alumno_id %s primary key references public.alumnos(id) on delete cascade,
      apellidos text,
      dni text,
      fecha_nacimiento date,
      email text,
      direccion text,
      contacto_emergencia_nombre text,
      contacto_emergencia_telefono text,
      lesiones text,
      salud text,
      observaciones text,
      fecha_alta date,
      consentimiento_datos boolean not null default false,
      actualizado timestamptz not null default now()
    )
  $f$, tipo_id);
end $$;

alter table public.fichas_alumnos enable row level security;

drop policy if exists "Solo con sesion iniciada" on public.fichas_alumnos;
create policy "Solo con sesion iniciada" on public.fichas_alumnos
  for all to authenticated using (true) with check (true);
