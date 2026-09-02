'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ReservaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [sesion, setSesion] = useState<any>(null)
  const [alumnos, setAlumnos] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) cargarSesion()
    cargarAlumnos()
  }, [token])

  async function cargarSesion() {
    const { data } = await supabase
      .from('vista_sesiones')
      .select('*')
      .eq('enlace_token', token)
      .single()
    setSesion(data)
  }

  async function cargarAlumnos() {
    const { data } = await supabase.from('alumnos').select('*').order('nombre')
    setAlumnos(data || [])
  }

  async function reservar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!sesion) return setError('Sesión no encontrada')

    let alumnoId: string
    const { data: existente } = await supabase.from('alumnos').select('id').eq('nombre', nombre).single()

    if (existente) {
      alumnoId = existente.id
    } else {
      const { data: nuevo, error: err } = await supabase.from('alumnos').insert({ nombre, telefono }).select('id').single()
      if (err) return setError('Error al crear alumno')
      alumnoId = nuevo!.id
    }

    if (sesion.plazas_libres <= 0) return setError('Lo siento, no quedan plazas disponibles.')

    const { error: errReserva } = await supabase.from('reservas').insert({
      sesion_id: sesion.id,
      alumno_id: alumnoId
    })

    if (errReserva) {
      if (errReserva.message.includes('unique')) return setError('Ya tienes una reserva en esta sesión.')
      return setError('Error al reservar. Inténtalo de nuevo.')
    }

    setExito(true)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Reservar clase</h1>
          <p className="text-slate-500">Escanea el código o usa el enlace que te envió tu entrenador.</p>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-emerald-700 mb-2">¡Reserva confirmada!</h2>
          <p className="text-slate-600 mb-4">
            {sesion?.actividad_nombre} — {sesion?.dia_semana} {sesion?.fecha} a las {sesion?.hora?.slice(0,5)}
          </p>
          <p className="text-sm text-slate-400">Te esperamos. ¡No faltes!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Reservar plaza</h1>
        
        {sesion ? (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl">
            <div className="font-semibold text-blue-800">{sesion.actividad_nombre}</div>
            <div className="text-blue-600">{sesion.dia_semana} {sesion.fecha} — {sesion.hora?.slice(0,5)}</div>
            <div className="text-sm text-blue-500 mt-1">
              {sesion.plazas_libres > 0 
                ? `Quedan ${sesion.plazas_libres} plazas disponibles` 
                : '⚠️ No quedan plazas'}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-slate-400">Cargando sesión...</div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={reservar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tu nombre</label>
            <input
              list="alumnos-list"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: María García"
              required
            />
            <datalist id="alumnos-list">
              {alumnos.map(a => <option key={a.id} value={a.nombre} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (opcional)</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="612 345 678"
            />
          </div>

          <button
            type="submit"
            disabled={!sesion || sesion.plazas_libres <= 0}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {sesion?.plazas_libres <= 0 ? 'Sin plazas disponibles' : 'Confirmar reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ReservarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Cargando...</div>
      </div>
    }>
      <ReservaContent />
    </Suspense>
  )
}