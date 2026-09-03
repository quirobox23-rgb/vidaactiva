'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { ca } from 'date-fns/locale'
import Image from 'next/image'
import Link from 'next/link'
import { fechaLocal } from '@/lib/fecha'

function horasHastaSesion(sesion: any) {
  if (!sesion?.fecha || !sesion?.hora) return null
  const horaStr = sesion.hora.length === 5 ? sesion.hora + ':00' : sesion.hora
  const fechaHora = new Date(`${sesion.fecha}T${horaStr}`)
  return (fechaHora.getTime() - Date.now()) / (1000 * 60 * 60)
}

function ListaClases() {
  const [sesiones, setSesiones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarClases()
  }, [])

  async function cargarClases() {
    const hoy = fechaLocal(new Date())
    const { data } = await supabase
      .from('vista_sesiones')
      .select('*')
      .gte('fecha', hoy)
      .neq('estado', 'cancelado')
      .order('fecha')
      .order('hora')

    const lista = data || []

    const guardadas: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      for (const s of lista) {
        const raw = localStorage.getItem(`reserva_${s.enlace_token}`)
        if (raw) {
          try {
            const { reservaId } = JSON.parse(raw)
            if (reservaId) guardadas[s.enlace_token] = reservaId
          } catch {}
        }
      }
    }

    const ids = Object.values(guardadas)
    let activasIds = new Set<string>()
    if (ids.length > 0) {
      const { data: reservasReales } = await supabase
        .from('reservas')
        .select('id, estado')
        .in('id', ids)
      activasIds = new Set(
        (reservasReales || []).filter(r => r.estado !== 'cancelado').map(r => r.id)
      )
    }

    const conEstado = lista.map((s: any) => {
      const rid = guardadas[s.enlace_token]
      const yaReservada = !!rid && activasIds.has(rid)
      if (rid && !yaReservada && typeof window !== 'undefined') {
        localStorage.removeItem(`reserva_${s.enlace_token}`)
      }
      return { ...s, yaReservada }
    })

    setSesiones(conEstado)
    setCargando(false)
  }

  const fechaBonita = (fecha: string) => format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: ca })

  return (
    <div className="min-h-screen p-6 bg-slate-100">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <Image src="/logopng.png" alt="Vida Activa" width={64} height={64} className="mx-auto mb-3 rounded-lg" />
          <h1 className="text-2xl font-bold text-slate-800">Classes disponibles</h1>
          <p className="text-slate-500 text-sm mt-1">Tria la classe on vols reservar</p>
        </div>

        {cargando ? (
          <div className="text-center text-slate-400">Carregant...</div>
        ) : sesiones.length === 0 ? (
          <div className="text-center text-slate-400 bg-white rounded-2xl p-6">No hi ha classes properes disponibles.</div>
        ) : (
          <div className="space-y-3">
            {sesiones.map((s) => (
              <Link
                key={s.id}
                href={`/reservar?token=${s.enlace_token}`}
                className={`block rounded-2xl shadow-lg p-5 transition ${
                  s.yaReservada
                    ? 'bg-slate-100 opacity-70'
                    : 'bg-white hover:shadow-xl'
                }`}
              >
                <div className="font-semibold text-slate-800">{s.actividad_nombre}</div>
                <div className="text-slate-500 text-sm capitalize">{fechaBonita(s.fecha)} — {s.hora?.slice(0,5)}</div>
                {s.yaReservada ? (
                  <div className="text-sm mt-1 font-medium text-slate-500">✓ Ja reservada</div>
                ) : (
                  <div className={`text-sm mt-1 font-medium ${s.plazas_libres > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.plazas_libres > 0 ? `${s.plazas_libres} places lliures` : 'Completa'}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReservaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [sesion, setSesion] = useState<any>(null)
  const [alumnos, setAlumnos] = useState<any[]>([])
  const [participantes, setParticipantes] = useState<any[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [exito, setExito] = useState(false)
  const [reservaId, setReservaId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [anulando, setAnulando] = useState(false)

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
    if (data) {
      cargarParticipantes(data.id)
      if (typeof window !== 'undefined') {
        const guardado = localStorage.getItem(`reserva_${token}`)
        if (guardado) {
          const { nombre: n, reservaId: rid } = JSON.parse(guardado)
          const { data: reservaActual } = await supabase
            .from('reservas')
            .select('estado')
            .eq('id', rid)
            .maybeSingle()

          if (reservaActual && reservaActual.estado !== 'cancelado') {
            setNombre(n)
            setReservaId(rid)
            setExito(true)
          } else {
            localStorage.removeItem(`reserva_${token}`)
          }
        }
      }
    }
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

    const { data: reservaExistente } = await supabase
      .from('reservas')
      .select('id, estado')
      .eq('sesion_id', sesion.id)
      .eq('alumno_id', alumnoId)
      .maybeSingle()

    let reservaFinalId: string

    if (reservaExistente) {
      if (reservaExistente.estado !== 'cancelado') {
        return setError('Ja tens una reserva en aquesta sessió.')
      }
      const { data: reactivada, error: errReactivar } = await supabase
        .from('reservas')
        .update({ estado: 'reservado' })
        .eq('id', reservaExistente.id)
        .select('id')
        .single()
      if (errReactivar) return setError('Error en reservar. Torna-ho a provar.')
      reservaFinalId = reactivada.id
    } else {
      const { data: novaReserva, error: errReserva } = await supabase
        .from('reservas')
        .insert({ sesion_id: sesion.id, alumno_id: alumnoId })
        .select('id')
        .single()

      if (errReserva) {
        if (errReserva.message.includes('unique')) return setError('Ja tens una reserva en aquesta sessió.')
        return setError('Error en reservar. Torna-ho a provar.')
      }
      reservaFinalId = novaReserva.id
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`reserva_${token}`, JSON.stringify({ nombre, reservaId: reservaFinalId }))
    }
    setReservaId(reservaFinalId)
    setExito(true)
    cargarParticipantes(sesion.id)
  }

  async function anularReserva() {
    if (!reservaId) return
    if (!confirm('Segur que vols anul·lar la teva reserva?')) return

    setAnulando(true)
    const { error: errAnular } = await supabase
      .from('reservas')
      .update({ estado: 'cancelado' })
      .eq('id', reservaId)

    setAnulando(false)

    if (errAnular) {
      setError('Error en anul·lar la reserva.')
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`reserva_${token}`)
    }
    setExito(false)
    setReservaId(null)
    if (sesion) cargarParticipantes(sesion.id)
  }

  const fechaBonita = sesion?.fecha ? format(parseISO(sesion.fecha), "d 'de' MMMM", { locale: ca }) : ''
  const horasRestantes = horasHastaSesion(sesion)
  const potAnularse = horasRestantes === null || horasRestantes > 1

  if (!token) {
    return <ListaClases />
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <Image src="/logopng.png" alt="Vida Activa" width={56} height={56} className="mx-auto mb-3 rounded-lg" />
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-emerald-700 mb-2">Reserva confirmada!</h2>
          <p className="text-slate-600 mb-4">
            {sesion?.actividad_nombre} — {sesion?.dia_semana} {fechaBonita} a les {sesion?.hora?.slice(0,5)}
          </p>
          <p className="text-sm text-slate-400 mb-6">T&apos;esperem. No faltis!</p>

          {participantes.length > 0 && (
            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
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

          <div className="space-y-2">
            {potAnularse ? (
              <button
                onClick={anularReserva}
                disabled={anulando}
                className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition disabled:opacity-50"
              >
                {anulando ? 'Anul·lant...' : 'Anul·lar reserva'}
              </button>
            ) : (
              <p className="text-xs text-slate-400">
                Ja no es pot anul·lar (falta menys d&apos;una hora per a la classe)
              </p>
            )}

            <Link
              href="/reservar"
              className="block w-full bg-slate-100 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition"
            >
              Veure altres classes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <Image src="/logopng.png" alt="Vida Activa" width={56} height={56} className="mb-3 rounded-lg" />
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

        <Link href="/reservar" className="block text-center text-sm text-slate-400 mt-4 hover:underline">
          Veure totes les classes disponibles
        </Link>
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