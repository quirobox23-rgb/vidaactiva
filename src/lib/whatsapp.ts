// Recordatorio mensual por WhatsApp: se abre WhatsApp con el mensaje ya escrito
// (enlace wa.me), sin API ni coste. Solo hay que pulsar enviar.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export type SesionRecordatorio = {
  fecha: string // YYYY-MM-DD
  hora: string | null
  actividad: string | null
}

export type PagoRecordatorio = {
  monto: number
  pagado: boolean
}

export function nombreMes(mes: string) {
  const [y, m] = mes.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

function euros(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
}

function lineaSesion(s: SesionRecordatorio) {
  const [y, m, d] = s.fecha.split('-').map(Number)
  const dia = DIAS[new Date(y, m - 1, d).getDay()]
  const hora = s.hora ? `, ${s.hora.slice(0, 5)}` : ''
  const actividad = s.actividad ? ` · ${s.actividad}` : ''
  return `• ${dia} ${d}${hora}${actividad}`
}

export function mensajeRecordatorio(
  nombre: string,
  mes: string,
  pagos: PagoRecordatorio[],
  sesiones: SesionRecordatorio[]
) {
  const pagado = pagos.filter(p => p.pagado).reduce((t, p) => t + Number(p.monto || 0), 0)
  const pendiente = pagos.filter(p => !p.pagado).reduce((t, p) => t + Number(p.monto || 0), 0)

  const lineas = [`Hola ${nombre.split(' ')[0]}! 👋`, `Te paso tu resumen de ${nombreMes(mes)} en Vida Activa:`, '']

  lineas.push(pagado > 0 ? `💶 Pagado: ${euros(pagado)}` : '💶 Aún no hay ningún pago registrado para este mes.')
  if (pendiente > 0) lineas.push(`⏳ Pendiente: ${euros(pendiente)}`)
  lineas.push('')

  if (sesiones.length > 0) {
    lineas.push(`📅 Tus sesiones (${sesiones.length}):`)
    const ordenadas = [...sesiones].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
    ordenadas.forEach(s => lineas.push(lineaSesion(s)))
  } else {
    lineas.push('📅 No tienes sesiones reservadas este mes.')
  }

  lineas.push('', '¡Nos vemos! 💪')
  return lineas.join('\n')
}

// Deja el teléfono como lo pide wa.me: solo dígitos y con prefijo de país.
// Los números españoles de 9 cifras se completan con el 34.
export function telefonoWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  let num = telefono.replace(/[^\d+]/g, '')
  if (num.startsWith('+')) num = num.slice(1)
  else if (num.startsWith('00')) num = num.slice(2)
  else if (num.length === 9) num = '34' + num
  num = num.replace(/\D/g, '')
  return num.length >= 8 ? num : null
}

// Sin teléfono válido, wa.me abre WhatsApp para elegir el contacto a mano.
export function enlaceWhatsapp(telefono: string | null | undefined, texto: string) {
  const num = telefonoWhatsapp(telefono)
  return `https://wa.me/${num ?? ''}?text=${encodeURIComponent(texto)}`
}
