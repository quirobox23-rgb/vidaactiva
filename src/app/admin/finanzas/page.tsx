'use client'

import { Fragment, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fechaLocal } from '@/lib/fecha'

type Alumno = {
  id: string
  nombre: string
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

// Mes al que corresponde el pago (YYYY-MM). Los pagos antiguos sin mes_pagado
// usan el mes de la fecha de pago.
function mesDelPago(pago: Pago): string {
  return pago.mes_pagado || (pago.fecha_pago || '').slice(0, 7)
}

function nombreMes(mes: string) {
  const [y, m] = mes.split('-')
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${nombres[Number(m) - 1]} ${y}`
}

type ReservaMes = {
  alumno_id: string
  estado: string
  alumno_nombre: string
}

export default function FinanzasPage() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [reservasMes, setReservasMes] = useState<ReservaMes[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const [alumnoId, setAlumnoId] = useState('')
  const [sesionId, setSesionId] = useState('')
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [pagadoPago, setPagadoPago] = useState(true)
  const [fechaPago, setFechaPago] = useState(
    fechaLocal(new Date())
  )
  const [mesPagado, setMesPagado] = useState(
    fechaLocal(new Date()).slice(0, 7)
  )
  const [notasPago, setNotasPago] = useState('')
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)

  const [conceptoGasto, setConceptoGasto] = useState('')
  const [categoriaGasto, setCategoriaGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [fechaGasto, setFechaGasto] = useState(
    fechaLocal(new Date())
  )

  useEffect(() => {
    cargarDatos()
  }, [])

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
      .select('id, nombre')
      .order('nombre')

    const { data: s, error: sErr } = await supabase
      .from('vista_sesiones')
      .select('id, actividad_nombre, dia_semana, fecha, hora')
      .order('fecha', { ascending: false })
      .limit(50)

    const mesActual = fechaLocal(new Date()).slice(0, 7)
    const inicioMes = mesActual + '-01'
    const finMes = mesActual + '-31'

    const { data: r, error: rErr } = await supabase
      .from('reservas')
      .select('alumno_id, estado, alumnos(nombre), sesiones!inner(fecha)')
      .neq('estado', 'cancelado')
      .gte('sesiones.fecha', inicioMes)
      .lte('sesiones.fecha', finMes)

    if (pErr || gErr || aErr || sErr || rErr) {
      setError(
        'Error al cargar datos: ' +
          (pErr?.message || gErr?.message || aErr?.message || sErr?.message || rErr?.message)
      )
      setCargando(false)
      return
    }

    setPagos(p || [])
    setGastos(g || [])
    setAlumnos(a || [])
    setSesiones(s || [])
    setReservasMes(
      (r || []).map((row: any) => ({
        alumno_id: row.alumno_id,
        estado: row.estado,
        alumno_nombre: row.alumnos?.nombre || 'Sin nombre',
      }))
    )
    setCargando(false)
  }

  async function agregarPago(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!alumnoId || !montoPago) {
      setError('Selecciona un alumno e introduce una cantidad.')
      return
    }

    if (!mesPagado) {
      setError('Indica el mes al que corresponde el pago.')
      return
    }

    const nuevoPago = {
      alumno_id: alumnoId,
      sesion_id: sesionId || null,
      monto: Number(montoPago),
      metodo: metodoPago,
      pagado: pagadoPago,
      fecha_pago: fechaPago,
      notas: notasPago || null,
    }

    let { error: insertError } = await supabase
      .from('pagos')
      .insert({ ...nuevoPago, mes_pagado: mesPagado })

    // Si la columna mes_pagado aún no existe en la base de datos, guardamos el
    // pago igualmente (contará en el mes de la fecha de pago) y avisamos.
    if (insertError && insertError.message.includes('mes_pagado')) {
      ;({ error: insertError } = await supabase.from('pagos').insert(nuevoPago))
      if (!insertError) {
        setError(
          'Pago guardado, pero sin el mes pagado: falta añadir la columna mes_pagado en Supabase (ver supabase/mes_pagado.sql).'
        )
      }
    }

    if (insertError) {
      setError('Error al añadir el pago: ' + insertError.message)
      return
    }

    setAlumnoId('')
    setSesionId('')
    setMontoPago('')
    setMetodoPago('Efectivo')
    setPagadoPago(true)
    setFechaPago(fechaLocal(new Date()))
    setMesPagado(fechaLocal(new Date()).slice(0, 7))
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
    setFechaGasto(fechaLocal(new Date()))

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

  const totalPagos = pagos.reduce(
    (total, pago) => total + Number(pago.monto || 0),
    0
  )

  const totalGastos = gastos.reduce(
    (total, gasto) => total + Number(gasto.monto || 0),
    0
  )

  const balance = totalPagos - totalGastos

  // Desglose por mes (YYYY-MM) combinando pagos y gastos
  const mesesMap: Record<string, { ingresos: number; gastos: number }> = {}

  // Los ingresos van al mes que se paga (concepto), no al mes en que se cobró
  for (const pago of pagos) {
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
    pagos
      .filter((p) => mesDelPago(p) === mes)
      .sort((a, b) =>
        (a.alumnos?.nombre || '').localeCompare(b.alumnos?.nombre || '')
      )

  // Alumnos que han reservado clases este mes pero no tienen ningún pago marcado como "pagado" que corresponda a este mes
  const mesActual = fechaLocal(new Date()).slice(0, 7)

  const alumnosConPagoEsteMes = new Set(
    pagos
      .filter((p) => p.pagado && mesDelPago(p) === mesActual)
      .map((p) => p.alumno_id)
  )

  const reservasEsteMesPorAlumno: Record<string, { nombre: string; clases: number }> = {}
  for (const r of reservasMes) {
    if (r.estado === 'cancelado') continue
    if (!r.alumno_id) continue
    if (!reservasEsteMesPorAlumno[r.alumno_id]) {
      reservasEsteMesPorAlumno[r.alumno_id] = { nombre: r.alumno_nombre || 'Sin nombre', clases: 0 }
    }
    reservasEsteMesPorAlumno[r.alumno_id].clases += 1
  }

  const alumnosSinPagar = Object.entries(reservasEsteMesPorAlumno)
    .filter(([alumnoId]) => !alumnosConPagoEsteMes.has(alumnoId))
    .map(([alumnoId, info]) => ({ alumnoId, ...info }))
    .sort((a, b) => b.clases - a.clases)

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

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total cobrado</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {totalPagos.toFixed(2)} €
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total gastos</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {totalGastos.toFixed(2)} €
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="mt-1 text-2xl font-bold">
              {balance.toFixed(2)} €
            </p>
          </div>
        </div>

        {alumnosSinPagar.length > 0 && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-amber-800">
              ⚠️ Han reservado este mes y no tienen ningún pago registrado
            </h2>
            <ul className="space-y-1">
              {alumnosSinPagar.map((a) => (
                <li key={a.alumnoId} className="text-amber-800">
                  <span className="font-medium">{a.nombre}</span>
                  <span className="text-amber-600">
                    {' '}
                    — {a.clases} {a.clases === 1 ? 'clase' : 'clases'} reservada{a.clases === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-1 text-xl font-bold">Desglose por mes</h2>
          <p className="mb-4 text-sm text-gray-500">
            Los ingresos cuentan en el mes que se paga, no en el día que se cobró. Pulsa un mes para ver quién lo ha pagado.
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
                          <td className="p-3 text-green-600">{m.ingresos.toFixed(2)} €</td>
                          <td className="p-3 text-red-600">{m.gastos.toFixed(2)} €</td>
                          <td className="p-3 font-medium">{m.balance.toFixed(2)} €</td>
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
                                      <th className="p-2">Alumno</th>
                                      <th className="p-2">Fecha de cobro</th>
                                      <th className="p-2">Método</th>
                                      <th className="p-2">Pagado</th>
                                      <th className="p-2">Cantidad</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalle.map((pago) => (
                                      <tr key={pago.id} className="border-t">
                                        <td className="p-2 font-medium">
                                          {pago.alumnos?.nombre || 'Sin alumno'}
                                        </td>
                                        <td className="p-2">{pago.fecha_pago}</td>
                                        <td className="p-2">{pago.metodo}</td>
                                        <td className="p-2">{pago.pagado ? '✅' : '❌'}</td>
                                        <td className="p-2">{Number(pago.monto).toFixed(2)} €</td>
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

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <form
            onSubmit={agregarPago}
            className="rounded-xl bg-white p-6 shadow"
          >
            <h2 className="mb-4 text-xl font-bold">Añadir pago</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Alumno
                </label>

                <select
                  value={alumnoId}
                  onChange={(e) => setAlumnoId(e.target.value)}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="">Seleccionar alumno</option>

                  {alumnos.map((alumno) => (
                    <option key={alumno.id} value={alumno.id}>
                      {alumno.nombre}
                    </option>
                  ))}
                </select>
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
                  placeholder="50.00"
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
                  Pagado
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
                  Mes que paga
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
                  Notas (opcional)
                </label>

                <input
                  type="text"
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="Mensualidad de septiembre"
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
                  placeholder="Material deportivo"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Categoría
                </label>

                <input
                  type="text"
                  value={categoriaGasto}
                  onChange={(e) => setCategoriaGasto(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="Material, Alquiler, Suministros..."
                />
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

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Pagos</h2>

          {cargando ? (
            <p className="text-gray-500">Cargando...</p>
          ) : pagos.length === 0 ? (
            <p className="text-gray-500">No hay pagos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Alumno</th>
                    <th className="p-3">Mes pagado</th>
                    <th className="p-3">Método</th>
                    <th className="p-3">Pagado</th>
                    <th className="p-3">Cantidad</th>
                    <th className="p-3">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {pagos.map((pago) => (
                    <tr key={pago.id} className="border-b">
                      <td className="p-3">{pago.fecha_pago}</td>
                      <td className="p-3">
                        {pago.alumnos?.nombre || 'Sin alumno'}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-sm capitalize text-blue-700">
                          {nombreMes(mesDelPago(pago))}
                        </span>
                      </td>
                      <td className="p-3">{pago.metodo}</td>
                      <td className="p-3">{pago.pagado ? '✅' : '❌'}</td>
                      <td className="p-3 font-medium">
                        {Number(pago.monto).toFixed(2)} €
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => eliminarPago(pago.id)}
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
                        {Number(gasto.monto).toFixed(2)} €
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