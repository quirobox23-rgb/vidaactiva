// Formatea una fecha como YYYY-MM-DD usando la hora LOCAL, nunca UTC.
// IMPORTANTE: no usar date.toISOString().split('T')[0] en ningún sitio —
// eso convierte a UTC primero y en España (UTC+1/+2) puede devolver el día anterior.
export function fechaLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}
