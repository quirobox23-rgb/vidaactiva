'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    cargarAlumnos()
  }, [])

  async function cargarAlumnos() {
    setError('')
    const { data, error: err } = await supabase.from('alumnos').select('*').order('nombre')
    if (err) {
      setError('Error: ' + err.message)
      return
    }
    setAlumnos(data || [])
  }

  async function agregarAlumno(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: err } = await supabase.from('alumnos').insert({ nombre, telefono })
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
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold">Lista de alumnos ({alumnos.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {alumnos.length === 0 && <div className="px-6 py-6 text-center text-slate-400">No hay alumnos registrados.</div>}
          {alumnos.map(a => (
            <div key={a.id} className="px-6 py-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{a.nombre}</div>
                {a.telefono && <div className="text-sm text-slate-500">{a.telefono}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}