'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { edad, Ficha, FICHA_VACIA, guardarFicha } from '@/lib/fichas'

type Alumno = { id: string; nombre: string; telefono?: string | null }

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none'
const etiqueta = 'block text-xs font-medium text-slate-500 mb-1'

// Formulario para entrar con usuario y contraseña de Supabase. Hace falta para
// ver las fichas, que llevan datos delicados (DNI, salud).
export function EntrarFichas({ onEntrar }: { onEntrar: () => void }) {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setEntrando(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setEntrando(false)
    if (err) return setError('No se ha podido entrar: revisa el correo y la contraseña.')
    setClave('')
    onEntrar()
  }

  return (
    <form onSubmit={entrar} className="flex flex-wrap items-end gap-3">
      <div>
        <label className={etiqueta}>Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="username" required />
      </div>
      <div>
        <label className={etiqueta}>Contraseña</label>
        <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} className={input} autoComplete="current-password" required />
      </div>
      <button type="submit" disabled={entrando} className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:bg-slate-300">
        {entrando ? 'Entrando...' : 'Entrar'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  )
}

// Ventana con la ficha completa de un alumno.
export function FichaAlumno({
  alumno,
  ficha,
  onCerrar,
  onGuardada,
}: {
  alumno: Alumno
  ficha: Ficha | undefined
  onCerrar: () => void
  onGuardada: (f: Ficha) => void
}) {
  const [f, setF] = useState<Ficha>(ficha || { alumno_id: alumno.id, ...FICHA_VACIA })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const campo = (k: keyof Ficha) => ({
    value: (f[k] as string | null) || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    const err = await guardarFicha(f)
    setGuardando(false)
    if (err) return setError('No se ha podido guardar: ' + err.message)
    onGuardada(f)
  }

  const anos = edad(f.fecha_nacimiento)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={onCerrar}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Ficha de {alumno.nombre}</h2>
            <p className="text-sm text-slate-500">
              {alumno.telefono || 'Sin teléfono'}
              {anos !== null && ` · ${anos} años`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-600">Datos personales</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={etiqueta}>Apellidos</label>
                <input {...campo('apellidos')} className={input} />
              </div>
              <div>
                <label className={etiqueta}>DNI / NIE</label>
                <input {...campo('dni')} className={input} />
              </div>
              <div>
                <label className={etiqueta}>Fecha de nacimiento</label>
                <input type="date" {...campo('fecha_nacimiento')} className={input} />
              </div>
              <div>
                <label className={etiqueta}>Correo electrónico</label>
                <input type="email" {...campo('email')} className={input} />
              </div>
              <div className="sm:col-span-2">
                <label className={etiqueta}>Dirección</label>
                <input {...campo('direccion')} className={input} />
              </div>
              <div>
                <label className={etiqueta}>Fecha de alta</label>
                <input type="date" {...campo('fecha_alta')} className={input} />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">El nombre y el teléfono se cambian con «Editar» en la lista.</p>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-600">Contacto de emergencia</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={etiqueta}>Nombre</label>
                <input {...campo('contacto_emergencia_nombre')} className={input} placeholder="Ej: Joan (marido)" />
              </div>
              <div>
                <label className={etiqueta}>Teléfono</label>
                <input type="tel" {...campo('contacto_emergencia_telefono')} className={input} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-600">Salud</h3>
            <div className="space-y-3">
              <div>
                <label className={etiqueta}>Lesiones</label>
                <textarea {...campo('lesiones')} rows={3} className={input} placeholder="Ej: rodilla derecha operada (2024), evitar saltos" />
              </div>
              <div>
                <label className={etiqueta}>Enfermedades, medicación, alergias</label>
                <textarea {...campo('salud')} rows={3} className={input} />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={f.consentimiento_datos}
                  onChange={(e) => setF({ ...f, consentimiento_datos: e.target.checked })}
                  className="mt-0.5"
                />
                Ha dado su consentimiento para guardar estos datos (también los de salud).
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-600">Observaciones</h3>
            <textarea {...campo('observaciones')} rows={3} className={input} placeholder="Objetivos, preferencias, lo que quieras recordar…" />
          </section>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onCerrar} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:bg-slate-300">
            {guardando ? 'Guardando...' : 'Guardar ficha'}
          </button>
        </div>
      </form>
    </div>
  )
}
