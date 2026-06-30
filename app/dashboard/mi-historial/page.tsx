"use client"
// app/dashboard/mi-historial/page.tsx

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft, PawPrint, Loader2, AlertCircle,
  Scissors, Camera, Tag, ShoppingBag,
  ChevronDown, ChevronUp, Clock, Calendar,
  Star, CheckCircle, Ticket, Package,
  TrendingUp, Heart, RefreshCw
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Resumen {
  total_citas: number
  servicios_completados: number
  total_mascotas: number
  total_compras: number
  gasto_total: number
  cupones_usados: number
  primera_cita: string | null
  ultima_visita: string | null
}

interface Servicio {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  nombre_servicio: string
  precio_servicio: number
  nombre_mascota: string
  especie: string
  tamanio: string
  nombre_groomer: string | null
  condicion_pelaje: string | null
  condicion_piel: string | null
  tipo_corte_realizado: string | null
  estado_mascota: string | null
  nivel_estres: number | null
  foto_antes_url: string | null
  foto_despues_url: string | null
  recomendaciones_duenio: string | null
  proxima_visita_sugerida: string | null
}

interface GaleriaItem {
  id_cita: number
  fecha: string
  nombre_mascota: string
  especie: string
  nombre_servicio: string
  nombre_groomer: string | null
  foto_antes_url: string | null
  foto_despues_url: string | null
}

interface Compra {
  id_compra: number
  fecha: string
  total: number
  estado: string
  descuento_aplicado: number
  cupon_codigo: string | null
  cupon_descripcion: string | null
  cupon_tipo: string | null
  cupon_valor: number | null
  descuento_monto: number | null
  cantidad_items: number
  items: { nombre_producto: string; cantidad: number; precio_unitario: number; subtotal: number }[]
}

interface Cupon {
  id_cupon: number
  codigo: string
  descripcion: string
  tipo: "porcentaje" | "monto_fijo"
  valor: number
  fecha_fin: string | null
  monto_minimo: number
  solo_primera_compra: boolean
}

interface HistorialData {
  resumen: Resumen | null
  servicios: Servicio[]
  galeria: GaleriaItem[]
  compras: Compra[]
  cupones_disponibles: Cupon[]
}

// ── Constantes ─────────────────────────────────────────────────────────────
const PELAJE_EMOJI: Record<string, string> = {
  excelente:"✨", bueno:"👍", descuidado:"😬", enredado:"🪢"
}
const ESTRES_COLOR = (n: number) =>
  n <= 3 ? "text-green-600" : n <= 6 ? "text-amber-600" : "text-red-600"

const ESTADO_COMPRA: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  pagada:    "bg-green-100 text-green-700",
  anulada:   "bg-red-100 text-red-700",
}

