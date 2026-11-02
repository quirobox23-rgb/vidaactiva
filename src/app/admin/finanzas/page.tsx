'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fechaLocal, finDeMes } from '@/lib/fecha'
import {
  CONCEPTOS,
  CONCEPTO_POR_DEFECTO,
  anioDelSeguro,
  conceptoDelPago,
  esSeguro,
  mesDelPago,
} from '@/lib/pagos'
import { enlaceWhatsapp, mensajeSeguro } from '@/lib/whatsapp'

type Alumno = {
  id: string
  nombre: string
  telefono?: string | null
}

type Sesion = {
  id: string
  actividad_nombre: string
  dia_semana: string
  fecha: string
  hora: string
}

type Pago = {
  id: string
  alumno_id: string
  sesion_id: string | null
  monto: number
  metodo: string
  pagado: boolean
  fecha_pago: string
  mes_pagado?: string | null
  concepto?: string | null
  notas: string | null
  created_at: string
  alumnos?: {
    nombre: string
  } | null
}

type Gasto = {
  id: string
  concepto: string
  categoria: string
  monto: number
  fecha: string
}

type ReservaMes = {
  alumno_id: string
  estado: string
  alumno_nombre: string
}

type OrdenPagos = 'fecha' | 'alumno' | 'concepto' | 'periodo' | 'monto' | 'estado'
type PestanaPendientes = 'cuotas' | 'seguro' | 'deudas'

const CATEGORIAS_GASTO = ['Seguro', 'Material', 'Alquiler', 'Suministros', 'Monitores', 'Otros']

