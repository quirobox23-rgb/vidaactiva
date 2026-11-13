import { supabase } from '@/lib/supabase'

export type AlumnoBasico = {
  id: string
  nombre: string
  telefono?: string | null
  origen?: string | null
}

// "  Eva  Quiñones " → "eva quinones": sin mayúsculas, acentos ni espacios de más,
// para que el mismo nombre escrito un poco distinto cuente como el mismo.
export function normalizarNombre(nombre: string | null | undefined) {
  return (nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Últimas 9 cifras: "612 34 56 78" y "+34612345678" son el mismo número.
export function digitosTelefono(tel: string | null | undefined) {
  const d = (tel || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : ''
}

// Nombre con al menos dos palabras (nombre + apellido o inicial).
export function tieneApellido(nombre: string) {
  return normalizarNombre(nombre).split(' ').filter(Boolean).length >= 2
}

export function esManual(a: AlumnoBasico) {
  return !a.origen || a.origen === 'manual'
}

// ¿"gemma r" puede ser "gemma rabascal"? Cada palabra del nombre corto es el
// principio de la palabra en la misma posición del nombre largo.
function nombreCompatible(a: string, b: string) {
  const pa = normalizarNombre(a).split(' ').filter(Boolean)
  const pb = normalizarNombre(b).split(' ').filter(Boolean)
  if (pa.length === 0 || pb.length === 0) return false
  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  return corto.every((p, i) => largo[i].startsWith(p))
}

// Para un alumno creado desde una reserva, busca entre los alumnos de la lista
// quién puede ser la misma persona. Devuelve las opciones de más a menos segura.
export function posiblesCoincidencias(alumno: AlumnoBasico, lista: AlumnoBasico[]) {
  const tel = digitosTelefono(alumno.telefono)
  const nom = normalizarNombre(alumno.nombre)
  const resultado: { alumno: AlumnoBasico; motivo: string; peso: number }[] = []
  for (const otro of lista) {
    if (otro.id === alumno.id) continue
    if (tel && digitosTelefono(otro.telefono) === tel) {
      resultado.push({ alumno: otro, motivo: 'mismo teléfono', peso: 3 })
    } else if (nom && normalizarNombre(otro.nombre) === nom) {
      resultado.push({ alumno: otro, motivo: 'mismo nombre', peso: 2 })
    } else if (nombreCompatible(alumno.nombre, otro.nombre)) {
      resultado.push({ alumno: otro, motivo: 'nombre parecido', peso: 1 })
    }
  }
  return resultado.sort((a, b) => b.peso - a.peso || a.alumno.nombre.localeCompare(b.alumno.nombre))
}

// Une el alumno "duplicado" con el alumno "principal": le pasa sus reservas y
// pagos, copia el teléfono si al principal le falta y borra el duplicado.
// Si los dos tenían reserva en la misma clase, se queda la del principal.
export async function unirAlumnos(duplicado: AlumnoBasico, principal: AlumnoBasico) {
  const { data: resDup, error: e1 } = await supabase
    .from('reservas')
    .select('id, sesion_id, estado')
    .eq('alumno_id', duplicado.id)
  if (e1) throw new Error('No se pudieron leer las reservas: ' + e1.message)

  const { data: resPrin, error: e2 } = await supabase
    .from('reservas')
    .select('id, sesion_id, estado')
    .eq('alumno_id', principal.id)
  if (e2) throw new Error('No se pudieron leer las reservas: ' + e2.message)

  const sesionesPrincipal = new Map((resPrin || []).map((r) => [r.sesion_id, r]))

  for (const r of resDup || []) {
    const yaTiene = sesionesPrincipal.get(r.sesion_id)
    if (yaTiene) {
      // Si la del principal estaba anulada y la del duplicado no, se reactiva.
      if (yaTiene.estado === 'cancelado' && r.estado !== 'cancelado') {
        const { error } = await supabase.from('reservas').update({ estado: r.estado }).eq('id', yaTiene.id)
        if (error) throw new Error('Error al pasar una reserva: ' + error.message)
      }
      const { data: borradas, error } = await supabase.from('reservas').delete().eq('id', r.id).select('id')
      if (error) throw new Error('Error al quitar una reserva repetida: ' + error.message)
      if (!borradas || borradas.length === 0) {
        throw new Error('No se pudo quitar una reserva repetida (falta permiso de borrar reservas en Supabase).')
      }
    } else {
      const { error } = await supabase.from('reservas').update({ alumno_id: principal.id }).eq('id', r.id)
      if (error) throw new Error('Error al pasar una reserva: ' + error.message)
    }
  }

  const { error: e3 } = await supabase.from('pagos').update({ alumno_id: principal.id }).eq('alumno_id', duplicado.id)
  if (e3) throw new Error('Error al pasar los pagos: ' + e3.message)

  if (!principal.telefono && duplicado.telefono) {
    const { error } = await supabase.from('alumnos').update({ telefono: duplicado.telefono }).eq('id', principal.id)
    if (error) throw new Error('Error al copiar el teléfono: ' + error.message)
  }

  // Si el duplicado tenía ficha y el principal no, la ficha pasa al principal
  // (si no, se borraría con el duplicado). Sin sesión iniciada no se ve: no pasa nada.
  const { data: fichaPrincipal } = await supabase.from('fichas_alumnos').select('alumno_id').eq('alumno_id', principal.id).maybeSingle()
  if (!fichaPrincipal) {
    await supabase.from('fichas_alumnos').update({ alumno_id: principal.id }).eq('alumno_id', duplicado.id)
  }

  const { error: e4 } = await supabase.from('alumnos').delete().eq('id', duplicado.id)
  if (e4) throw new Error('Se pasaron reservas y pagos, pero no se pudo borrar el duplicado: ' + e4.message)
}
