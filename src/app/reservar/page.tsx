'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { ca } from 'date-fns/locale'

function ReservaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [sesion, setSesion] = useState<any>(null)
  const [alumnos, setAlumnos] = useState<any[]>([])
  const [participantes, setParticipantes] = useState<any[]>([])
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
    if (data) cargarParticipantes(data.id)
  }

  async function cargarParticipantes(sesionId: string) {
    const { data } = await supabase
      .from('vista_reservas')
      .select('*')
      .eq('sesion_id', sesionId)
      .neq('estado', 'cancelado')
      .order('fecha_reserva')
    setParticipantes(data || [])
  }

  async function cargarAlumnos() {
    const { data } = await supabase.from('alumnos').select('*').order('nombre')
    setAlumnos(data || [])
  }

  async function reservar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!sesion) return setError('Sessió no trobada')

    let alumnoId: string
    const { data: existente } = await supabase.from('alumnos').select('id').eq('nombre', nombre).single()

    if (existente) {
      alumnoId = existente.id
    } else {
      const { data: nuevo, error: err } = await supabase.from('alumnos').insert({ nombre, telefono }).select('id').single()
      if (err) return setError('Error en crear l\'alumne')
      alumnoId = nuevo!.id
    }

    if (sesion.plazas_libres <= 0) return setError('Ho sentim, no queden places disponibles.')

    const { error: errReserva } = await supabase.from('reservas').insert({
      sesion_id: sesion.id,
      alumno_id: alumnoId
    })

    if (errReserva) {
      if (errReserva.message.includes('unique')) return setError('Ja tens una reserva en aquesta sessió.')
      return setError('Error en reservar. Torna-ho a provar.')
    }

    setExito(true)
    cargarParticipantes(sesion.id)
  }

  const fechaBonita = sesion?.fecha ? format(parseISO(sesion.fecha), "d 'de' MMMM", { locale: ca }) : ''

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Reservar classe</h1>
          <p className="text-slate-500">Escaneja el codi o fes servir l'enllaç que t'ha enviat el teu entrenador.</p>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-emerald-700 mb-2">Reserva confirmada!</h2>
          <p className="text-slate-600 mb-4">
            {sesion?.actividad_nombre} — {sesion?.dia_semana} {fechaBonita} a les {sesion?.hora?.slice(0,5)}
          </p>
          <p className="text-sm text-slate-400 mb-6">T'esperem. No faltis!</p>

          {participantes.length > 0 && (
            <div className="text-left bg-slate-50 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Participants ({participantes.length})
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                {participantes.map((p) => (
                  <div key={p.id}>{p.alumno_nombre}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Reservar plaça</h1>
        
        {sesion ? (
          <div className="mb-4 p-4 bg-blue-50 rounded-xl">
            <div className="font-semibold text-blue-800">{sesion.actividad_nombre}</div>
            <div className="text-blue-600">{sesion.dia_semana} {fechaBonita} — {sesion.hora?.slice(0,5)}</div>
            <div className="text-sm text-blue-500 mt-1">
              {sesion.plazas_libres > 0 
                ? `Queden ${sesion.plazas_libres} places disponibles` 
                : '⚠️ No queden places'}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-slate-400">Carregant sessió...</div>
        )}

        {participantes.length > 0 && (
          <div className="mb-6 bg-slate-50 rounded-xl p-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">
              Participants ({participantes.length})
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              {participantes.map((p) => (
                <div key={p.id}>{p.alumno_nombre}</div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={reservar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">El teu nom</label>
            <input
              list="alumnos-list"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Maria Garcia"
              required
            />
            <datalist id="alumnos-list">
              {alumnos.map(a => <option key={a.id} value={a.nombre} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telèfon (opcional)</label>
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
            {sesion?.plazas_libres <= 0 ? 'Sense places disponibles' : 'Confirmar reserva'}
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
        <div className="text-slate-400">Carregant...</div>
      </div>
    }>
      <ReservaContent />
    </Suspense>
  )
}