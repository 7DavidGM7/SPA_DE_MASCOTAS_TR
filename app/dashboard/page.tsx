"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Calendar, ShoppingCart, MessageSquareHeart,
  Info, LogOut, Bell, ChevronRight, Star,
  Scissors, Bath, Heart, Sparkles, Menu, X, PawPrint
} from "lucide-react"

// ── Datos de contenido ────────────────────────────────────────────────────────
const PROMOS = [
  {
    id: 1,
    tag: "🔥 Oferta de temporada",
    title: "Baño + Corte",
    desc: "Combo completo para tu mascota con productos premium",
    price: "Bs. 85",
    oldPrice: "Bs. 120",
    color: "from-violet-600 to-purple-800",
    emoji: "✂️",
  },
  {
    id: 2,
    tag: "⭐ Más popular",
    title: "Spa Relax",
    desc: "Masaje relajante, aromaterapia y acondicionador especial",
    price: "Bs. 110",
    oldPrice: "Bs. 150",
    color: "from-rose-500 to-pink-700",
    emoji: "💆",
  },
  {
    id: 3,
    tag: "🆕 Nuevo servicio",
    title: "Dental Express",
    desc: "Limpieza dental profesional para la salud de tu mascota",
    price: "Bs. 60",
    oldPrice: "Bs. 90",
    color: "from-cyan-500 to-teal-700",
    emoji: "🦷",
  },
]

const SERVICIOS = [
  { icon: Bath, label: "Baño", desc: "Con shampoo premium", color: "bg-blue-100 text-blue-600" },
  { icon: Scissors, label: "Corte", desc: "Estilo a medida", color: "bg-purple-100 text-purple-600" },
  { icon: Heart, label: "Masaje", desc: "Relajación total", color: "bg-rose-100 text-rose-600" },
  { icon: Sparkles, label: "Spa VIP", desc: "Experiencia completa", color: "bg-amber-100 text-amber-600" },
]

const TESTIMONIOS = [
  { nombre: "María G.", mascota: "Rocky 🐶", texto: "¡Increíble servicio! Rocky salió feliz y oloroso. Totalmente recomendado.", stars: 5 },
  { nombre: "Carlos M.", mascota: "Michi 🐱", texto: "El personal es muy profesional y cariñoso con las mascotas.", stars: 5 },
  { nombre: "Ana R.", mascota: "Bella 🐩", texto: "Bella siempre sale hermosa. El mejor spa de la ciudad.", stars: 5 },
]

const MASCOTAS_EMOJI = ["🐶", "🐱", "🐰", "🐹", "🦜", "🐠", "🐾", "🌟"]

// ── Componentes pequeños ──────────────────────────────────────────────────────
function NavButton({
  icon: Icon, label, onClick, badge
}: { icon: React.ElementType; label: string; onClick?: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 group"
    >
      <div className="relative">
        <Icon size={20} />
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="text-xs font-medium hidden md:block">{label}</span>
    </button>
  )
}

