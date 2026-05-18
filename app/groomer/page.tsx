"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import { Scissors, ClipboardList, Clock, Star, LogOut, Bell, PawPrint, ChevronRight, Bath } from "lucide-react"

export default function GroomerPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [avisoTimeout, setAvisoTimeout] = useState(false)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || !["admin", "groomer"].includes(user.rol))) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-rose-50"><PawPrint className="w-10 h-10 text-rose-400 animate-bounce"/></div>
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {avisoTimeout && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18}/>
          <span className="font-semibold text-sm">Sesión expirará en 1 minuto.</span>
          <button onClick={() => setAvisoTimeout(false)} className="underline text-sm">Continuar</button>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-white"/>
            <span className="text-white font-black text-lg">Panel <span className="text-rose-200">Groomer</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-sm font-medium">{user.nombre}</span>
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Bienvenida */}
        <div className="bg-gradient-to-br from-rose-400 to-pink-600 rounded-3xl p-8 text-white">
          <h1 className="text-2xl font-black mb-1">Hola, {user.nombre} ✂️</h1>
          <p className="text-rose-100 text-sm">Tu panel de groomer — tus citas, fichas y servicios del día.</p>
        </div>

        {/* Citas hoy placeholder */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
          <h2 className="font-black text-gray-800 mb-1">Mis citas de hoy</h2>
          <p className="text-xs text-gray-400 mb-4">Las citas asignadas a ti aparecerán aquí</p>
          <div className="text-center py-8 text-gray-400">
            <Scissors className="w-10 h-10 mx-auto mb-2 text-gray-200"/>
            <p className="text-sm">Sin citas asignadas por el momento.</p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { icon: Clock,        label: "Mi agenda",            desc: "Citas asignadas esta semana",       color: "bg-rose-50 border-rose-200 hover:bg-rose-100",     iconColor: "text-rose-600" },
            { icon: ClipboardList,label: "Fichas de mascotas",   desc: "Historial y notas de cada mascota", color: "bg-purple-50 border-purple-200 hover:bg-purple-100", iconColor: "text-purple-600" },
            { icon: Bath,         label: "Servicios realizados", desc: "Registro de trabajos completados",  color: "bg-blue-50 border-blue-200 hover:bg-blue-100",     iconColor: "text-blue-600" },
            { icon: Star,         label: "Mis valoraciones",     desc: "Reseñas de clientes sobre mi trabajo", color: "bg-amber-50 border-amber-200 hover:bg-amber-100", iconColor: "text-amber-600" },
          ].map(({ icon: Icon, label, desc, color, iconColor }) => (
            <button key={label} onClick={() => alert(`${label} — próximamente`)}
              className={`flex items-center gap-4 p-5 rounded-2xl border-2 ${color} transition-all hover:scale-[1.01] hover:shadow-md text-left`}>
              <div className={`w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center ${iconColor} shrink-0`}><Icon size={22}/></div>
              <div><p className="font-bold text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
              <ChevronRight size={16} className="text-gray-400 ml-auto shrink-0"/>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
