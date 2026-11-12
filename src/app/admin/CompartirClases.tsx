'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fechaLocal } from '@/lib/fecha'
import { ClaseLista, enlaceWhatsapp, mensajeListaClases } from '@/lib/whatsapp'

// Tarjeta para enviar la lista de clases al grupo de WhatsApp.
export default function CompartirClases() {
  const [dias, setDias] = useState(7)
  const [clases, setClases] = useState<ClaseLista[]>([])
  const [copiado, setCopiado] = useState(false)
  const [enlace, setEnlace] = useState('')

  useEffect(() => {
    let vivo = true
    const hoy = new Date()
    const fin = new Date(hoy)
    fin.setDate(hoy.getDate() + dias)
    supabase
      .from('vista_sesiones')
      .select('fecha, hora, actividad_nombre, plazas_libres, estado')
      .gte('fecha', fechaLocal(hoy))
      .lte('fecha', fechaLocal(fin))
      .neq('estado', 'cancelado')
      .order('fecha')
      .order('hora')
      .then(({ data }) => {
        if (!vivo) return
        setEnlace(window.location.origin + '/reservar')
        setClases(
          (data || []).map((s) => ({
            fecha: s.fecha,
            hora: s.hora,
            actividad: s.actividad_nombre,
            plazasLibres: s.plazas_libres,
          }))
        )
      })
    return () => {
      vivo = false
    }
  }, [dias])

  const texto = mensajeListaClases(clases, enlace)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-lg">📲 Enviar la lista de clases por WhatsApp</h2>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white"
          aria-label="Días a incluir"
        >
          <option value={7}>Próximos 7 días</option>
          <option value={14}>Próximos 14 días</option>
        </select>
      </div>
      <p className="text-sm text-slate-500 mb-3">
        Las alumnas abren el enlace y se apuntan tocando cada clase, como en una encuesta. Así se ve el mensaje:
      </p>
      <div className="bg-[#efeae2] rounded-xl p-3 mb-4">
        <pre className="bg-[#d9fdd3] rounded-lg rounded-tr-sm p-3 text-sm text-slate-800 whitespace-pre-wrap font-sans max-h-72 overflow-auto shadow-sm">
          {clases.length === 0 ? 'No hay clases en estos días. Genera primero las sesiones de la semana.' : texto}
        </pre>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={enlaceWhatsapp(null, texto)}
          target="_blank"
          rel="noopener noreferrer"
          className={`bg-[#25D366] text-white px-5 py-2 rounded-lg font-medium hover:bg-[#1ebe5a] transition ${clases.length === 0 ? 'pointer-events-none opacity-50' : ''}`}
        >
          Abrir WhatsApp
        </a>
        <button
          onClick={copiar}
          disabled={clases.length === 0}
          className="bg-slate-100 text-slate-700 px-5 py-2 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 transition"
        >
          {copiado ? '✓ Copiado' : 'Copiar texto'}
        </button>
      </div>
    </div>
  )
}