// ── Tarjeta servicio expandible ────────────────────────────────────────────
function TarjetaServicio({ s }: { s: Servicio }) {
  const [exp, setExp] = useState(false)
  const tieneFicha = s.condicion_pelaje || s.tipo_corte_realizado || s.recomendaciones_duenio
  const tieneFoots = s.foto_antes_url || s.foto_despues_url

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-violet-200 transition-all">
      <button className="w-full text-left px-4 py-4 flex items-center gap-3"
        onClick={() => setExp(v => !v)}>
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-xl shrink-0">
          {s.especie === "perro" ? "🐶" : s.especie === "gato" ? "🐱" : "🐾"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 text-sm truncate">{s.nombre_mascota}</p>
          <p className="text-xs text-gray-500 truncate">{s.nombre_servicio} · {s.tamanio}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs font-bold text-gray-700">
            {new Date(s.fecha_programada + "T00:00:00")
              .toLocaleDateString("es-BO", { day:"numeric", month:"short", year:"numeric" })}
          </p>
          <p className="text-xs text-violet-600 font-black">Bs. {Number(s.precio_servicio).toFixed(2)}</p>
        </div>
        {exp ? <ChevronUp size={16} className="text-gray-400 shrink-0"/> : <ChevronDown size={16} className="text-gray-400 shrink-0"/>}
      </button>

      {exp && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">

          {/* Groomer */}
          {s.nombre_groomer && (
            <p className="text-xs text-teal-600 font-semibold flex items-center gap-1">
              <Scissors size={11}/> Atendido por: {s.nombre_groomer}
            </p>
          )}

          {/* Ficha técnica */}
          {tieneFicha && (
            <div className="grid grid-cols-2 gap-2">
              {s.condicion_pelaje && (
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Pelaje</p>
                  <p className="text-sm font-bold text-gray-700 capitalize">
                    {PELAJE_EMOJI[s.condicion_pelaje]} {s.condicion_pelaje}
                  </p>
                </div>
              )}
              {s.condicion_piel && (
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Piel</p>
                  <p className="text-sm font-bold text-gray-700 capitalize">{s.condicion_piel}</p>
                </div>
              )}
              {s.nivel_estres && (
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Estrés</p>
                  <p className={`text-sm font-black ${ESTRES_COLOR(s.nivel_estres)}`}>{s.nivel_estres}/10</p>
                </div>
              )}
              {s.tipo_corte_realizado && (
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Corte</p>
                  <p className="text-sm font-bold text-gray-700">{s.tipo_corte_realizado}</p>
                </div>
              )}
            </div>
          )}

          {/* Fotos */}
          {tieneFoots && (
            <div className="grid grid-cols-2 gap-2">
              {s.foto_antes_url && (
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Antes</p>
                  <img src={s.foto_antes_url} alt="Antes"
                    className="w-full h-28 object-cover rounded-xl border border-gray-100"/>
                </div>
              )}
              {s.foto_despues_url && (
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Después</p>
                  <img src={s.foto_despues_url} alt="Después"
                    className="w-full h-28 object-cover rounded-xl border border-gray-100"/>
                </div>
              )}
            </div>
          )}

          {/* Recomendaciones */}
          {s.recomendaciones_duenio && (
            <div className="bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
              <p className="text-[10px] text-violet-500 font-bold uppercase mb-1">
                💡 Recomendaciones del groomer
              </p>
              <p className="text-xs text-gray-700">{s.recomendaciones_duenio}</p>
            </div>
          )}

          {/* Próxima visita */}
          {s.proxima_visita_sugerida && (
            <div className="bg-amber-50 rounded-xl px-3 py-2 border border-amber-100 flex items-center gap-2">
              <Calendar size={13} className="text-amber-500 shrink-0"/>
              <p className="text-xs text-amber-700 font-semibold">
                Próxima visita sugerida:{" "}
                {new Date(s.proxima_visita_sugerida + "T00:00:00")
                  .toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta compra expandible ──────────────────────────────────────────────
function TarjetaCompra({ c }: { c: Compra }) {
  const [exp, setExp] = useState(false)
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-violet-200 transition-all">
      <button className="w-full text-left px-4 py-4 flex items-center gap-3"
        onClick={() => setExp(v => !v)}>
        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
          <ShoppingBag size={18} className="text-violet-500"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 text-sm">Pedido #{c.id_compra}</p>
          <p className="text-xs text-gray-500">{c.cantidad_items} producto{c.cantidad_items !== 1 ? "s" : ""}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs text-gray-500">
            {new Date(c.fecha + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"short" })}
          </p>
          <p className="font-black text-violet-600 text-sm">Bs. {Number(c.total).toFixed(2)}</p>
          {c.descuento_aplicado > 0 && (
            <p className="text-[10px] text-green-600 font-semibold">
              -Bs. {Number(c.descuento_aplicado).toFixed(2)}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${ESTADO_COMPRA[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
          {c.estado}
        </span>
        {exp ? <ChevronUp size={14} className="text-gray-400 shrink-0 ml-1"/> : <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1"/>}
      </button>

      {exp && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {c.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.nombre_producto} × {item.cantidad}</span>
              <span className="font-semibold">Bs. {Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
          {c.cupon_codigo && (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2 border border-green-100 mt-2">
              <Ticket size={12} className="text-green-600 shrink-0"/>
              <p className="text-xs text-green-700 font-semibold">
                Cupón <strong>{c.cupon_codigo}</strong> aplicado
                {c.cupon_tipo === "porcentaje" ? ` (${c.cupon_valor}%)` : ` (Bs. ${c.cupon_valor})`}
                {" "}— ahorraste Bs. {Number(c.descuento_monto).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function MiHistorialPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const [datos, setDatos]     = useState<HistorialData | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError]     = useState("")
  const [tab, setTab]         = useState<"servicios"|"galeria"|"compras"|"cupones">("servicios")
  const [fotoGrande, setFotoGrande] = useState<{ src: string; label: string } | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargar = useCallback(async () => {
    setCargando(true); setError("")
    try {
      const res = await fetch("/api/cliente/historial", { headers: authHeaders() })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDatos(d)
    } catch (e: any) {
      setError(e.message || "Error al cargar historial")
    } finally { setCargando(false) }
  }, [authHeaders])

  useEffect(() => { if (user) cargar() }, [user])

  const r = datos?.resumen

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-violet-50">
      <PawPrint className="w-10 h-10 text-violet-400 animate-bounce"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{ fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Lightbox foto */}
      {fotoGrande && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFotoGrande(null)}>
          <div className="max-w-lg w-full space-y-2">
            <img src={fotoGrande.src} alt={fotoGrande.label}
              className="w-full rounded-2xl object-contain max-h-[80vh]"/>
            <p className="text-white text-center text-sm font-semibold">{fotoGrande.label}</p>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 to-purple-800 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="text-white/70 hover:text-white transition-colors">
              <ArrowLeft size={20}/>
            </button>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-purple-300"/>
              <span className="text-white font-black text-lg">
                Mi <span className="text-purple-300">Historial</span>
              </span>
            </div>
          </div>
          <button onClick={cargar} disabled={cargando}
            className="text-white/70 hover:text-white transition-colors">
            <RefreshCw size={17} className={cargando ? "animate-spin" : ""}/>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Hero resumen */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-800 rounded-3xl p-6 text-white">
          <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-1">Tu trayectoria</p>
          <h1 className="text-2xl font-black mb-4">Hola, {user.nombre} 🐾</h1>
          {r && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label:"Servicios",    val:r.servicios_completados, icon:"✂️" },
                { label:"Mascotas",     val:r.total_mascotas,        icon:"🐾" },
                { label:"Compras",      val:r.total_compras,         icon:"🛍️" },
                { label:"Gasto total",  val:`Bs.${Number(r.gasto_total).toFixed(0)}`, icon:"💳" },
                { label:"Cupones usados",val:r.cupones_usados,       icon:"🎟️" },
                { label:"Citas totales",val:r.total_citas,           icon:"📅" },
              ].map(({ label, val, icon }) => (
                <div key={label} className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                  <p className="text-lg">{icon}</p>
                  <p className="text-xl font-black">{val}</p>
                  <p className="text-[10px] text-purple-200 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          )}
          {r?.ultima_visita && (
            <p className="text-purple-200 text-xs mt-4 flex items-center gap-1">
              <Clock size={11}/> Última visita:{" "}
              {new Date(r.ultima_visita + "T00:00:00")
                .toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" })}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16}/> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-white rounded-2xl p-1.5 border border-gray-100 shadow-sm">
          {([
            { key:"servicios", icon:Scissors,    label:"Servicios" },
            { key:"galeria",   icon:Camera,      label:"Galería" },
            { key:"compras",   icon:ShoppingBag, label:"Compras" },
            { key:"cupones",   icon:Ticket,      label:"Cupones" },
          ] as const).map(({ key, icon:Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === key ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              <Icon size={16}/>
              <span>{label}</span>
              {key === "galeria" && datos && datos.galeria.length > 0 && (
                <span className={`text-[9px] font-black px-1.5 rounded-full ${tab === key ? "bg-white/30" : "bg-violet-100 text-violet-600"}`}>
                  {datos.galeria.length}
                </span>
              )}
              {key === "cupones" && datos && datos.cupones_disponibles.length > 0 && (
                <span className={`text-[9px] font-black px-1.5 rounded-full ${tab === key ? "bg-white/30" : "bg-green-100 text-green-600"}`}>
                  {datos.cupones_disponibles.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-violet-400" size={32}/>
          </div>
        ) : !datos ? null : (
          <>
            {/* ══ TAB: SERVICIOS ══ */}
            {tab === "servicios" && (
              <div className="space-y-3">
                {datos.servicios.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Scissors className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">Aún no tienes servicios completados</p>
                    <button onClick={() => router.push("/dashboard/agendar")}
                      className="mt-3 text-violet-600 text-sm font-bold hover:underline">
                      Agendar tu primera cita →
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 font-semibold">
                      {datos.servicios.length} servicio{datos.servicios.length !== 1 ? "s" : ""} completado{datos.servicios.length !== 1 ? "s" : ""}
                    </p>
                    {datos.servicios.map(s => (
                      <TarjetaServicio key={s.id_cita} s={s}/>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ══ TAB: GALERÍA ══ */}
            {tab === "galeria" && (
              <div className="space-y-4">
                {datos.galeria.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Camera className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">Aún no hay fotos de tus mascotas</p>
                    <p className="text-gray-400 text-sm mt-1">Las fotos aparecerán tras completar servicios de grooming</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 font-semibold">
                      {datos.galeria.length} sesión{datos.galeria.length !== 1 ? "es" : ""} con fotos · Toca para ampliar
                    </p>
                    <div className="space-y-4">
                      {datos.galeria.map(item => (
                        <div key={item.id_cita} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
                          {/* Info sesión */}
                          <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
                            <span className="text-xl">
                              {item.especie === "perro" ? "🐶" : item.especie === "gato" ? "🐱" : "🐾"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-gray-800 text-sm truncate">{item.nombre_mascota}</p>
                              <p className="text-xs text-gray-500">{item.nombre_servicio}</p>
                            </div>
                            <p className="text-xs text-gray-400 shrink-0">
                              {new Date(item.fecha + "T00:00:00")
                                .toLocaleDateString("es-BO", { day:"numeric", month:"short", year:"numeric" })}
                            </p>
                          </div>
                          {/* Grid fotos */}
                          <div className={`grid ${item.foto_antes_url && item.foto_despues_url ? "grid-cols-2" : "grid-cols-1"} gap-1 p-2`}>
                            {item.foto_antes_url && (
                              <button className="relative group" onClick={() => setFotoGrande({ src: item.foto_antes_url!, label: `${item.nombre_mascota} — Antes` })}>
                                <img src={item.foto_antes_url} alt="Antes"
                                  className="w-full h-44 object-cover rounded-xl group-hover:brightness-90 transition-all"/>
                                <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  Antes
                                </span>
                              </button>
                            )}
                            {item.foto_despues_url && (
                              <button className="relative group" onClick={() => setFotoGrande({ src: item.foto_despues_url!, label: `${item.nombre_mascota} — Después` })}>
                                <img src={item.foto_despues_url} alt="Después"
                                  className="w-full h-44 object-cover rounded-xl group-hover:brightness-90 transition-all"/>
                                <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  Después ✨
                                </span>
                              </button>
                            )}
                          </div>
                          {item.nombre_groomer && (
                            <p className="px-4 pb-3 text-xs text-gray-400 flex items-center gap-1">
                              <Scissors size={10}/> {item.nombre_groomer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ TAB: COMPRAS ══ */}
            {tab === "compras" && (
              <div className="space-y-3">
                {datos.compras.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">No tienes compras registradas</p>
                    <button onClick={() => router.push("/dashboard/tienda")}
                      className="mt-3 text-violet-600 text-sm font-bold hover:underline">
                      Ir a la tienda →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400 font-semibold">
                        {datos.compras.length} pedido{datos.compras.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-violet-600 font-black">
                        Total gastado: Bs. {datos.compras.filter(c => c.estado === "pagada").reduce((s,c) => s + Number(c.total), 0).toFixed(2)}
                      </p>
                    </div>
                    {datos.compras.map(c => (
                      <TarjetaCompra key={c.id_compra} c={c}/>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ══ TAB: CUPONES DISPONIBLES ══ */}
            {tab === "cupones" && (
              <div className="space-y-3">
                {datos.cupones_disponibles.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">No hay cupones disponibles por ahora</p>
                    <p className="text-gray-400 text-sm mt-1">Vuelve pronto para ver nuevas promociones</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 font-semibold">
                      {datos.cupones_disponibles.length} cupón{datos.cupones_disponibles.length !== 1 ? "es" : ""} disponible{datos.cupones_disponibles.length !== 1 ? "s" : ""} para ti
                    </p>
                    {datos.cupones_disponibles.map(cup => (
                      <div key={cup.id_cupon}
                        className="bg-white rounded-2xl border-2 border-violet-100 overflow-hidden hover:border-violet-300 transition-all">
                        {/* Cabecera cupón */}
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Ticket size={16} className="text-white"/>
                            <span className="font-black text-white text-sm tracking-widest">{cup.codigo}</span>
                          </div>
                          <div className="bg-white/20 rounded-xl px-3 py-1 text-center">
                            <p className="text-white font-black text-lg leading-none">
                              {cup.tipo === "porcentaje" ? `${cup.valor}%` : `Bs. ${cup.valor}`}
                            </p>
                            <p className="text-violet-200 text-[9px]">descuento</p>
                          </div>
                        </div>
                        {/* Detalle */}
                        <div className="px-4 py-3 space-y-1.5">
                          <p className="text-sm text-gray-700 font-semibold">{cup.descripcion}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            {cup.monto_minimo > 0 && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                                Compra mínima: Bs. {cup.monto_minimo}
                              </span>
                            )}
                            {cup.solo_primera_compra && (
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                                Solo primera compra
                              </span>
                            )}
                            {cup.fecha_fin && (
                              <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                                Vence: {new Date(cup.fecha_fin + "T00:00:00")
                                  .toLocaleDateString("es-BO", { day:"numeric", month:"short" })}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => router.push("/dashboard/tienda")}
                            className="w-full mt-1 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                            <ShoppingBag size={13}/> Usar en la tienda
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}