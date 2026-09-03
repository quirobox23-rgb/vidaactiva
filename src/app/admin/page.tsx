'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ca } from 'date-fns/locale'
import { fechaLocal } from '@/lib/fecha'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalAlumnos: 0,
    sesionesHoy: 0,
    reservasHoy: 0,
    ingresosMes: 0,
    gastosMes: 0
  })
  const [proximas, setProximas] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const hoy = fechaLocal(new Date())
    const inicioMes = hoy.slice(0, 7) + '-01'

    const { count: alumnosCount } = await supabase.from('alumnos').select('*', { count: 'exact', head: true })

    const { data: sesionesHoyData } = await supabase.from('vista_sesiones').select('*').eq('fecha', hoy)

    const { count: reservasCount } = await supabase.from('reservas').select('*', { count: 'exact', head: true }).gte('fecha_reserva', hoy + 'T00:00:00')

    const { data: pagosData } = await supabase.from('pagos').select('monto').gte('fecha_pago', inicioMes).eq('pagado', true)
    const ingresos = pagosData?.reduce((sum, p) => sum + (Number(p.monto) || 0), 0) || 0

    const { data: gastosData } = await supabase.from('gastos').select('monto').gte('fecha', inicioMes)
    const gastos = gastosData?.reduce((sum, g) => sum + (Number(g.monto) || 0), 0) || 0

    const { data: proximasData } = await supabase
      .from('vista_sesiones')
      .select('*')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .limit(10)

    setStats({
      totalAlumnos: alumnosCount || 0,
      sesionesHoy: sesionesHoyData?.length || 0,
      reservasHoy: reservasCount || 0,
      ingresosMes: ingresos,
      gastosMes: gastos
    })
    setProximas(proximasData || [])
  }

  function generarEnlaceWhatsApp(token: string, actividad: string, fecha: string, hora: string) {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/reservar?token=${token}`
    const fechaBonita = format(parseISO(fecha), "d 'de' MMMM", { locale: ca })
    const mensaje = `Hola! 👋 Reserva la teva plaça per a *${actividad}* el *${fechaBonita}* a les *${hora}*. \n\n👉 ${url}`
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  }

  function generarEnlaceGeneral() {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/reservar`
    const mensaje = `Hola! 👋 Consulta i reserva la teva classe aquí: \n\n👉 ${url}`
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <a
          href={generarEnlaceGeneral()}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition font-medium"
        >
          📤 Enviar enlace general (todas las clases)
        </a>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-blue-600">{stats.totalAlumnos}</div>
          <div className="text-xs text-slate-500">Alumnos</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-emerald-600">{stats.sesionesHoy}</div>
          <div className="text-xs text-slate-500">Clases hoy</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-purple-600">{stats.reservasHoy}</div>
          <div className="text-xs text-slate-500">Reservas hoy</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-green-600">{stats.ingresosMes}€</div>
          <div className="text-xs text-slate-500">Ingresos mes</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-red-500">{stats.gastosMes}€</div>
          <div className="text-xs text-slate-500">Gastos mes</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Próximas sesiones</h2>
          <Link href="/admin/sesiones" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {proximas.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400">No hay sesiones próximas. Ve a Sesiones y genera la semana.</div>
          )}
          {proximas.map((s) => (
            <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
              <div>
                <div className="font-medium text-slate-800">
                  {s.actividad_nombre} — {s.dia_semana} {s.fecha} {s.hora?.slice(0,5)}
                </div>
                <div className="text-sm text-slate-500">
                  {s.reservas_count || 0} reservas / {s.plazas_libres} plazas libres
                  {s.tipo === 'demanda' && <span className="ml-2 text-amber-600 text-xs bg-amber-100 px-2 py-0.5 rounded-full">Demanda</span>}
                </div>
              </div>
              <a
                href={generarEnlaceWhatsApp(s.enlace_token, s.actividad_nombre, s.fecha, s.hora?.slice(0,5))}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-600 transition"
              >
                📤 WhatsApp
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}