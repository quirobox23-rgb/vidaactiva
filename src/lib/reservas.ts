import { supabase } from '@/lib/supabase'
import { AlumnoBasico, digitosTelefono, esManual, normalizarNombre, tieneApellido } from '@/lib/alumnos'

// Lógica común para reservar desde la página pública (mensajes en catalán).

export type Identidad = { id: string; nombre: string }

// Busca al alumno por teléfono o por nombre; si no existe, lo crea.
// Hace falta el teléfono o el nombre con apellido para no crear repetidos.
export async function identificarAlumno(nombre: string, telefono: string): Promise<Identidad | { error: string }> {
  const nombreLimpio = nombre.trim().replace(/\s+/g, ' ')
  const telLimpio = telefono.trim()
  const digitos = digitosTelefono(telLimpio)

  if (!nombreLimpio) return { error: 'Escriu el teu nom.' }
  if (telLimpio && !digitos) return { error: 'El telèfon ha de tenir com a mínim 9 xifres.' }
  if (!digitos && !tieneApellido(nombreLimpio)) {
    return { error: 'Escriu el teu nom i cognom, o el teu telèfon, perquè et puguem identificar.' }
  }

  const { data: todos, error: errAlumnos } = await supabase.from('alumnos').select('id, nombre, telefono, origen')
  if (errAlumnos) return { error: 'Error en reservar. Torna-ho a provar.' }
  const lista = (todos || []) as AlumnoBasico[]
  // Si hay varios, se prefiere el que dio de alta la administradora a mano.
  const elegir = (c: AlumnoBasico[]) => c.find(esManual) || c[0] || null

  // Primero por teléfono (aunque escriban el nombre distinto), luego por nombre
  // (sin tener en cuenta mayúsculas, acentos ni espacios).
  let existente = digitos ? elegir(lista.filter((a) => digitosTelefono(a.telefono) === digitos)) : null
  if (!existente) {
    const nom = normalizarNombre(nombreLimpio)
    existente = elegir(lista.filter((a) => normalizarNombre(a.nombre) === nom))
  }

  if (existente) {
    // Si ya existía sin teléfono, se guarda el que acaba de escribir.
    if (!existente.telefono && telLimpio) {
      await supabase.from('alumnos').update({ telefono: telLimpio }).eq('id', existente.id)
    }
    return { id: existente.id, nombre: existente.nombre }
  }

  const { data: nuevo, error: err } = await supabase
    .from('alumnos')
    .insert({ nombre: nombreLimpio, telefono: telLimpio || null, origen: 'reserva' })
    .select('id, nombre')
    .single()
  if (err || !nuevo) return { error: "Error en crear l'alumne" }
  return { id: nuevo.id, nombre: nuevo.nombre }
}

// Reserva (o reactiva una reserva anulada) de un alumno en una sesión.
export async function reservarSesion(
  sesion: { id: string; plazas_libres: number },
  alumnoId: string
): Promise<{ id: string } | { error: string }> {
  if (sesion.plazas_libres <= 0) return { error: 'Ho sentim, no queden places disponibles.' }

  const { data: reservaExistente } = await supabase
    .from('reservas')
    .select('id, estado')
    .eq('sesion_id', sesion.id)
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  if (reservaExistente) {
    if (reservaExistente.estado !== 'cancelado') return { error: 'Ja tens una reserva en aquesta sessió.' }
    const { data, error } = await supabase
      .from('reservas')
      .update({ estado: 'reservado' })
      .eq('id', reservaExistente.id)
      .select('id')
      .single()
    if (error || !data) return { error: 'Error en reservar. Torna-ho a provar.' }
    return { id: data.id }
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert({ sesion_id: sesion.id, alumno_id: alumnoId })
    .select('id')
    .single()
  if (error || !data) {
    if (error?.message.includes('unique')) return { error: 'Ja tens una reserva en aquesta sessió.' }
    return { error: 'Error en reservar. Torna-ho a provar.' }
  }
  return { id: data.id }
}

export async function anularReserva(reservaId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('reservas').update({ estado: 'cancelado' }).eq('id', reservaId)
  return error ? { error: "Error en anul·lar la reserva." } : {}
}

// Horas que faltan para la sesión (null si no hay fecha u hora).
export function horasHastaSesion(sesion: { fecha?: string | null; hora?: string | null } | null) {
  if (!sesion?.fecha || !sesion?.hora) return null
  const horaStr = sesion.hora.length === 5 ? sesion.hora + ':00' : sesion.hora
  const fechaHora = new Date(`${sesion.fecha}T${horaStr}`)
  return (fechaHora.getTime() - Date.now()) / (1000 * 60 * 60)
}

// Solo se puede anular hasta 1 hora antes de la clase.
export function sePuedeAnular(sesion: { fecha?: string | null; hora?: string | null } | null) {
  const h = horasHastaSesion(sesion)
  return h === null || h > 1
}

// Persona que reserva desde este móvil, para no pedir el nombre cada vez.
const CLAVE_IDENTIDAD = 'vidaactiva_alumno'

export function identidadGuardada(): Identidad | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CLAVE_IDENTIDAD)
    const v = raw ? JSON.parse(raw) : null
    return v?.id && v?.nombre ? { id: v.id, nombre: v.nombre } : null
  } catch {
    return null
  }
}

export function guardarIdentidad(i: Identidad | null) {
  if (typeof window === 'undefined') return
  try {
    if (i) localStorage.setItem(CLAVE_IDENTIDAD, JSON.stringify(i))
    else localStorage.removeItem(CLAVE_IDENTIDAD)
  } catch {}
}
