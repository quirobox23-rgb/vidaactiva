'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { ca } from 'date-fns/locale'
import Image from 'next/image'
import Link from 'next/link'
import { fechaLocal } from '@/lib/fecha'
import {
  Identidad,
  anularReserva as anularReservaDb,
  guardarIdentidad,
  horasHastaSesion,
  identidadGuardada,
  identificarAlumno,
  reservarSesion,
  sePuedeAnular,
} from '@/lib/reservas'

type Sesion = {
  id: string
  fecha: string
  hora: string | null
  actividad_nombre: string
  enlace_token: string
  plazas_libres: number
  cupo_maximo?: number | null
}

type Apuntado = { reservaId: string; alumnoId: string; nombre: string }

const COLORES = ['bg-pink-500', 'bg-sky-500', 'bg-amber-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500']

function colorDe(nombre: string) {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

function iniciales(nombre: string) {
  const p = nombre.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}

// Lista de clases con aspecto de encuesta de WhatsApp: cada clase es una opción,
// se toca para apuntarse o desapuntarse y se ve quién va.
function ListaClases() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [apuntados, setApuntados] = useState<Record<string, Apuntado[]>>({})
  const [cargando, setCargando] = useState(true)
  const [yo, setYo] = useState<Identidad | null>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [identificando, setIdentificando] = useState(false)

  useEffect(() => {
    cargarClases().then(() => setYo(identidadGuardada()))
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

    // Las clases de hoy que ya han empezado no se enseñan.
    const lista = ((data || []) as Sesion[]).filter((s) => {
      const h = horasHastaSesion(s)
      return h === null || h > 0
    })

    const porSesion: Record<string, Apuntado[]> = {}
    if (lista.length > 0) {
      const { data: res } = await supabase
        .from('reservas')
        .select('id, sesion_id, alumno_id, estado, fecha_reserva, alumnos(nombre)')
        .in('sesion_id', lista.map((s) => s.id))
        .neq('estado', 'cancelado')
        .order('fecha_reserva')
      type Fila = { id: string; sesion_id: string; alumno_id: string; alumnos?: { nombre: string } | { nombre: string }[] | null }
      for (const r of (res || []) as unknown as Fila[]) {
        const al = Array.isArray(r.alumnos) ? r.alumnos[0] : r.alumnos
        ;(porSesion[r.sesion_id] ||= []).push({ reservaId: r.id, alumnoId: r.alumno_id, nombre: al?.nombre || '—' })
      }
    }

    setSesiones(lista)
    setApuntados(porSesion)
    setCargando(false)
  }

  async function identificarme(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIdentificando(true)
    const r = await identificarAlumno(nombre, telefono)
    setIdentificando(false)
    if ('error' in r) return setError(r.error)
    guardarIdentidad(r)
    setYo(r)
    setAviso(`Hola, ${r.nombre.split(' ')[0]}! Ara toca les classes on vols anar.`)
  }

  function canviarPersona() {
    guardarIdentidad(null)
    setYo(null)
    setNombre('')
    setTelefono('')
    setAviso('')
  }

  async function tocar(s: Sesion) {
    setError('')
    setAviso('')
    if (!yo) {
      setError('Primer escriu qui ets (a dalt) i després tria les classes.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const meva = (apuntados[s.id] || []).find((a) => a.alumnoId === yo.id)
    setOcupado(s.id)
    if (meva) {
      if (!sePuedeAnular(s)) {
        setOcupado(null)
        return setError("Ja no et pots desapuntar: falta menys d'una hora per a la classe.")
      }
      if (!confirm(`Et desapuntes de ${s.actividad_nombre} (${diaCurt(s.fecha)} ${s.hora?.slice(0, 5) || ''})?`)) {
        setOcupado(null)
        return
      }
      const r = await anularReservaDb(meva.reservaId)
      if (r.error) setError(r.error)
      else {
        localStorage.removeItem(`reserva_${s.enlace_token}`)
        setAviso(`Desapuntat/da de ${s.actividad_nombre}.`)
      }
    } else {
      const r = await reservarSesion(s, yo.id)
      if ('error' in r) setError(r.error)
      else {
        localStorage.setItem(`reserva_${s.enlace_token}`, JSON.stringify({ nombre: yo.nombre, reservaId: r.id }))
        setAviso(`✅ Apuntat/da a ${s.actividad_nombre}, ${diaCurt(s.fecha)} a les ${s.hora?.slice(0, 5) || ''}.`)
      }
    }
    await cargarClases()
    setOcupado(null)
  }

  const diaCurt = (fecha: string) => format(parseISO(fecha), "EEEE d", { locale: ca })
  const diaLlarg = (fecha: string) => format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: ca })

  // Agrupadas por día, como secciones de la encuesta.
  const dias: { fecha: string; sesiones: Sesion[] }[] = []
  for (const s of sesiones) {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === s.fecha) ultimo.sesiones.push(s)
    else dias.push({ fecha: s.fecha, sesiones: [s] })
  }

  return (
    <div className="min-h-screen bg-[#efeae2] px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Image src="/logopng.png" alt="Vida Activa" width={48} height={48} className="rounded-full shadow" />
          <div>
            <div className="font-bold text-slate-800 leading-tight">Vida Activa</div>
            <div className="text-xs text-slate-500">entrena · supera&apos;t · viu actiu</div>
          </div>
        </div>

        {/* Quién reserva */}
        <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm p-4">
          {yo ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full text-white text-sm font-semibold flex items-center justify-center ${colorDe(yo.nombre)}`}>
                  {iniciales(yo.nombre)}
                </span>
                <div>
                  <div className="text-xs text-slate-500">Reserves com a</div>
                  <div className="font-semibold text-slate-800">{yo.nombre}</div>
                </div>
              </div>
              <button onClick={canviarPersona} className="text-sm text-[#008069] font-medium hover:underline">
                No sóc jo
              </button>
            </div>
          ) : (
            <form onSubmit={identificarme} className="space-y-3">
              <div className="font-semibold text-slate-800">👋 Primer, digues qui ets</div>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none"
                placeholder="Nom i cognom"
                autoComplete="name"
                required
              />
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none"
                placeholder="Telèfon (612 345 678)"
                autoComplete="tel"
              />
              <p className="text-xs text-slate-500">Cal el telèfon o bé el nom amb cognom. Només ho has de fer una vegada.</p>
              <button
                type="submit"
                disabled={identificando}
                className="w-full bg-[#25D366] text-white py-2.5 rounded-xl font-semibold hover:bg-[#1ebe5a] disabled:opacity-60 transition"
              >
                {identificando ? 'Un moment...' : 'Continuar'}
              </button>
            </form>
          )}
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm shadow-sm">{error}</div>}
        {aviso && <div className="p-3 bg-[#d9fdd3] text-slate-700 rounded-xl text-sm shadow-sm">{aviso}</div>}

        {/* La "encuesta" */}
        <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm p-4">
          <div className="flex items-start gap-2 mb-1">
            <span className="text-xl">📊</span>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">On vols venir?</h1>
              <p className="text-xs text-slate-500 mt-0.5">Toca una classe per apuntar-t&apos;hi. Pots triar-ne més d&apos;una.</p>
            </div>
          </div>

          {cargando ? (
            <div className="text-center text-slate-400 py-6">Carregant...</div>
          ) : dias.length === 0 ? (
            <div className="text-center text-slate-400 py-6">No hi ha classes properes disponibles.</div>
          ) : (
            dias.map((d) => (
              <div key={d.fecha} className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#008069] mb-1 capitalize">{diaLlarg(d.fecha)}</div>
                <div className="divide-y divide-slate-100">
                  {d.sesiones.map((s) => {
                    const gent = apuntados[s.id] || []
                    const meva = !!yo && gent.some((a) => a.alumnoId === yo.id)
                    const cupo = s.cupo_maximo || gent.length + Math.max(s.plazas_libres, 0) || 1
                    const plena = s.plazas_libres <= 0 && !meva
                    const pct = Math.min(100, Math.round((gent.length / cupo) * 100))
                    return (
                      <div key={s.id} className="py-3">
                        <button
                          onClick={() => tocar(s)}
                          disabled={ocupado === s.id || plena}
                          className="w-full flex items-start gap-3 text-left disabled:cursor-not-allowed"
                          aria-pressed={meva}
                        >
                          <span
                            className={`mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition ${
                              meva ? 'bg-[#25D366] border-[#25D366]' : plena ? 'border-slate-200 bg-slate-100' : 'border-slate-400'
                            }`}
                          >
                            {ocupado === s.id ? (
                              <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                            ) : meva ? (
                              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                            ) : null}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={`font-medium ${plena ? 'text-slate-400' : 'text-slate-800'}`}>
                                {s.hora?.slice(0, 5)} · {s.actividad_nombre}
                              </span>
                              <span className="text-sm text-slate-500 shrink-0">
                                {plena ? 'Completa' : `${gent.length}/${cupo}`}
                              </span>
                            </span>
                            <span className="block h-1.5 mt-2 rounded-full bg-slate-200 overflow-hidden">
                              <span
                                className={`block h-full rounded-full transition-all ${plena ? 'bg-red-300' : 'bg-[#25D366]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                          </span>
                        </button>

                        <div className="pl-9 mt-2 flex items-center justify-between gap-2">
                          {gent.length === 0 ? (
                            <span className="text-xs text-slate-400">Encara no hi ha ningú. Sigues la primera persona!</span>
                          ) : (
                            <button
                              onClick={() => setAbierta(abierta === s.id ? null : s.id)}
                              className="flex items-center gap-2"
                              aria-expanded={abierta === s.id}
                            >
                              <span className="flex -space-x-2">
                                {gent.slice(0, 5).map((a) => (
                                  <span
                                    key={a.reservaId}
                                    title={a.nombre}
                                    className={`w-6 h-6 rounded-full ring-2 ring-white text-[10px] text-white font-semibold flex items-center justify-center ${colorDe(a.nombre)}`}
                                  >
                                    {iniciales(a.nombre)}
                                  </span>
                                ))}
                              </span>
                              <span className="text-xs text-[#008069] font-medium">
                                {abierta === s.id ? 'Amagar' : gent.length > 5 ? `+${gent.length - 5} · Qui hi va` : 'Qui hi va'}
                              </span>
                            </button>
                          )}
                          {!plena && s.plazas_libres > 0 && s.plazas_libres <= 3 && (
                            <span className="text-xs font-medium text-amber-600">Només {s.plazas_libres} {s.plazas_libres === 1 ? 'plaça' : 'places'}!</span>
                          )}
                        </div>

                        {abierta === s.id && gent.length > 0 && (
                          <ul className="pl-9 mt-2 space-y-1">
                            {gent.map((a) => (
                              <li key={a.reservaId} className="flex items-center gap-2 text-sm text-slate-700">
                                <span className={`w-5 h-5 rounded-full text-[9px] text-white font-semibold flex items-center justify-center ${colorDe(a.nombre)}`}>
                                  {iniciales(a.nombre)}
                                </span>
                                {a.nombre}
                                {yo && a.alumnoId === yo.id && <span className="text-xs text-slate-400">(tu)</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-center text-slate-500 px-4">
          ✓ verd = hi estàs apuntat/da. Et pots desapuntar fins a 1 hora abans de la classe.
        </p>
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
    const yo = identidadGuardada()
    if (yo) setNombre((n) => n || yo.nombre)
    setAlumnos(data || [])
  }

  async function reservar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!sesion) return setError('Sessió no trobada')

    const yo = await identificarAlumno(nombre, telefono)
    if ('error' in yo) return setError(yo.error)
    guardarIdentidad(yo)

    const r = await reservarSesion(sesion, yo.id)
    if ('error' in r) return setError(r.error)

    if (typeof window !== 'undefined') {
      localStorage.setItem(`reserva_${token}`, JSON.stringify({ nombre: yo.nombre, reservaId: r.id }))
    }
    setReservaId(r.id)
    setExito(true)
    cargarParticipantes(sesion.id)
  }

  async function anularReserva() {
    if (!reservaId) return
    if (!confirm('Segur que vols anul·lar la teva reserva?')) return

    setAnulando(true)
    const r = await anularReservaDb(reservaId)
    setAnulando(false)
    if (r.error) return setError(r.error)

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`reserva_${token}`)
    }
    setExito(false)
    setReservaId(null)
    if (sesion) cargarParticipantes(sesion.id)
  }

  const fechaBonita = sesion?.fecha ? format(parseISO(sesion.fecha), "d 'de' MMMM", { locale: ca }) : ''
  const potAnularse = sePuedeAnular(sesion)

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
              placeholder="Nom i cognom. Ex: Maria Garcia"
              required
            />
            <datalist id="alumnos-list">
              {alumnos.map(a => <option key={a.id} value={a.nombre} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telèfon</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="612 345 678"
            />
            <p className="text-xs text-slate-500 mt-1">
              Cal posar el telèfon o bé el nom amb cognom.
            </p>
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