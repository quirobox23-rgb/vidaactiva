// Utilidades compartidas para los pagos de los socios.

// Conceptos de pago habituales. Con «Otro» se escribe un concepto libre
// (p. ej. «Excursión»), que se guarda tal cual. Los pagos antiguos (sin
// columna concepto) cuentan como mensualidad.
export const CONCEPTOS = ['Mensualidad', 'Seguro', 'Ropa', 'Clase suelta', 'Otro'] as const
export type Concepto = (typeof CONCEPTOS)[number]

export const CONCEPTO_POR_DEFECTO: Concepto = 'Mensualidad'

export type PagoBase = {
  concepto?: string | null
  mes_pagado?: string | null
  fecha_pago?: string | null
}

export function conceptoDelPago(pago: PagoBase): string {
  return pago.concepto || CONCEPTO_POR_DEFECTO
}

export function esSeguro(pago: PagoBase): boolean {
  return conceptoDelPago(pago) === 'Seguro'
}

// Mes al que corresponde el pago (YYYY-MM). Los pagos antiguos sin mes_pagado
// usan el mes de la fecha de pago.
export function mesDelPago(pago: PagoBase): string {
  return pago.mes_pagado || (pago.fecha_pago || '').slice(0, 7)
}

// El seguro es anual: se guarda con mes_pagado = "AAAA-01" y aquí sacamos el año.
export function anioDelSeguro(pago: PagoBase): string {
  return mesDelPago(pago).slice(0, 4)
}

// El seguro puede pagarse anual o por semestres. Se guarda en mes_pagado:
//   anual → "AAAA-01"   1er semestre → "AAAA-S1"   2º semestre → "AAAA-S2"
export const PERIODOS_SEGURO = ['anual', 'S1', 'S2'] as const
export type PeriodoSeguro = (typeof PERIODOS_SEGURO)[number]

export const NOMBRE_PERIODO_SEGURO: Record<PeriodoSeguro, string> = {
  anual: 'Anual',
  S1: '1er semestre',
  S2: '2º semestre',
}

export function periodoDelSeguro(pago: PagoBase): PeriodoSeguro {
  const mes = mesDelPago(pago)
  if (mes.endsWith('-S1')) return 'S1'
  if (mes.endsWith('-S2')) return 'S2'
  return 'anual'
}

export function mesPagadoSeguro(anio: string, periodo: PeriodoSeguro): string {
  return periodo === 'anual' ? `${anio}-01` : `${anio}-${periodo}`
}
