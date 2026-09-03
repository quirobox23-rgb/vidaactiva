'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { fechaLocal } from '@/lib/fecha'

export default function SesionesPage() {
  const [actividades, setActividades] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [reservas, setReservas] = useState<any[]>([])
  const [sesionSeleccionada, setSesionSeleccionada] = useState<string | null>(null)
  const [semanaInicio, setSemanaInicio] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarTodo()
    const hoy = new Date()
    const diaSemana = hoy.getDay() || 7
    const lunes = new Date(hoy.setDate(hoy.getDate() - diaSemana + 1))
    setSemanaInicio(fechaLocal(lunes))
  }, [])

  async function cargarTodo() {
    setError('')
    const { data: actData, error: actErr } = await supabase.from('actividades').select('*').eq('activa', true).order('dia_semana')
    if (actErr) {
      setError('Error al cargar actividades: ' + actErr.message)
      console.error(actErr)
      return
    }
    setActividades(actData || [])
    await cargarSesiones()
  }

  async function cargarSesiones() {
    const { data, error: sesErr } = await supabase.from('vista_sesiones').select('*').order('fecha', { ascending: false }).limit(50)
    if (sesErr) {
      setError('Error al cargar sesiones: ' + sesErr.message)
      console.error(sesErr)
      return
    }
    setSesiones(data || [])
  }

  async function verReservas(sesionId: string) {
    setSesionSeleccionada(sesionId)
    const { data } = await supabase.from('vista_reservas').select('*').eq('sesion_id', sesionId).order('fecha_reserva')
    setReservas(data || [])
  }

  async function cambiarEstadoReserva(reservaId: string, nuevoEstado: string) {
    await supabase.from('reservas').update({ estado: nuevoEstado }).eq('id', reservaId)
    if (sesionSeleccionada) verReservas(sesionSeleccionada)
    cargarSesiones()
  }

  async function generarSemana() {
    if (!semanaInicio) return setError('Selecciona el lunes de la semana')
    setCargando(true)
    setMensaje('')
    setError('')

    const diasMap: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 }
    const lunes = new Date(semanaInicio)
    const fijas = actividades.filter(a => a.tipo === 'fija')
    let creadas = 0

    for (const act of fijas) {
      const offset = diasMap[act.dia_semana.toLowerCase()]
      const fechaSesion = new Date(lunes)
      fechaSesion.setDate(lunes.getDate() + offset)
      const fechaStr = fechaLocal(fechaSesion)

      const { data: existente } = await supabase.from('sesiones').select('id').eq('actividad_id', act.id).eq('fecha', fechaStr)
      if (existente && existente.length > 0) continue

      const { error: insertErr } = await supabase.from('sesiones').insert({ actividad_id: act.id, fecha: fechaStr, estado: 'abierta' })
      if (!insertErr) creadas++
    }

    setCargando(false)
    setMensaje(creadas > 0 ? `✅ ${creadas} sesiones creadas.` : 'ℹ️ Las sesiones de esta semana ya existen.')
    cargarSesiones()
  }

  async function crearSesionDemanda(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMensaje('')
    setError('')
    const form = new FormData(e.currentTarget)
    const { error: err } = await supabase.from('sesiones').insert({ actividad_id: form.get('actividad_id'), fecha: form.get('fecha'), estado: 'abierta' })
    if (err) { setError('Error: ' + err.message); return }
    setMensaje('✅ Sesión creada.')
    cargarSesiones()
    e.currentTarget.reset()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-slate-500 hover:text-pink-600 text-sm">← Volver al Dashboard</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Gestión de Sesiones</h1>

      {mensaje && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{mensaje}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      {/* Generar semana */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">⚡ Generar sesiones fijas de la semana</h2>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Lunes de la semana</label>
            <input type="date" value={semanaInicio} onChange={e => setSemanaInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 bg-white" />
          </div>
          <button onClick={generarSemana} disabled={cargando} className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 disabled:bg-slate-400 transition font-medium">
            {cargando ? 'Generando...' : 'Generar semana'}
          </button>
        </div>
      </div>

      {/* Crear demanda */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">➕ Crear sesión bajo demanda</h2>
        <form onSubmit={crearSesionDemanda} className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Actividad</label>
            <select name="actividad_id" className="border border-slate-300 rounded-lg px-3 py-2 bg-white min-w-[220px]" required>
              <option value="">Selecciona...</option>
              {actividades.filter(a => a.tipo === 'demanda').map(a => (
                <option key={a.id} value={a.id}>{a.dia_semana} {a.hora?.slice(0,5)} — {a.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Fecha</label>
            <input type="date" name="fecha" className="border border-slate-300 rounded-lg px-3 py-2 bg-white" required />
          </div>
          <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">Crear sesión</button>
        </form>
      </div>

      {/* Lista sesiones + reservas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Sesiones</h2>
          <button onClick={cargarSesiones} className="text-sm text-pink-600 hover:text-pink-700 font-medium">🔄 Actualizar</button>
        </div>
        <div className="divide-y divide-slate-100">
          {sesiones.length === 0 && <div className="px-6 py-8 text-center text-slate-400">No hay sesiones.</div>}
          {sesiones.map(s => (
            <div key={s.id} className="px-6 py-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="font-medium text-slate-800">{s.actividad_nombre}</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-slate-600">{s.dia_semana} {s.fecha} {s.hora?.slice(0,5)}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${s.tipo === 'fija' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{s.tipo}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-slate-500">{s.reservas_count || 0}/{s.cupo_maximo} reservas</span>
                  <button onClick={() => verReservas(s.id)} className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg transition">
                    {sesionSeleccionada === s.id ? 'Ocultar' : 'Ver reservas'}
                  </button>
                </div>
              </div>

              {/* Panel de reservas de esta sesión */}
              {sesionSeleccionada === s.id && (
                <div className="mt-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Reservas ({reservas.length})</h3>
                  {reservas.length === 0 && <div className="text-sm text-slate-400">Sin reservas.</div>}
                  <div className="space-y-2">
                    {reservas.map(r => (
                      <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100">
                        <div>
                          <div className="font-medium text-sm">{r.alumno_nombre}</div>
                          <div className="text-xs text-slate-500">{r.alumno_telefono} • {new Date(r.fecha_reserva).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${r.estado === 'asistio' ? 'bg-green-100 text-green-700' : r.estado === 'reservado' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {r.estado}
                          </span>
                          <button onClick={() => cambiarEstadoReserva(r.id, 'asistio')} className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Asistió</button>
                          <button onClick={() => cambiarEstadoReserva(r.id, 'cancelado')} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Anular</button>
                          <button onClick={() => cambiarEstadoReserva(r.id, 'reservado')} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Confirmar</button>
                        </div>
                      </div>
                    ))}
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