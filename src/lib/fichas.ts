import { supabase } from '@/lib/supabase'

// Ficha de alumno. Va en la tabla fichas_alumnos, que solo se puede leer con
// la sesión iniciada (ver supabase/fichas_alumnos.sql).
export type Ficha = {
  alumno_id: string
  apellidos: string | null
  dni: string | null
  fecha_nacimiento: string | null
  email: string | null
  direccion: string | null
  contacto_emergencia_nombre: string | null
  contacto_emergencia_telefono: string | null
  lesiones: string | null
  salud: string | null
  observaciones: string | null
  fecha_alta: string | null
  consentimiento_datos: boolean
}

export const FICHA_VACIA: Omit<Ficha, 'alumno_id'> = {
  apellidos: null,
  dni: null,
  fecha_nacimiento: null,
  email: null,
  direccion: null,
  contacto_emergencia_nombre: null,
  contacto_emergencia_telefono: null,
  lesiones: null,
  salud: null,
  observaciones: null,
  fecha_alta: null,
  consentimiento_datos: false,
}

// "42P01" = la tabla no existe todavía (falta ejecutar el SQL).
export function faltaTabla(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || /fichas_alumnos/.test(error.message || ''))
}

export async function cargarFichas(): Promise<{ fichas: Record<string, Ficha>; error?: string; faltaSql?: boolean }> {
  const { data, error } = await supabase.from('fichas_alumnos').select('*')
  if (error) return { fichas: {}, error: error.message, faltaSql: faltaTabla(error) }
  const fichas: Record<string, Ficha> = {}
  for (const f of (data || []) as Ficha[]) fichas[f.alumno_id] = f
  return { fichas }
}

export async function guardarFicha(ficha: Ficha) {
  const limpia = Object.fromEntries(
    Object.entries(ficha).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
  )
  const { error } = await supabase
    .from('fichas_alumnos')
    .upsert({ ...limpia, actualizado: new Date().toISOString() }, { onConflict: 'alumno_id' })
  return error
}

// Edad a partir de la fecha de nacimiento (YYYY-MM-DD).
export function edad(fecha: string | null) {
  if (!fecha) return null
  const [y, m, d] = fecha.split('-').map(Number)
  const hoy = new Date()
  let e = hoy.getFullYear() - y
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--
  return e >= 0 && e < 130 ? e : null
}
