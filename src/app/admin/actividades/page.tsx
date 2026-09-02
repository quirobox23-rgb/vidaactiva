'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ActividadesPage() {
  const [actividades, setActividades] = useState<any[]>([])
  const [editando, setEditando] = useState<any>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState('')
  const [diaSemana, setDiaSemana] = useState('lunes')
  const [hora, setHora] = useState('18:00')
  const [tipo, setTipo] = useState('fija')
  const [cupo, setCupo] = useState(15)
  const [duracion, setDuracion] = useState(60)

  useEffect(() => {
    cargarActividades()
  }, [])

  async function cargarActividades() {
    setError('')
    const { data, error: err } = await supabase.from('actividades').select('*').order('dia_semana')
    if (err) {
      setError('Error: ' + err.message)
      return
    }
    setActividades(data || [])
  }

  function resetForm() {
    setNombre('')
    setDiaSemana('lunes')
    setHora('18:00')
    setTipo('fija')
    setCupo(15)
    setDuracion(60)
    setEditando(null)
  }

  function editar(act: any) {
    setEditando(act)
    setNombre(act.nombre)
    setDiaSemana(act.dia_semana)
    setHora(act.hora?.slice(0,5) || '18:00')
    setTipo(act.tipo)
    setCupo(act.cupo_maximo)
    setDuracion(60)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    const datos = {
      nombre,
      dia_semana: diaSemana,
      hora: hora + ':00',
      tipo,
      cupo_maximo: Number(cupo),
      activa: true
    }

    if (editando) {
      const { error: err } = await supabase.from('actividades').update(datos).eq('id', editando.id)
      if (err) {
        setError('Error al actualizar: ' + err.message)
        return
      }
      setMensaje('✅ Actividad actualizada.')
    } else {
      const { error: err } = await supabase.from('actividades').insert(datos)
      if (err) {
        setError('Error al crear: ' + err.message)
        return
      }
      setMensaje('✅ Actividad creada.')
    }

    resetForm()
    cargarActividades()
    setTimeout(() => setMensaje(''), 3000)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Seguro que quieres eliminar esta actividad?')) return
    await supabase.from('actividades').update({ activa: false }).eq('id', id)
    cargarActividades()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-slate-500 hover:text-pink-600 text-sm">← Volver al Dashboard</Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-800">Actividades</h1>

      {mensaje && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{mensaje}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

      {/* Formulario crear/editar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">{editando ? '✏️ Editar actividad' : '➕ Nueva actividad'}</h2>
        <form onSubmit={guardar} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Adultos" required />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Día</label>
            <select value={diaSemana} onChange={e => setDiaSemana(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
              <option value="lunes">Lunes</option>
              <option value="martes">Martes</option>
              <option value="miercoles">Miércoles</option>
              <option value="jueves">Jueves</option>
              <option value="viernes">Viernes</option>
              <option value="sabado">Sábado</option>
              <option value="domingo">Domingo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
              <option value="fija">Fija (semanal)</option>
              <option value="demanda">Bajo demanda</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Capacidad</label>
            <input type="number" value={cupo} onChange={e => setCupo(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" min={1} required />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Duración (min)</label>
            <input type="number" value={duracion} onChange={e => setDuracion(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" min={15} step={15} />
          </div>
          <div className="col-span-2 flex gap-2 items-end">
            <button type="submit" className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 font-medium">
              {editando ? 'Guardar cambios' : 'Crear actividad'}
            </button>
            {editando && (
              <button type="button" onClick={resetForm} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 font-medium">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 font-semibold">Tus actividades</div>
        <div className="divide-y divide-slate-100">
          {actividades.length === 0 && <div className="px-6 py-6 text-center text-slate-400">No hay actividades.</div>}
          {actividades.map(a => (
            <div key={a.id} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.tipo === 'fija' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.tipo}
                </span>
                <div>
                  <div className="font-medium">{a.nombre}</div>
                  <div className="text-sm text-slate-500">{a.dia_semana} {a.hora?.slice(0,5)} · {a.cupo_maximo} plazas</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editar(a)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                <button onClick={() => eliminar(a.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}