function nombreMes(mes: string) {
  if (!mes) return '—'
  const [y, m] = mes.split('-')
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${nombres[Number(m) - 1]} ${y}`
}

// Lo que se paga: un mes para las cuotas, un año para el seguro.
function periodoDelPago(pago: Pago) {
  return esSeguro(pago) ? `Año ${anioDelSeguro(pago)}` : nombreMes(mesDelPago(pago))
}

function euros(n: number) {
  return `${n.toFixed(2)} €`
}

const COLOR_CONCEPTO: Record<string, string> = {
  Mensualidad: 'bg-blue-50 text-blue-700',
  Seguro: 'bg-purple-50 text-purple-700',
  Ropa: 'bg-pink-50 text-pink-700',
  'Clase suelta': 'bg-teal-50 text-teal-700',
  Otro: 'bg-gray-100 text-gray-700',
}

// Inserta el pago y, si alguna columna nueva (mes_pagado, concepto) aún no
// existe en Supabase, lo guarda sin ella y devuelve qué columnas faltan.
async function insertarPago(datos: Record<string, unknown>) {
  const fila = { ...datos }
  const faltan: string[] = []
  for (;;) {
    const { error } = await supabase.from('pagos').insert(fila)
    if (!error) return { error: null, faltan }
    const columna = ['concepto', 'mes_pagado'].find((c) => c in fila && error.message.includes(c))
    if (!columna) return { error, faltan }
    delete fila[columna]
    faltan.push(columna)
  }
}

export default function FinanzasPage() {
  const hoy = fechaLocal(new Date())
  const mesActual = hoy.slice(0, 7)
  const anioActual = hoy.slice(0, 4)

  const [pagos, setPagos] = useState<Pago[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [reservasMes, setReservasMes] = useState<ReservaMes[]>([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)

  // Formulario de pago
  const [alumnoId, setAlumnoId] = useState('')
  const [conceptoPago, setConceptoPago] = useState<string>(CONCEPTO_POR_DEFECTO)
  const [conceptoLibre, setConceptoLibre] = useState('')
  const [sesionId, setSesionId] = useState('')
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [pagadoPago, setPagadoPago] = useState(true)
  const [fechaPago, setFechaPago] = useState(hoy)
  const [mesPagado, setMesPagado] = useState(mesActual)
  const [anioSeguro, setAnioSeguro] = useState(anioActual)
  const [notasPago, setNotasPago] = useState('')
  const formPagoRef = useRef<HTMLFormElement>(null)

  // Formulario de gasto
  const [conceptoGasto, setConceptoGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [fechaGasto, setFechaGasto] = useState(hoy)

  // Vistas
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)
  const [pestana, setPestana] = useState<PestanaPendientes>('cuotas')
  const [mesPendientes, setMesPendientes] = useState(mesActual)
  const [anioPendientes, setAnioPendientes] = useState(anioActual)

  // Filtros y orden de la tabla de pagos
  const [filtroAlumno, setFiltroAlumno] = useState('')
  const [filtroConcepto, setFiltroConcepto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | 'pagado' | 'pendiente'>('')
  const [filtroMes, setFiltroMes] = useState('')
  const [orden, setOrden] = useState<OrdenPagos>('fecha')
  const [ordenAsc, setOrdenAsc] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    cargarReservas(mesPendientes)
  }, [mesPendientes])

  async function cargarDatos() {
    setError('')
    setCargando(true)

    const { data: p, error: pErr } = await supabase
      .from('pagos')
      .select('*, alumnos(nombre)')
      .order('created_at', { ascending: false })

    const { data: g, error: gErr } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })

    const { data: a, error: aErr } = await supabase
      .from('alumnos')
      .select('id, nombre, telefono')
      .order('nombre')

    const { data: s, error: sErr } = await supabase
      .from('vista_sesiones')
      .select('id, actividad_nombre, dia_semana, fecha, hora')
      .order('fecha', { ascending: false })
      .limit(50)

    if (pErr || gErr || aErr || sErr) {
      setError(
        'Error al cargar datos: ' +
          (pErr?.message || gErr?.message || aErr?.message || sErr?.message)
      )
      setCargando(false)
      return
    }

    setPagos(p || [])
    setGastos(g || [])
    setAlumnos(a || [])
    setSesiones(s || [])
    setCargando(false)
  }

  async function cargarReservas(mes: string) {
    if (!mes) return
    const { data: r, error: rErr } = await supabase
      .from('reservas')
      .select('alumno_id, estado, alumnos(nombre), sesiones!inner(fecha)')
      .neq('estado', 'cancelado')
      .gte('sesiones.fecha', mes + '-01')
      .lte('sesiones.fecha', finDeMes(mes))

    if (rErr) {
      setError('Error al cargar las reservas: ' + rErr.message)
      return
    }

    setReservasMes(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r || []).map((row: any) => ({
        alumno_id: row.alumno_id,
        estado: row.estado,
        alumno_nombre: row.alumnos?.nombre || 'Sin nombre',
      }))
    )
  }

  // Conceptos escritos a mano en pagos anteriores, para sugerirlos y filtrar.
  const fijos: string[] = CONCEPTOS.filter((c) => c !== 'Otro')
  const conceptosLibres = Array.from(new Set(pagos.map((p) => conceptoDelPago(p))))
    .filter((c) => !fijos.includes(c))
    .sort((a, b) => a.localeCompare(b))
  const conceptosFiltro = [...fijos, ...conceptosLibres]

  // Último importe usado para el seguro, para rellenarlo solo.
  const ultimoImporteSeguro = pagos.find((p) => esSeguro(p))?.monto

  function cambiarConcepto(concepto: string) {
    setConceptoPago(concepto)
    if (concepto === 'Seguro') {
      setSesionId('')
      if (!montoPago && ultimoImporteSeguro) setMontoPago(String(ultimoImporteSeguro))
    }
  }

  // Desde la lista de pendientes: rellena el formulario y baja hasta él.
  function prepararPago(alumno: string, concepto: string, periodo: string) {
    setAlumnoId(alumno)
    setConceptoPago(concepto)
    setPagadoPago(true)
    setFechaPago(hoy)
    if (concepto === 'Seguro') {
      setAnioSeguro(periodo)
      setMontoPago(ultimoImporteSeguro ? String(ultimoImporteSeguro) : '')
    } else {
      setMesPagado(periodo)
      setMontoPago('')
    }
    formPagoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function agregarPago(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setAviso('')

    if (!alumnoId || !montoPago) {
      setError('Selecciona un socio e introduce una cantidad.')
      return
    }

    const seguro = conceptoPago === 'Seguro'
    const concepto = conceptoPago === 'Otro' ? conceptoLibre.trim() : conceptoPago
    if (!concepto) {
      setError('Escribe qué está pagando (por ejemplo «Excursión»).')
      return
    }
    if (seguro && !/^\d{4}$/.test(anioSeguro)) {
      setError('Indica el año del seguro (por ejemplo 2026).')
      return
    }
    if (!seguro && !mesPagado) {
      setError('Indica el mes al que corresponde el pago.')
      return
    }

    const { error: insertError, faltan } = await insertarPago({
      alumno_id: alumnoId,
      sesion_id: seguro ? null : sesionId || null,
      monto: Number(montoPago),
      metodo: metodoPago,
      pagado: pagadoPago,
      fecha_pago: fechaPago,
      notas: notasPago || null,
      concepto,
      mes_pagado: seguro ? `${anioSeguro}-01` : mesPagado,
    })

    if (insertError) {
      setError('Error al añadir el pago: ' + insertError.message)
      return
    }

    if (faltan.length > 0) {
      const sql = faltan.includes('concepto') ? 'supabase/concepto_pagos.sql' : 'supabase/mes_pagado.sql'
      setAviso(
        `Pago guardado, pero sin ${faltan.join(' ni ')}: falta añadir esa columna en Supabase (ver ${sql}).`
      )
    }

    setAlumnoId('')
    setConceptoPago(CONCEPTO_POR_DEFECTO)
    setConceptoLibre('')
    setSesionId('')
    setMontoPago('')
    setMetodoPago('Efectivo')
    setPagadoPago(true)
    setFechaPago(hoy)
    setMesPagado(mesActual)
    setAnioSeguro(anioActual)
    setNotasPago('')

    await cargarDatos()
  }

  async function agregarGasto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!conceptoGasto || !categoriaGasto || !montoGasto) {
      setError('Introduce el concepto, la categoría y la cantidad del gasto.')
      return
    }

    const { error: insertError } = await supabase.from('gastos').insert({
      concepto: conceptoGasto,
      categoria: categoriaGasto,
      monto: Number(montoGasto),
      fecha: fechaGasto,
    })

    if (insertError) {
      setError('Error al añadir el gasto: ' + insertError.message)
      return
    }

    setConceptoGasto('')
    setCategoriaGasto('')
    setMontoGasto('')
    setFechaGasto(hoy)

    await cargarDatos()
  }

  // Marca un pago pendiente como cobrado (con fecha de hoy) o al revés.
  async function cambiarEstadoPago(pago: Pago) {
    setError('')
    const cambios = pago.pagado ? { pagado: false } : { pagado: true, fecha_pago: hoy }
    const { error: updateError } = await supabase
      .from('pagos')
      .update(cambios)
      .eq('id', pago.id)

    if (updateError) {
      setError('Error al actualizar el pago: ' + updateError.message)
      return
    }

    await cargarDatos()
  }

  async function eliminarPago(id: string) {
    if (!confirm('¿Seguro que quieres eliminar este pago?')) return

    const { error: deleteError } = await supabase
      .from('pagos')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError('Error al eliminar el pago: ' + deleteError.message)
      return
    }

    await cargarDatos()
  }

  async function eliminarGasto(id: string) {
    if (!confirm('¿Seguro que quieres eliminar este gasto?')) return

    const { error: deleteError } = await supabase
      .from('gastos')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError('Error al eliminar el gasto: ' + deleteError.message)
      return
    }

    await cargarDatos()
  }

  // ---- Totales: solo cuenta como cobrado lo que está marcado como pagado ----
  const pagosCobrados = pagos.filter((p) => p.pagado)
  const pagosPendientes = pagos.filter((p) => !p.pagado)

  const totalCobrado = pagosCobrados.reduce((t, p) => t + Number(p.monto || 0), 0)
  const totalPendiente = pagosPendientes.reduce((t, p) => t + Number(p.monto || 0), 0)
  const totalGastos = gastos.reduce((t, g) => t + Number(g.monto || 0), 0)
  const balance = totalCobrado - totalGastos

  // ---- Desglose por mes (YYYY-MM) combinando cobros y gastos ----
  const mesesMap: Record<string, { ingresos: number; gastos: number }> = {}

  // Los ingresos van al mes que se paga (concepto), no al mes en que se cobró
  for (const pago of pagosCobrados) {
    const mes = mesDelPago(pago)
    if (!mes) continue
    if (!mesesMap[mes]) mesesMap[mes] = { ingresos: 0, gastos: 0 }
    mesesMap[mes].ingresos += Number(pago.monto || 0)
  }

  for (const gasto of gastos) {
    const mes = (gasto.fecha || '').slice(0, 7)
    if (!mes) continue
    if (!mesesMap[mes]) mesesMap[mes] = { ingresos: 0, gastos: 0 }
    mesesMap[mes].gastos += Number(gasto.monto || 0)
  }

  const desgloseMeses = Object.entries(mesesMap)
    .map(([mes, v]) => ({ mes, ...v, balance: v.ingresos - v.gastos }))
    .sort((a, b) => b.mes.localeCompare(a.mes))

  const pagosDelMes = (mes: string) =>
    pagosCobrados
      .filter((p) => mesDelPago(p) === mes)
      .sort((a, b) =>
        (a.alumnos?.nombre || '').localeCompare(b.alumnos?.nombre || '')
      )

  // ---- Quién no ha pagado ----

  // 1) Cuotas: han reservado clases ese mes y no tienen ningún pago cobrado
  //    (que no sea el seguro) para ese mes.
  const alumnosConCuotaPagada = new Set(
    pagosCobrados
      .filter((p) => !esSeguro(p) && mesDelPago(p) === mesPendientes)
      .map((p) => p.alumno_id)
  )

  const reservasPorAlumno: Record<string, { nombre: string; clases: number }> = {}
  for (const r of reservasMes) {
    if (r.estado === 'cancelado' || !r.alumno_id) continue
    if (!reservasPorAlumno[r.alumno_id]) {
      reservasPorAlumno[r.alumno_id] = { nombre: r.alumno_nombre || 'Sin nombre', clases: 0 }
    }
    reservasPorAlumno[r.alumno_id].clases += 1
  }

  const sinPagarCuota = Object.entries(reservasPorAlumno)
    .filter(([id]) => !alumnosConCuotaPagada.has(id))
    .map(([id, info]) => ({ alumnoId: id, ...info }))
    .sort((a, b) => b.clases - a.clases)

  // 2) Seguro: socios sin el seguro cobrado para el año elegido.
  const alumnosConSeguro = new Set(
    pagosCobrados
      .filter((p) => esSeguro(p) && anioDelSeguro(p) === anioPendientes)
      .map((p) => p.alumno_id)
  )
  const sinSeguro = alumnos.filter((a) => !alumnosConSeguro.has(a.id))
  const conSeguro = alumnos.length - sinSeguro.length

  // 3) Deudas: pagos apuntados como pendientes.
  const deudasOrdenadas = [...pagosPendientes].sort((a, b) =>
    (a.fecha_pago || '').localeCompare(b.fecha_pago || '')
  )

  const aniosDisponibles = Array.from(
    new Set([
      anioActual,
      String(Number(anioActual) + 1),
      ...pagos.filter((p) => esSeguro(p)).map((p) => anioDelSeguro(p)),
    ])
  )
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))

  // ---- Tabla de pagos: filtros y orden ----
  const pagosFiltrados = pagos
    .filter((p) => !filtroAlumno || p.alumno_id === filtroAlumno)
    .filter((p) => !filtroConcepto || conceptoDelPago(p) === filtroConcepto)
    .filter((p) =>
      filtroEstado === 'pagado' ? p.pagado : filtroEstado === 'pendiente' ? !p.pagado : true
    )
    .filter((p) => {
      if (!filtroMes) return true
      // El seguro es anual: entra en cualquier mes de su año.
      return esSeguro(p) ? anioDelSeguro(p) === filtroMes.slice(0, 4) : mesDelPago(p) === filtroMes
    })

  const claveOrden = (p: Pago): string | number => {
    switch (orden) {
      case 'alumno':
        return (p.alumnos?.nombre || '').toLowerCase()
      case 'concepto':
        return conceptoDelPago(p)
      case 'periodo':
        return mesDelPago(p)
      case 'monto':
        return Number(p.monto || 0)
      case 'estado':
        return p.pagado ? 1 : 0
      default:
        return (p.fecha_pago || '') + (p.created_at || '')
    }
  }

  pagosFiltrados.sort((a, b) => {
    const ka = claveOrden(a)
    const kb = claveOrden(b)
    const cmp = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb))
    return ordenAsc ? cmp : -cmp
  })

  const totalFiltrado = pagosFiltrados.reduce((t, p) => t + Number(p.monto || 0), 0)
  const hayFiltros = filtroAlumno || filtroConcepto || filtroEstado || filtroMes

  function ordenarPor(campo: OrdenPagos) {
    if (orden === campo) {
      setOrdenAsc(!ordenAsc)
    } else {
      setOrden(campo)
      // Textos de la A a la Z; fechas, importes y estado de mayor a menor.
      setOrdenAsc(campo === 'alumno' || campo === 'concepto')
    }
  }

  function cabecera(campo: OrdenPagos, children: React.ReactNode) {
    const activo = orden === campo
    return (
      <th className="p-3" key={campo}>
        <button
          type="button"
          onClick={() => ordenarPor(campo)}
          className={`flex items-center gap-1 hover:text-blue-600 ${activo ? 'text-blue-700' : ''}`}
        >
          {children}
          <span className="text-xs text-gray-400">{activo ? (ordenAsc ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    )
  }

  const nombreAlumno = (id: string) => alumnos.find((a) => a.id === id)?.nombre || 'Sin nombre'
  const seguroSeleccionado = conceptoPago === 'Seguro'

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Volver al admin
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Finanzas
            </h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {aviso && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {aviso}
          </div>
        )}

        {/* Resumen */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total cobrado</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{euros(totalCobrado)}</p>
          </div>

          <button
            type="button"
            onClick={() => setPestana('deudas')}
            className="rounded-xl bg-white p-5 text-left shadow hover:ring-2 hover:ring-amber-200"
          >
            <p className="text-sm text-gray-500">Pendiente de cobro</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{euros(totalPendiente)}</p>
            <p className="text-xs text-gray-400">
              {pagosPendientes.length} {pagosPendientes.length === 1 ? 'pago pendiente' : 'pagos pendientes'}
            </p>
          </button>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total gastos</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{euros(totalGastos)}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="mt-1 text-2xl font-bold">{euros(balance)}</p>
          </div>
        </div>

        {/* Quién no ha pagado */}
        <div className="mb-8 rounded-xl border border-amber-200 bg-white p-6 shadow">
          <h2 className="mb-1 text-xl font-bold">⚠️ Quién no ha pagado</h2>
          <p className="mb-4 text-sm text-gray-500">
            Pulsa «Registrar pago» para rellenar el formulario con ese socio.
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ['cuotas', `Cuotas del mes (${sinPagarCuota.length})`],
                ['seguro', `Seguro ${anioPendientes} (${sinSeguro.length})`],
                ['deudas', `Pagos pendientes (${pagosPendientes.length})`],
              ] as [PestanaPendientes, string][]
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPestana(id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  pestana === id ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          {pestana === 'cuotas' && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <label htmlFor="mes-pendientes" className="text-gray-600">Mes:</label>
                <input
                  id="mes-pendientes"
                  type="month"
                  value={mesPendientes}
                  onChange={(e) => setMesPendientes(e.target.value)}
                  className="rounded-lg border p-1.5"
                />
              </div>
              {sinPagarCuota.length === 0 ? (
                <p className="text-green-700">
                  ✅ Todos los que han reservado en {nombreMes(mesPendientes)} tienen la cuota pagada.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-gray-600">
                    Han reservado clases en {nombreMes(mesPendientes)} y no tienen la cuota cobrada:
                  </p>
                  <ul className="divide-y">
                    {sinPagarCuota.map((a) => (
                      <li key={a.alumnoId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">{a.nombre}</span>
                          <span className="text-gray-500">
                            {' '}— {a.clases} {a.clases === 1 ? 'clase reservada' : 'clases reservadas'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => prepararPago(a.alumnoId, 'Mensualidad', mesPendientes)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Registrar pago
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {pestana === 'seguro' && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="anio-pendientes" className="text-gray-600">Año del seguro:</label>
                <select
                  id="anio-pendientes"
                  value={anioPendientes}
                  onChange={(e) => setAnioPendientes(e.target.value)}
                  className="rounded-lg border p-1.5"
                >
                  {aniosDisponibles.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <span className="text-gray-500">
                  {conSeguro} de {alumnos.length} socios lo tienen pagado
                </span>
              </div>
              {sinSeguro.length === 0 ? (
                <p className="text-green-700">✅ Todos los socios tienen el seguro de {anioPendientes} pagado.</p>
              ) : (
                <ul className="divide-y">
                  {sinSeguro.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-medium">{a.nombre}</span>
                      <span className="flex gap-4 text-sm">
                        <a
                          href={enlaceWhatsapp(a.telefono, mensajeSeguro(a.nombre, anioPendientes, ultimoImporteSeguro))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:underline"
                          title={a.telefono ? 'Enviar recordatorio por WhatsApp' : 'Sin teléfono: WhatsApp te pedirá elegir el contacto'}
                        >
                          Recordar por WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => prepararPago(a.id, 'Seguro', anioPendientes)}
                          className="text-blue-600 hover:underline"
                        >
                          Registrar pago
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {pestana === 'deudas' && (
            <div>
              {deudasOrdenadas.length === 0 ? (
                <p className="text-green-700">✅ No hay pagos apuntados como pendientes.</p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-gray-600">
                    Pagos apuntados sin cobrar. Total: <span className="font-semibold">{euros(totalPendiente)}</span>
                  </p>
                  <ul className="divide-y">
                    {deudasOrdenadas.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">{p.alumnos?.nombre || nombreAlumno(p.alumno_id)}</span>
                          <span className="text-gray-500">
                            {' '}— {conceptoDelPago(p)}, <span className="capitalize">{periodoDelPago(p)}</span>
                          </span>
                          <span className="ml-2 font-medium">{euros(Number(p.monto))}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarEstadoPago(p)}
                          className="text-sm text-green-700 hover:underline"
                        >
                          Marcar como cobrado
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Desglose por mes */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-1 text-xl font-bold">Desglose por mes</h2>
          <p className="mb-4 text-sm text-gray-500">
            Solo cuenta lo cobrado. Los ingresos cuentan en el mes que se paga, no en el día que se cobró (el seguro, en enero de su año). Pulsa un mes para ver quién lo ha pagado.
          </p>

          {desgloseMeses.length === 0 ? (
            <p className="text-gray-500">Todavía no hay datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Mes</th>
                    <th className="p-3">Ingresos</th>
                    <th className="p-3">Gastos</th>
                    <th className="p-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {desgloseMeses.map((m) => {
                    const abierto = mesAbierto === m.mes
                    const detalle = abierto ? pagosDelMes(m.mes) : []
                    return (
                      <Fragment key={m.mes}>
                        <tr
                          onClick={() => setMesAbierto(abierto ? null : m.mes)}
                          className="cursor-pointer border-b hover:bg-gray-50"
                        >
                          <td className="p-3 capitalize">
                            <span className="mr-2 text-gray-400">{abierto ? '▾' : '▸'}</span>
                            {nombreMes(m.mes)}
                          </td>
                          <td className="p-3 text-green-600">{euros(m.ingresos)}</td>
                          <td className="p-3 text-red-600">{euros(m.gastos)}</td>
                          <td className="p-3 font-medium">{euros(m.balance)}</td>
                        </tr>
                        {abierto && (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={4} className="p-3">
                              {detalle.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  Nadie ha pagado este mes todavía.
                                </p>
                              ) : (
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th className="p-2">Socio</th>
                                      <th className="p-2">Concepto</th>
                                      <th className="p-2">Fecha de cobro</th>
                                      <th className="p-2">Método</th>
                                      <th className="p-2">Cantidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalle.map((pago) => (
                                      <tr key={pago.id} className="border-t">
                                        <td className="p-2 font-medium">
                                          {pago.alumnos?.nombre || 'Sin socio'}
                                        </td>
                                        <td className="p-2">{conceptoDelPago(pago)}</td>
                                        <td className="p-2">{pago.fecha_pago}</td>
                                        <td className="p-2">{pago.metodo}</td>
                                        <td className="p-2">{euros(Number(pago.monto))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formularios */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <form
            ref={formPagoRef}
            onSubmit={agregarPago}
            className="scroll-mt-6 rounded-xl bg-white p-6 shadow"
          >
            <h2 className="mb-4 text-xl font-bold">Añadir pago</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Socio
                </label>

                <select
                  value={alumnoId}
                  onChange={(e) => setAlumnoId(e.target.value)}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="">Seleccionar socio</option>

                  {alumnos.map((alumno) => (
                    <option key={alumno.id} value={alumno.id}>
                      {alumno.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Concepto
                </label>

                <div className="flex flex-wrap gap-2">
                  {CONCEPTOS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => cambiarConcepto(c)}
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        conceptoPago === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {conceptoPago === 'Otro' && (
                  <input
                    type="text"
                    list="conceptos-usados"
                    value={conceptoLibre}
                    onChange={(e) => setConceptoLibre(e.target.value)}
                    className="mt-2 w-full rounded-lg border p-2"
                    placeholder="¿Qué paga? Excursión, inscripción..."
                    autoFocus
                  />
                )}
                <datalist id="conceptos-usados">
                  {conceptosLibres.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {seguroSeleccionado ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Año del seguro
                  </label>

                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={anioSeguro}
                    onChange={(e) => setAnioSeguro(e.target.value)}
                    className="w-full rounded-lg border p-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Seguro anual de la asociación que paga cada socio.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {conceptoPago === 'Mensualidad' ? 'Mes que paga' : 'Mes en que se apunta'}
                    </label>

                    <input
                      type="month"
                      value={mesPagado}
                      onChange={(e) => setMesPagado(e.target.value)}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Sesión (opcional)
                    </label>

                    <select
                      value={sesionId}
                      onChange={(e) => setSesionId(e.target.value)}
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="">Sin sesión (ej: mensualidad)</option>

                      {sesiones.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.actividad_nombre} — {s.dia_semana} {s.fecha}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cantidad (€)
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder={seguroSeleccionado ? '15.00' : '50.00'}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Método de pago
                </label>

                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Bizum">Bizum</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pagado"
                  checked={pagadoPago}
                  onChange={(e) => setPagadoPago(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="pagado" className="text-sm font-medium">
                  Pagado (desmárcalo para apuntarlo como pendiente)
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Fecha de cobro
                </label>

                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full rounded-lg border p-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Notas (opcional)
                </label>

                <input
                  type="text"
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder={seguroSeleccionado ? 'Seguro anual' : conceptoPago === 'Ropa' ? 'Camiseta talla M' : 'Detalle (opcional)'}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Añadir pago
              </button>
            </div>
          </form>

          <form
            onSubmit={agregarGasto}
            className="rounded-xl bg-white p-6 shadow"
          >
            <h2 className="mb-4 text-xl font-bold">Añadir gasto</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Concepto
                </label>

                <input
                  type="text"
                  value={conceptoGasto}
                  onChange={(e) => setConceptoGasto(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="Material deportivo, póliza del seguro..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Categoría
                </label>

                <input
                  type="text"
                  list="categorias-gasto"
                  value={categoriaGasto}
                  onChange={(e) => setCategoriaGasto(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="Seguro, Material, Alquiler..."
                />
                <datalist id="categorias-gasto">
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-gray-500">
                  Lo que la asociación paga a la aseguradora va aquí, con categoría «Seguro».
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cantidad (€)
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="100.00"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Fecha
                </label>

                <input
                  type="date"
                  value={fechaGasto}
                  onChange={(e) => setFechaGasto(e.target.value)}
                  className="w-full rounded-lg border p-2"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Añadir gasto
              </button>
            </div>
          </form>
        </div>

        {/* Pagos */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Pagos</h2>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={filtroAlumno}
              onChange={(e) => setFiltroAlumno(e.target.value)}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filtrar por socio"
            >
              <option value="">Todos los socios</option>
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>

            <select
              value={filtroConcepto}
              onChange={(e) => setFiltroConcepto(e.target.value)}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filtrar por concepto"
            >
              <option value="">Todos los conceptos</option>
              {conceptosFiltro.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as '' | 'pagado' | 'pendiente')}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filtrar por estado"
            >
              <option value="">Pagados y pendientes</option>
              <option value="pagado">Solo pagados</option>
              <option value="pendiente">Solo pendientes</option>
            </select>

            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="rounded-lg border p-2 text-sm"
              aria-label="Filtrar por mes pagado"
              title="Mes pagado"
            />

            <button
              type="button"
              onClick={() => {
                setFiltroAlumno('')
                setFiltroConcepto('')
                setFiltroEstado('')
                setFiltroMes('')
              }}
              disabled={!hayFiltros}
              className="rounded-lg border p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Quitar filtros
            </button>
          </div>

          {cargando ? (
            <p className="text-gray-500">Cargando...</p>
          ) : pagos.length === 0 ? (
            <p className="text-gray-500">No hay pagos registrados.</p>
          ) : pagosFiltrados.length === 0 ? (
            <p className="text-gray-500">Ningún pago coincide con los filtros.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-gray-500">
                {pagosFiltrados.length} {pagosFiltrados.length === 1 ? 'pago' : 'pagos'} · {euros(totalFiltrado)}
                {' '}· pulsa una columna para ordenar
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      {cabecera('fecha', 'Fecha')}
                      {cabecera('alumno', 'Socio')}
                      {cabecera('concepto', 'Concepto')}
                      {cabecera('periodo', 'Periodo')}
                      <th className="p-3">Método</th>
                      {cabecera('estado', 'Estado')}
                      {cabecera('monto', 'Cantidad')}
                      <th className="p-3">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagosFiltrados.map((pago) => {
                      const concepto = conceptoDelPago(pago)
                      return (
                        <tr key={pago.id} className={`border-b ${pago.pagado ? '' : 'bg-amber-50/50'}`}>
                          <td className="p-3 whitespace-nowrap">{pago.fecha_pago}</td>
                          <td className="p-3">
                            {pago.alumnos?.nombre || 'Sin socio'}
                            {pago.notas && <div className="text-xs text-gray-500">{pago.notas}</div>}
                          </td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-sm ${COLOR_CONCEPTO[concepto] || COLOR_CONCEPTO.Otro}`}>
                              {concepto}
                            </span>
                          </td>
                          <td className="p-3 capitalize whitespace-nowrap">{periodoDelPago(pago)}</td>
                          <td className="p-3">{pago.metodo}</td>
                          <td className="p-3 whitespace-nowrap">
                            {pago.pagado ? (
                              <span className="text-green-700">✅ Pagado</span>
                            ) : (
                              <span className="font-medium text-amber-700">⏳ Pendiente</span>
                            )}
                          </td>
                          <td className="p-3 font-medium whitespace-nowrap">
                            {euros(Number(pago.monto))}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-1 text-sm">
                              <button
                                onClick={() => cambiarEstadoPago(pago)}
                                className={pago.pagado ? 'text-gray-500 hover:underline' : 'text-green-700 hover:underline'}
                              >
                                {pago.pagado ? 'Marcar pendiente' : 'Marcar cobrado'}
                              </button>
                              <button
                                onClick={() => eliminarPago(pago.id)}
                                className="text-red-600 hover:underline"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Gastos */}
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Gastos</h2>

          {cargando ? (
            <p className="text-gray-500">Cargando...</p>
          ) : gastos.length === 0 ? (
            <p className="text-gray-500">No hay gastos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Concepto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Cantidad</th>
                    <th className="p-3">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {gastos.map((gasto) => (
                    <tr key={gasto.id} className="border-b">
                      <td className="p-3">{gasto.fecha}</td>
                      <td className="p-3">{gasto.concepto}</td>
                      <td className="p-3">{gasto.categoria}</td>
                      <td className="p-3 font-medium">
                        {euros(Number(gasto.monto))}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => eliminarGasto(gasto.id)}
                          className="text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
