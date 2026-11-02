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