function PromoCard({ promo, index }: { promo: typeof PROMOS[0]; index: number }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${promo.color} p-6 cursor-pointer transition-all duration-300 ${hovered ? "scale-[1.02] shadow-2xl" : "shadow-lg"}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="absolute top-3 right-3 text-4xl opacity-20 select-none">{promo.emoji}</div>
      <span className="inline-block text-xs font-semibold text-white/80 bg-white/10 rounded-full px-3 py-1 mb-3">
        {promo.tag}
      </span>
      <h3 className="text-xl font-bold text-white mb-1">{promo.title}</h3>
      <p className="text-sm text-white/70 mb-4">{promo.desc}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black text-white">{promo.price}</span>
        <span className="text-sm text-white/50 line-through mb-0.5">{promo.oldPrice}</span>
      </div>
      <button className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
        Reservar ahora <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [floatingEmoji, setFloatingEmoji] = useState<{ id: number; emoji: string; x: number }[]>([])
  const [emojiCount, setEmojiCount] = useState(0)

  // Redirigir si no hay sesión
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  // Animación de emojis flotantes al hacer clic en la zona hero
  const spawnEmoji = () => {
    const id = emojiCount + 1
    const emoji = MASCOTAS_EMOJI[Math.floor(Math.random() * MASCOTAS_EMOJI.length)]
    const x = Math.random() * 80 + 10
    setEmojiCount(id)
    setFloatingEmoji(prev => [...prev, { id, emoji, x }])
    setTimeout(() => setFloatingEmoji(prev => prev.filter(e => e.id !== id)), 1500)
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100">
        <div className="text-center space-y-3">
          <PawPrint className="w-12 h-12 text-violet-500 animate-bounce mx-auto" />
          <p className="text-violet-600 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Google Font ── */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 to-purple-800 shadow-lg shadow-violet-900/20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-black text-lg tracking-tight hidden sm:block">
              SPA<span className="text-purple-300"> Mascotas</span>
            </span>
          </div>

          {/* Nav botones — desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <NavButton icon={Calendar} label="Agendar cita" onClick={() => alert("Módulo de citas — próximamente")} />
            <NavButton icon={ShoppingCart} label="Carrito" onClick={() => alert("Módulo de compras — próximamente")} badge={2} />
            <NavButton icon={MessageSquareHeart} label="Sugerencias" onClick={() => alert("Módulo de sugerencias — próximamente")} />
            <NavButton icon={Info} label="Nosotros" onClick={() => alert("Módulo acerca de nosotros — próximamente")} />
          </nav>

          {/* Usuario + logout */}
          <div className="flex items-center gap-3">
            <button className="relative text-white/80 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">1</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                {user.nombre.charAt(0).toUpperCase()}
              </div>
              <span className="text-white text-sm font-semibold">{user.nombre}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <LogOut size={18} />
            </button>
            {/* Hamburguesa mobile */}
            <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Menú mobile */}
        {menuOpen && (
          <div className="md:hidden bg-violet-800 border-t border-white/10 px-4 py-3 flex flex-col gap-1">
            {[
              { icon: Calendar, label: "Agendar cita" },
              { icon: ShoppingCart, label: "Carrito de compras" },
              { icon: MessageSquareHeart, label: "Sugerencias" },
              { icon: Info, label: "Acerca de nosotros" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => { setMenuOpen(false); alert(`${label} — próximamente`) }}
                className="flex items-center gap-3 text-white/80 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium"
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">

        {/* ── HERO ── */}
        <section
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-800 p-8 md:p-12 cursor-pointer select-none min-h-[220px] flex flex-col justify-between"
          onClick={spawnEmoji}
        >
          {/* Emojis flotantes */}
          {floatingEmoji.map(e => (
            <span
              key={e.id}
              className="pointer-events-none absolute text-3xl animate-bounce"
              style={{ left: `${e.x}%`, bottom: "20%", animation: "floatUp 1.4s ease-out forwards" }}
            >
              {e.emoji}
            </span>
          ))}
          <style>{`
            @keyframes floatUp {
              0%   { opacity:1; transform: translateY(0) scale(1); }
              100% { opacity:0; transform: translateY(-120px) scale(1.4); }
            }
          `}</style>

          {/* Círculos decorativos */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-white/5 rounded-full" />

          <div className="relative z-10">
            <span className="inline-block bg-white/15 text-white text-xs font-bold px-3 py-1 rounded-full mb-4 backdrop-blur-sm">
              ¡Haz clic aquí! 🐾
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2">
              Bienvenido, <span className="text-purple-200">{user.nombre}</span> 👋
            </h1>
            <p className="text-white/70 text-base md:text-lg max-w-lg">
              Tu mascota merece el mejor cuidado. Agenda una cita hoy y descubre nuestros servicios premium.
            </p>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); alert("Módulo de citas — próximamente") }}
            className="relative z-10 mt-6 self-start flex items-center gap-2 bg-white text-violet-700 font-bold px-6 py-3 rounded-xl hover:bg-purple-50 transition-all hover:scale-105 shadow-lg"
          >
            <Calendar size={18} /> Agendar ahora
          </button>
        </section>

        {/* ── ACCESOS RÁPIDOS ── */}
        <section>
          <h2 className="text-xl font-black text-gray-800 mb-4">¿Qué necesitas hoy?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Calendar, label: "Agendar cita", desc: "Reserva tu turno", color: "bg-violet-50 border-violet-200 hover:bg-violet-100", iconColor: "text-violet-600" },
              { icon: ShoppingCart, label: "Tienda", desc: "Productos para tu mascota", color: "bg-blue-50 border-blue-200 hover:bg-blue-100", iconColor: "text-blue-600" },
              { icon: MessageSquareHeart, label: "Sugerencias", desc: "Tu opinión importa", color: "bg-rose-50 border-rose-200 hover:bg-rose-100", iconColor: "text-rose-600" },
              { icon: Info, label: "Nosotros", desc: "Conoce nuestro equipo", color: "bg-amber-50 border-amber-200 hover:bg-amber-100", iconColor: "text-amber-600" },
            ].map(({ icon: Icon, label, desc, color, iconColor }) => (
              <button
                key={label}
                onClick={() => alert(`${label} — próximamente`)}
                className={`flex flex-col items-start gap-3 p-5 rounded-2xl border-2 ${color} transition-all duration-200 hover:scale-[1.02] hover:shadow-md text-left`}
              >
                <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center ${iconColor}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── PROMOCIONES ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-800">Promociones especiales</h2>
            <button className="text-sm text-violet-600 font-semibold hover:underline flex items-center gap-1">
              Ver todas <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PROMOS.map((promo, i) => (
              <PromoCard key={promo.id} promo={promo} index={i} />
            ))}
          </div>
        </section>

        {/* ── SERVICIOS ── */}
        <section>
          <h2 className="text-xl font-black text-gray-800 mb-4">Nuestros servicios</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SERVICIOS.map(({ icon: Icon, label, desc, color }) => (
              <div
                key={label}
                onClick={() => alert(`${label} — próximamente`)}
                className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-violet-200 hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.03] text-center"
              >
                <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center`}>
                  <Icon size={26} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── MASCOTAS INTERACTIVO ── */}
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl p-8 border-2 border-amber-100">
          <h2 className="text-xl font-black text-gray-800 mb-2">La familia de SPA Mascotas 🐾</h2>
          <p className="text-gray-500 text-sm mb-6">Haz clic en cualquier mascota para saludarla</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {["🐶", "🐱", "🐰", "🐹", "🦜", "🐠", "🐕‍🦺", "🐈‍⬛", "🐇", "🦮"].map((emoji, i) => (
              <button
                key={i}
                onClick={(e) => {
                  const btn = e.currentTarget
                  btn.style.transform = "scale(1.5) rotate(10deg)"
                  setTimeout(() => { btn.style.transform = "" }, 400)
                }}
                className="text-4xl transition-transform duration-300 hover:scale-125 hover:-rotate-6 cursor-pointer"
                style={{ transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1)" }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIOS ── */}
        <section>
          <h2 className="text-xl font-black text-gray-800 mb-4">Lo que dicen nuestros clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIOS.map(({ nombre, mascota, texto, stars }) => (
              <div key={nombre} className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{texto}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-lg">
                    {mascota.split(" ")[1]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{nombre}</p>
                    <p className="text-xs text-gray-400">Dueño de {mascota.split(" ")[0]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="text-center py-6 border-t border-gray-100">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} SPA Mascotas · Hecho con <span className="text-rose-400">❤️</span> para tus mascotas
          </p>
        </footer>

      </main>
    </div>
  )
}
