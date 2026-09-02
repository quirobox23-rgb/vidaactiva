import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-white/5 backdrop-blur-sm p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-white/10">
        
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image 
            src="/logopng.png" 
            alt="Vida Activa" 
            width={200} 
            height={200} 
            className="rounded-2xl"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Vida Activa</h1>
        <p className="text-pink-400 mb-8 font-medium tracking-wide">entrena · supera't · viu actiu</p>
        
        <div className="flex gap-4 flex-col w-full">
          <Link 
            href="/admin" 
            className="bg-pink-600 text-white text-center py-3 px-6 rounded-xl font-semibold hover:bg-pink-700 transition shadow-lg shadow-pink-600/30"
          >
            🖥️ Panel de Administración
          </Link>
          <Link 
            href="/reservar" 
            className="bg-white/10 text-white text-center py-3 px-6 rounded-xl font-semibold hover:bg-white/20 transition border border-white/20"
          >
            📅 Reservar una clase
          </Link>
        </div>
      </div>
    </main>
  )
}