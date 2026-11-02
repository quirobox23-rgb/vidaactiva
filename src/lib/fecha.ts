// Formatea una fecha como YYYY-MM-DD usando la hora LOCAL, nunca UTC.
// IMPORTANTE: no usar date.toISOString().split('T')[0] en ningún sitio —
// eso convierte a UTC primero y en España (UTC+1/+2) puede devolver el día anterior.
export function fechaLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

// Último día del mes (YYYY-MM → YYYY-MM-DD). No usar mes + '-31': en los meses
// de 30 días (o febrero) Postgres da error "date/time field value out of range".
export function finDeMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${mes}-${String(ultimo).padStart(2, '0')}`
}
