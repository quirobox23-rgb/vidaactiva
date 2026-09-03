'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
}

function lunesDeLaSemana(fecha: Date) {
  const d = new Date(fecha)
  const diaSemana = d.getDay() || 7
  d.setDate(d.getDate() - diaSemana + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatoFecha(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function CalendarioPage() {
  const [semanaInicio, setSemanaInicio] = useState(() => lunesDeLaSemana(new Date()))
  const [actividades, setActividades] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<{ dia: string, fecha: string, hora: string } | null>(null)
  const [actividadElegida, setActividadElegida] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const diasSemana = DIAS.map((_, i) => {
    const d = new Date(semanaInicio)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    cargarActividades()
  }, [])

  useEffect(() => {
    cargarSesionesSemana()
  }, [semanaInicio])

  async function cargarActividades() {
    const { data } = await supabase.from('actividades').select('*').eq('activa', true).order('hora')
    setActividades(data || [])
  }

  async function cargarSesionesSemana() {
    const desde = formatoFecha(diasSemana[0])
    const hasta = formatoFecha(diasSemana[6])
    const { data } = await supabase
      .from('vista_sesiones')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
    setSesiones(data || [])
  }

  const horas = Array.from(
    new Set(actividades.map(a => a.hora?.slice(0, 5)).filter(Boolean))
  ).sort()

  function sesionEn(fecha: string, hora: string) {
    return sesiones.find(s => s.fecha === fecha && s.hora?.slice(0, 5) === hora)
  }

  function abrirCelda(dia: string, fecha: string, hora: string) {
    setMensaje('')
    setError('')
    setActividadElegida('')
    setCeldaSeleccionada({ dia, fecha, hora })
  }

  async function crearSesionEnCelda() {
    if (!celdaSeleccionada || !actividadElegida) return
    setCargando(true)
    setError('')

    const { error: err } = await supabase.from('sesiones').insert({
      actividad_id: actividadElegida,
      fecha: celdaSeleccionada.fecha,
      estado: 'abierta'
    })

    setCargando(false)

    if (err) {
      setError('Error al crear la sesión: ' + err.message)
      return
    }

    setMensaje('✅ Sesión creada.')
    setCeldaSeleccionada(null)
    cargarSesionesSemana()
  }

  const actividadesDeEstaHora = actividades.filter(
    a => a.hora?.slice(0, 5) === celdaSeleccionada?.hora
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/sesiones" className="text-slate-500 hover:text-pink-600 text-sm">← Ver lista de sesiones</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Calendario semanal</h1>

      {mensaje && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{mensaje}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => { const d = new Date(semanaInicio); d.setDate(d.getDate() - 7); setSemanaInicio(d) }}
          className="text-slate-600 hover:text-pink-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          ← Semana anterior
        </button>
        <div className="font-semibold text-slate-800">
          {formatoFecha(diasSemana[0])} — {formatoFecha(diasSemana[6])}
        </div>
        <button
          onClick={() => { const d = new Date(semanaInicio); d.setDate(d.getDate() + 7); setSemanaInicio(d) }}
          className="text-slate-600 hover:text-pink-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          Semana siguiente →
        </button>
      </div>

      {horas.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
          No tienes actividades creadas todavía. Ve a{' '}
          <Link href="/admin/actividades" className="text-pink-600 hover:underline">Actividades</Link> para crear alguna primero.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs text-slate-400 font-medium w-20">Hora</th>
                {diasSemana.map((d, i) => (
                  <th key={i} className="p-3 text-left border-l border-slate-100">
                    <div className="text-xs text-slate-400 font-medium">{DIAS_LABEL[DIAS[i]]}</div>
                    <div className="text-sm text-slate-700">{formatoFecha(d).slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map(hora => (
                <tr key={hora} className="border-t border-slate-100">
                  <td className="p-3 text-sm text-slate-500 align-top">{hora}</td>
                  {diasSemana.map((d, i) => {
                    const fecha = formatoFecha(d)
                    const s = sesionEn(fecha, hora)
                    return (
                      <td key={i} className="p-2 border-l border-slate-100 align-top">
                        {s ? (
                          <div className={`rounded-lg p-2 text-xs ${s.tipo === 'fija' ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <div className="font-semibold text-slate-800">{s.actividad_nombre}</div>
                            <div className="text-slate-500 mt-0.5">{s.reservas_count || 0}/{s.cupo_maximo} reservas</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => abrirCelda(DIAS[i], fecha, hora)}
                            className="w-full h-full min-h-[48px] rounded-lg border border-dashed border-slate-200 text-slate-300 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50 transition text-xs flex items-center justify-center"
                          >
                            + Añadir
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {celdaSeleccionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-lg mb-1">Nueva sesión</h3>
            <p className="text-sm text-slate-500 mb-4">
              {DIAS_LABEL[celdaSeleccionada.dia]} {celdaSeleccionada.fecha} — {celdaSeleccionada.hora}
            </p>

            {actividadesDeEstaHora.length === 0 ? (
              <p className="text-sm text-slate-500 mb-4">No hay actividades definidas a esta hora.</p>
            ) : (
              <select
                value={actividadElegida}
                onChange={e => setActividadElegida(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
              >
                <option value="">Selecciona actividad...</option>
                {actividadesDeEstaHora.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setCeldaSeleccionada(null)}
                className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={crearSesionEnCelda}
                disabled={!actividadElegida || cargando}
                className="flex-1 bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700 disabled:bg-slate-300 transition"
              >
                {cargando ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}