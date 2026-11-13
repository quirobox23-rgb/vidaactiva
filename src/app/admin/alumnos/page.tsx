'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fechaLocal, finDeMes } from '@/lib/fecha'
import { enlaceWhatsapp, mensajeRecordatorio, nombreMes, PagoRecordatorio, SesionRecordatorio } from '@/lib/whatsapp'
import { esSeguro, mesDelPago } from '@/lib/pagos'
import { AlumnoBasico, esManual, normalizarNombre, posiblesCoincidencias, unirAlumnos } from '@/lib/alumnos'
import { cargarFichas, Ficha } from '@/lib/fichas'
import { EntrarFichas, FichaAlumno } from './FichaAlumno'

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [telefonoEdit, setTelefonoEdit] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mesRecordatorio, setMesRecordatorio] = useState(fechaLocal(new Date()).slice(0, 7))
  const [pagosMes, setPagosMes] = useState<Record<string, PagoRecordatorio[]>>({})
  const [sesionesMes, setSesionesMes] = useState<Record<string, SesionRecordatorio[]>>({})
  // Alumnos creados solos al reservar (no salen en la lista principal).
  const [todosAlumnos, setTodosAlumnos] = useState<AlumnoBasico[]>([])
  const [deReservas, setDeReservas] = useState<AlumnoBasico[]>([])
  const [destinoUnir, setDestinoUnir] = useState<Record<string, string>>({})
  const [uniendo, setUniendo] = useState<string | null>(null)

  // Fichas (datos delicados): solo con la sesión iniciada.
  const [sesionEmail, setSesionEmail] = useState<string | null>(null)
  const [fichas, setFichas] = useState<Record<string, Ficha>>({})
  const [faltaSqlFichas, setFaltaSqlFichas] = useState(false)
  const [fichaAbierta, setFichaAbierta] = useState<{ id: string; nombre: string; telefono?: string | null } | null>(null)
  const [mostrarEntrar, setMostrarEntrar] = useState(false)
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    cargarAlumnos()
    supabase.auth.getSession().then(({ data }) => alCambiarSesion(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => alCambiarSesion(sesion?.user.email ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function alCambiarSesion(email: string | null) {
    setSesionEmail(email)
    if (!email) {
      setFichas({})
      return
    }
    setMostrarEntrar(false)
    const r = await cargarFichas()
    setFaltaSqlFichas(!!r.faltaSql)
    if (r.error && !r.faltaSql) setError('Error al cargar las fichas: ' + r.error)
    setFichas(r.fichas)
  }

  function abrirFicha(a: { id: string; nombre: string; telefono?: string | null }) {
    if (!sesionEmail) {
      setMostrarEntrar(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setFichaAbierta(a)
  }

  const alumnosVisibles = buscar.trim()
    ? alumnos.filter((a) => {
        const q = normalizarNombre(buscar)
        const f = fichas[a.id]
        return (
          normalizarNombre(`${a.nombre} ${f?.apellidos || ''}`).includes(q) ||
          (a.telefono || '').replace(/\D/g, '').includes(buscar.replace(/\D/g, '') || '#')
        )
      })
    : alumnos

  useEffect(() => {
    if (mesRecordatorio) cargarResumenMes(mesRecordatorio)
  }, [mesRecordatorio])

  // Pagos y sesiones reservadas del mes elegido, agrupados por alumno, para el
  // recordatorio de WhatsApp.
  async function cargarResumenMes(mes: string) {
    const { data: p, error: pErr } = await supabase.from('pagos').select('*')
    const { data: r, error: rErr } = await supabase
      .from('reservas')
      .select('alumno_id, sesion_id, sesiones!inner(fecha)')
      .neq('estado', 'cancelado')
      .gte('sesiones.fecha', mes + '-01')
      .lte('sesiones.fecha', finDeMes(mes))
    if (pErr || rErr) {
      setError('Error al cargar el resumen del mes: ' + (pErr?.message || rErr?.message))
      return
    }

    const pagos: Record<string, PagoRecordatorio[]> = {}
    for (const pago of p || []) {
      // Los pagos sin mes_pagado (o si la columna aún no existe) cuentan en el
      // mes de la fecha de pago (ver mesDelPago).
      // El seguro anual no entra en el resumen de la mensualidad.
      if (esSeguro(pago)) continue
      if (mesDelPago(pago) !== mes) continue
      ;(pagos[pago.alumno_id] ||= []).push({ monto: pago.monto, pagado: pago.pagado })
    }

    type ReservaRow = { alumno_id: string; sesion_id: string; sesiones?: { fecha: string } | null }
    type SesionRow = { id: string; fecha: string; hora: string | null }
    const reservas = (r || []) as unknown as ReservaRow[]

    const sesionIds = Array.from(new Set(reservas.map(row => row.sesion_id)))
    const infoSesion: Record<string, SesionRow> = {}
    if (sesionIds.length > 0) {
      const { data: s } = await supabase
        .from('vista_sesiones')
        .select('id, fecha, hora')
        .in('id', sesionIds)
      for (const ses of (s || []) as SesionRow[]) infoSesion[ses.id] = ses
    }

    const sesiones: Record<string, SesionRecordatorio[]> = {}
    for (const row of reservas) {
      const ses = infoSesion[row.sesion_id]
      ;(sesiones[row.alumno_id] ||= []).push({
        fecha: ses?.fecha || row.sesiones?.fecha || '',
        hora: ses?.hora || null,
      })
    }

    setPagosMes(pagos)
    setSesionesMes(sesiones)
  }

  function enviarRecordatorio(a: { id: string; nombre: string; telefono?: string | null }) {
    const texto = mensajeRecordatorio(a.nombre, mesRecordatorio, pagosMes[a.id] || [], sesionesMes[a.id] || [])
    window.open(enlaceWhatsapp(a.telefono, texto), '_blank')
  }

  async function cargarAlumnos() {
    setError('')
    const { data, error: err } = await supabase
      .from('alumnos')
      .select('*')
      .or('origen.is.null,origen.eq.manual')
      .order('nombre')
    if (err) {
      setError('Error: ' + err.message)
      return
    }
    setAlumnos(data || [])

    const { data: todos } = await supabase.from('alumnos').select('id, nombre, telefono, origen').order('nombre')
    setTodosAlumnos((todos || []) as AlumnoBasico[])
    setDeReservas(((todos || []) as AlumnoBasico[]).filter((a) => !esManual(a)))
  }

  // Opciones para "es la misma persona que…": primero las sugeridas, luego el resto
  // (los de la lista principal antes que los creados desde reservas).
  function opcionesUnir(a: AlumnoBasico) {
    const sugeridos = posiblesCoincidencias(a, todosAlumnos)
    const idsSugeridos = new Set(sugeridos.map((s) => s.alumno.id))
    const resto = todosAlumnos
      .filter((o) => o.id !== a.id && !idsSugeridos.has(o.id))
      .sort((x, y) => Number(esManual(y)) - Number(esManual(x)) || x.nombre.localeCompare(y.nombre))
    return { sugeridos, resto }
  }

  async function unir(dup: AlumnoBasico, principalId: string) {
    const principal = todosAlumnos.find((o) => o.id === principalId)
    if (!principal) return
    const tel = (x: AlumnoBasico) => (x.telefono ? ` (${x.telefono})` : '')
    if (!confirm(
      `¿Unir "${dup.nombre}"${tel(dup)} con "${principal.nombre}"${tel(principal)}?\n\n` +
      `Sus reservas y pagos pasarán a "${principal.nombre}" y "${dup.nombre}" desaparecerá de las listas. Esto no se puede deshacer.`
    )) return
    setUniendo(dup.id)
    setError('')
    try {
      await unirAlumnos(dup, principal)
      setMensaje(`✅ "${dup.nombre}" unido con "${principal.nombre}".`)
      setTimeout(() => setMensaje(''), 4000)
    } catch (e) {
      setError((e as Error).message)
    }
    setUniendo(null)
    cargarAlumnos()
  }

  async function pasarALista(a: AlumnoBasico) {
    setError('')
    const { error: err } = await supabase.from('alumnos').update({ origen: 'manual' }).eq('id', a.id)
    if (err) return setError('Error al guardar: ' + err.message)
    setMensaje(`✅ "${a.nombre}" añadido a la lista de alumnos.`)
    setTimeout(() => setMensaje(''), 3000)
    cargarAlumnos()
  }

  async function agregarAlumno(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: err } = await supabase.from('alumnos').insert({ nombre, telefono, origen: 'manual' })
    if (err) {
      setError('Error al añadir: ' + err.message)
      return
    }
    setNombre('')
    setTelefono('')
    setMensaje('✅ Alumno añadido.')
    cargarAlumnos()
    setTimeout(() => setMensaje(''), 3000)
  }

  function iniciarEdicion(a: any) {
    setEditandoId(a.id)
    setNombreEdit(a.nombre)
    setTelefonoEdit(a.telefono || '')
    setError('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setNombreEdit('')
    setTelefonoEdit('')
  }

  async function guardarEdicion(id: string) {
    if (!nombreEdit.trim()) {
      setError('El nombre no puede estar vacío.')
      return
    }
    setGuardando(true)
    setError('')
    const { error: err } = await supabase
      .from('alumnos')
      .update({ nombre: nombreEdit.trim(), telefono: telefonoEdit.trim() || null })
      .eq('id', id)
    setGuardando(false)

    if (err) {
      setError('Error al guardar: ' + err.message)
      return
    }

    setMensaje('✅ Alumno actualizado.')
    cancelarEdicion()
    cargarAlumnos()
    setTimeout(() => setMensaje(''), 3000)
  }

  const [eliminando, setEliminando] = useState<string | null>(null)

  async function eliminarAlumno(id: string, nombreAlumno: string) {
    if (!confirm(`¿Seguro que quieres eliminar a "${nombreAlumno}"?`)) return

    setEliminando(id)
    setError('')
    const { error: err } = await supabase.from('alumnos').delete().eq('id', id)
    setEliminando(null)

    if (err) {
      if (err.message.includes('foreign key') || err.code === '23503') {
        setError(`No se puede eliminar a "${nombreAlumno}" porque tiene reservas y/o pagos registrados. Si de verdad quieres borrarlo, primero tendrías que quitar sus reservas (en Sesiones) y sus pagos (en Finanzas).`)
      } else {
        setError('Error al eliminar: ' + err.message)
      }
      return
    }

    setMensaje('✅ Alumno eliminado.')
    cargarAlumnos()
    setTimeout(() => setMensaje(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-slate-500 hover:text-pink-600 text-sm">← Volver al Dashboard</Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-800">Alumnos</h1>

      {mensaje && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{mensaje}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="font-semibold mb-4">➕ Añadir alumno</h2>
        <form onSubmit={agregarAlumno} className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Nombre</label>
            <input 
              value={nombre} 
              onChange={e => setNombre(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Teléfono</label>
            <input 
              value={telefono} 
              onChange={e => setTelefono(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2" 
            />
          </div>
          <button type="submit" className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 font-medium">
            Añadir
          </button>
        </form>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        {sesionEmail ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              🔓 Fichas abiertas como <span className="font-medium">{sesionEmail}</span>. Pulsa «Ficha» en cada alumno.
            </p>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500 hover:text-pink-600 underline">
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                🔒 Las <span className="font-medium">fichas</span> (DNI, contacto de emergencia, lesiones, salud) están protegidas. Entra con tu usuario para verlas.
              </p>
              {!mostrarEntrar && (
                <button onClick={() => setMostrarEntrar(true)} className="text-sm bg-pink-600 text-white px-4 py-1.5 rounded-lg hover:bg-pink-700">
                  Entrar
                </button>
              )}
            </div>
            {mostrarEntrar && <EntrarFichas onEntrar={() => setMostrarEntrar(false)} />}
          </div>
        )}
        {sesionEmail && faltaSqlFichas && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Falta crear la tabla de fichas en Supabase (SQL Editor). Hasta entonces no se pueden guardar.
          </div>
        )}
      </div>

      {deReservas.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-amber-100">
            <h2 className="font-semibold text-amber-900">Revisar alumnos creados al reservar ({deReservas.length})</h2>
            <p className="text-sm text-amber-800 mt-1">
              Se crearon solos cuando alguien reservó con un nombre que no estaba en la lista. Si es la misma persona que otro alumno,
              elige cuál y pulsa «Unir»: sus reservas y pagos pasan a ese alumno. Si es alguien nuevo, pulsa «Es alumno nuevo».
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {deReservas.map((a) => {
              const { sugeridos, resto } = opcionesUnir(a)
              const elegido = destinoUnir[a.id] ?? sugeridos[0]?.alumno.id ?? ''
              return (
                <div key={a.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.nombre}</div>
                    <div className="text-sm text-slate-500">{a.telefono || 'Sin teléfono'}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={elegido}
                      onChange={(e) => setDestinoUnir({ ...destinoUnir, [a.id]: e.target.value })}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white max-w-[16rem]"
                      aria-label={`Es la misma persona que…`}
                    >
                      <option value="">Es la misma persona que…</option>
                      {sugeridos.length > 0 && (
                        <optgroup label="Sugeridos">
                          {sugeridos.map((s) => (
                            <option key={s.alumno.id} value={s.alumno.id}>
                              {s.alumno.nombre}{s.alumno.telefono ? ` · ${s.alumno.telefono}` : ''} ({s.motivo})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Todos">
                        {resto.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}{o.telefono ? ` · ${o.telefono}` : ''}{esManual(o) ? '' : ' (de reserva)'}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <button
                      onClick={() => unir(a, elegido)}
                      disabled={!elegido || uniendo === a.id}
                      className="text-sm bg-pink-600 text-white px-3 py-1 rounded-lg hover:bg-pink-700 disabled:bg-slate-300 transition"
                    >
                      {uniendo === a.id ? 'Uniendo...' : 'Unir'}
                    </button>
                    <button
                      onClick={() => pasarALista(a)}
                      className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-50 transition"
                    >
                      Es alumno nuevo
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Lista de alumnos ({alumnos.length})</h2>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className="border border-slate-300 rounded-lg px-3 py-1 text-sm"
            />
          </div>
          <label className="text-sm text-slate-500 flex items-center gap-2">
            Recordatorio de WhatsApp de
            <input
              type="month"
              value={mesRecordatorio}
              onChange={e => setMesRecordatorio(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-700"
            />
          </label>
        </div>
        <div className="divide-y divide-slate-100">
          {alumnos.length === 0 && <div className="px-6 py-6 text-center text-slate-400">No hay alumnos registrados.</div>}
          {alumnos.length > 0 && alumnosVisibles.length === 0 && (
            <div className="px-6 py-6 text-center text-slate-400">Nadie coincide con «{buscar}».</div>
          )}
          {alumnosVisibles.map(a => (
            <div key={a.id} className="px-6 py-3">
              {editandoId === a.id ? (
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                    <input
                      value={nombreEdit}
                      onChange={e => setNombreEdit(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
                    <input
                      value={telefonoEdit}
                      onChange={e => setTelefonoEdit(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => guardarEdicion(a.id)}
                    disabled={guardando}
                    className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 transition"
                  >
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={cancelarEdicion}
                    className="bg-slate-100 text-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {a.nombre}{fichas[a.id]?.apellidos ? ` ${fichas[a.id].apellidos}` : ''}
                    </div>
                    {a.telefono && <div className="text-sm text-slate-500">{a.telefono}</div>}
                    {sesionEmail && fichas[a.id]?.lesiones && (
                      <div className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700" title={fichas[a.id].lesiones || ''}>
                        🩹 {fichas[a.id].lesiones!.length > 40 ? fichas[a.id].lesiones!.slice(0, 40) + '…' : fichas[a.id].lesiones}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => abrirFicha(a)}
                      className={`text-sm px-3 py-1 rounded-lg transition ${
                        sesionEmail && fichas[a.id] ? 'bg-pink-50 hover:bg-pink-100 text-pink-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title={sesionEmail ? (fichas[a.id] ? 'Ver ficha' : 'Crear ficha') : 'Entra para ver las fichas'}
                    >
                      {sesionEmail ? '📋 Ficha' : '🔒 Ficha'}
                    </button>
                    <button
                      onClick={() => enviarRecordatorio(a)}
                      title={a.telefono ? `Enviar resumen de ${nombreMes(mesRecordatorio)} por WhatsApp` : 'Sin teléfono: WhatsApp te pedirá elegir el contacto'}
                      className="text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1 rounded-lg transition"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => iniciarEdicion(a)}
                      className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarAlumno(a.id, a.nombre)}
                      disabled={eliminando === a.id}
                      className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {eliminando === a.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {fichaAbierta && (
        <FichaAlumno
          alumno={fichaAbierta}
          ficha={fichas[fichaAbierta.id]}
          onCerrar={() => setFichaAbierta(null)}
          onGuardada={(f) => {
            setFichas({ ...fichas, [f.alumno_id]: f })
            setFichaAbierta(null)
            setMensaje('✅ Ficha guardada.')
            setTimeout(() => setMensaje(''), 3000)
          }}
        />
      )}
    </div>
  )
}
