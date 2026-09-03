import Link from 'next/link'
import Image from 'next/image'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logopng.png" alt="Vida Activa" width={40} height={40} className="rounded-lg" />
            <span className="font-bold text-xl text-white">Vida Activa</span>
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/admin" className="text-slate-300 hover:text-pink-400 transition">Dashboard</Link>
            <Link href="/admin/actividades" className="text-slate-300 hover:text-pink-400 transition">Actividades</Link>
            <Link href="/admin/sesiones" className="text-slate-300 hover:text-pink-400 transition">Sesiones</Link>
            <Link href="/admin/calendario" className="text-slate-300 hover:text-pink-400 transition">Calendario</Link>
            <Link href="/admin/alumnos" className="text-slate-300 hover:text-pink-400 transition">Alumnos</Link>
            <Link href="/admin/finanzas" className="text-slate-300 hover:text-pink-400 transition">Finanzas</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-4 pt-6">{children}</main>
    </div>
  )
}