// Recordatorio mensual por WhatsApp: se abre WhatsApp con el mensaje ya escrito
// (enlace wa.me), sin API ni coste. Solo hay que pulsar enviar.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// El mensaje a los alumnos va en catalán.
const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre']
const DIES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte']

// Tarifas: lo pagado al mes → sesiones incluidas.
const SESIONES_POR_TARIFA: Record<number, number> = { 25: 4, 45: 8 }

export type SesionRecordatorio = {
  fecha: string // YYYY-MM-DD
  hora: string | null
}

export type PagoRecordatorio = {
  monto: number
  pagado: boolean
}

export function nombreMes(mes: string) {
  const [y, m] = mes.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

// "d'octubre de 2026", "de gener de 2026"
function mesCatala(mes: string) {
  const [y, m] = mes.split('-')
  const nom = MESOS[Number(m) - 1]
  return `${/^[aeiou]/.test(nom) ? "d'" : 'de '}${nom} de ${y}`
}

function euros(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
}

function lineaSesion(s: SesionRecordatorio) {
  const [y, m, d] = s.fecha.split('-').map(Number)
  const dia = DIES[new Date(y, m - 1, d).getDay()]
  const hora = s.hora ? `, ${s.hora.slice(0, 5)}` : ''
  return `• ${dia} ${d}${hora}`
}

function sessions(n: number) {
  return `${n} ${n === 1 ? 'sessió' : 'sessions'}`
}

export function mensajeRecordatorio(
  nombre: string,
  mes: string,
  pagos: PagoRecordatorio[],
  sesiones: SesionRecordatorio[]
) {
  const pagado = pagos.filter(p => p.pagado).reduce((t, p) => t + Number(p.monto || 0), 0)
  const pendiente = pagos.filter(p => !p.pagado).reduce((t, p) => t + Number(p.monto || 0), 0)
  const incluidas = SESIONES_POR_TARIFA[pagado]

  const lineas = [`Hola ${nombre.split(' ')[0]}! 👋`, `Et passo el teu resum ${mesCatala(mes)} a Vida Activa:`, '']

  if (pagado > 0) {
    lineas.push(`💶 Has pagat: ${euros(pagado)}` + (incluidas ? ` (${sessions(incluidas)} al mes)` : ''))
  } else {
    lineas.push("💶 Encara no tenim cap pagament registrat d'aquest mes.")
  }
  if (pendiente > 0) lineas.push(`⏳ Pendent de pagar: ${euros(pendiente)}`)
  lineas.push('')

  if (sesiones.length > 0) {
    lineas.push(`📅 Les teves sessions reservades (${sesiones.length}${incluidas ? ` de ${incluidas}` : ''}):`)
    const ordenadas = [...sesiones].sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
    ordenadas.forEach(s => lineas.push(lineaSesion(s)))
  } else {
    lineas.push('📅 Encara no tens cap sessió reservada aquest mes.')
  }
  if (incluidas && sesiones.length < incluidas) {
    lineas.push('', `Et ${incluidas - sesiones.length === 1 ? 'queda' : 'queden'} ${sessions(incluidas - sesiones.length)} per reservar.`)
  }

  lineas.push('', 'Ens veiem! 💪')
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
