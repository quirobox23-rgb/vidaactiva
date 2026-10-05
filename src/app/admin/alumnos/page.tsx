'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fechaLocal } from '@/lib/fecha'
import { enlaceWhatsapp, mensajeRecordatorio, nombreMes, PagoRecordatorio, SesionRecordatorio } from '@/lib/whatsapp'

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

  useEffect(() => {
    cargarAlumnos()
  }, [])

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
      .lte('sesiones.fecha', mes + '-31')
    if (pErr || rErr) {
      setError('Error al cargar el resumen del mes: ' + (pErr?.message || rErr?.message))
      return
    }

    const pagos: Record<string, PagoRecordatorio[]> = {}
    for (const pago of p || []) {
      // Los pagos sin mes_pagado (o si la columna aún no existe) cuentan en el
      // mes de la fecha de pago.
      const mesPago = pago.mes_pagado || (pago.fecha_pago || '').slice(0, 7)
      if (mesPago !== mes) continue
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
          <h2 className="font-semibold">Lista de alumnos ({alumnos.length})</h2>
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
          {alumnos.map(a => (
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
                    <div className="font-medium">{a.nombre}</div>
                    {a.telefono && <div className="text-sm text-slate-500">{a.telefono}</div>}
                  </div>
                  <div className="flex gap-2">
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
    </div>
  )
}