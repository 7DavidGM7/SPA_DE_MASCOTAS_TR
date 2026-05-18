"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import { ShoppingCart, CreditCard, Package, Truck, LogOut, Bell, PawPrint, ChevronRight, DollarSign } from "lucide-react"

export default function CajeroPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [avisoTimeout, setAvisoTimeout] = useState(false)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || !["admin", "cajero"].includes(user.rol))) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-amber-50"><PawPrint className="w-10 h-10 text-amber-400 animate-bounce" /></div>
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
      <header className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-white"/>
            <span className="text-white font-black text-lg">Panel <span className="text-amber-200">Cajero</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-sm font-medium">{user.nombre}</span>
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Bienvenida */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-8 text-white">
          <h1 className="text-2xl font-black mb-1">Hola, {user.nombre} 👋</h1>
          <p className="text-amber-100 text-sm">Panel de caja — gestiona pagos, productos y envíos.</p>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pagos pendientes", valor: "—", color: "bg-red-50 text-red-600",    icon: CreditCard },
            { label: "Ingresos hoy",     valor: "Bs. 0", color: "bg-green-50 text-green-600", icon: DollarSign },
            { label: "Productos stock",  valor: "—",     color: "bg-blue-50 text-blue-600",   icon: Package },
            { label: "Envíos por llegar",valor: "—",     color: "bg-purple-50 text-purple-600", icon: Truck },
          ].map(({ label, valor, color, icon: Icon }) => (
            <div key={label} className={`${color} rounded-2xl p-4 border-2 border-current/10`}>
              <Icon size={20} className="mb-2 opacity-70"/>
              <p className="text-xs font-semibold opacity-70">{label}</p>
              <p className="text-2xl font-black">{valor}</p>
            </div>
          ))}
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { icon: CreditCard, label: "Pagos a realizar",    desc: "Cobros pendientes de servicios",     color: "bg-amber-50 border-amber-200 hover:bg-amber-100",   iconColor: "text-amber-600" },
            { icon: Truck,      label: "Envíos y recepciones",desc: "Pedidos por llegar y despachos",      color: "bg-blue-50 border-blue-200 hover:bg-blue-100",       iconColor: "text-blue-600" },
            { icon: Package,    label: "Inventario",          desc: "Lista de productos y stock actual",  color: "bg-green-50 border-green-200 hover:bg-green-100",    iconColor: "text-green-600" },
            { icon: ShoppingCart, label: "Punto de venta",    desc: "Vender productos al cliente",        color: "bg-rose-50 border-rose-200 hover:bg-rose-100",       iconColor: "text-rose-600" },
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
