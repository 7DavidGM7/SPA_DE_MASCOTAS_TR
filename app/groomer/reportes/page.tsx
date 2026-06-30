"use client"
// app/groomer/reportes/page.tsx

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft, RefreshCw, Loader2, PawPrint, AlertCircle,
  TrendingUp, Scissors, Package, BarChart3, Clock,
  CheckCircle, Calendar, ChevronDown, ChevronUp,
  Star, Droplets, RotateCcw, AlertTriangle
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Productividad {
  total_servicios: number
  tiempo_promedio_min: number
  completadas: number
  canceladas: number
  dias_trabajados: number
  promedio_por_dia: number
  nombre_groomer: string
  especialidad: string
  anos_experiencia: number
}

interface ServicioTipo {
  servicio: string
  cantidad: number
}

interface HistorialItem {
  id_sesion_grmm: number
  fecha: string
  hora_inicio: string
  hora_fin_real: string | null
  estado: string
  observaciones: string | null
  nombre_mascota: string
  especie: string
  tamanio: string
  nombre_cliente: string
  nombre_servicio: string
  condicion_pelaje: string | null
  condicion_piel: string | null
  tipo_corte_realizado: string | null
  estado_mascota: string | null
  nivel_estres: number | null
  foto_antes_url: string | null
  foto_despues_url: string | null
  recomendaciones_duenio: string | null
  nombre_groomer: string
}

interface ConsumoInsumo {
  nombre_producto: string
  categoria: string
  total_usado: number
  total_devuelto: number
  total_merma: number
  sesiones_uso: number
  promedio_por_sesion: number
}

interface ConsumoDiario {
  fecha: string
  sesiones: number
  insumos_usados: number
}

interface ReporteData {
  periodo: { desde: string; hasta: string }
  productividad: Productividad | null
  servicios_por_tipo: ServicioTipo[]
  historial: HistorialItem[]
  consumo_insumos: ConsumoInsumo[]
  consumo_diario: ConsumoDiario[]
}

// ── Constantes ─────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  shampoo:"bg-purple-100 text-purple-700", acondicionador:"bg-violet-100 text-violet-700",
  accesorio:"bg-blue-100 text-blue-700",   alimento:"bg-green-100 text-green-700",
  suplemento:"bg-teal-100 text-teal-700",  medicamento:"bg-red-100 text-red-700",
  juguete:"bg-pink-100 text-pink-700",     higiene:"bg-cyan-100 text-cyan-700",
  otro:"bg-gray-100 text-gray-600",
}

const ESTRES_COLOR = (n: number) =>
  n <= 3 ? "text-green-600" : n <= 6 ? "text-amber-600" : "text-red-600"

const PELAJE_EMOJI: Record<string, string> = {
  excelente:"✨", bueno:"👍", descuidado:"😬", enredado:"🪢"
}

// ── Tarjeta historial expandible ──────────────────────────────────────────
function TarjetaHistorial({ item }: { item: HistorialItem }) {
  const [expandido, setExpandido] = useState(false)
  const durMin = item.hora_fin_real
    ? Math.round((new Date(`2000-01-01T${item.hora_fin_real}`).getTime() -
        new Date(`2000-01-01T${item.hora_inicio}`).getTime()) / 60000)
    : null

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-rose-200 transition-all">
      {/* Cabecera */}
      <button className="w-full text-left px-4 py-4 flex items-center gap-3"
        onClick={() => setExpandido(v => !v)}>
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-xl shrink-0">
          {item.especie === "perro" ? "🐶" : item.especie === "gato" ? "🐱" : "🐾"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 text-sm truncate">
            {item.nombre_mascota} · {item.nombre_cliente}
          </p>
          <p className="text-xs text-gray-500">
            {item.nombre_servicio} · {item.tamanio}
          </p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs font-bold text-gray-700">
            {new Date(item.fecha + "T00:00:00").toLocaleDateString("es-BO",
              { day:"numeric", month:"short" })}
          </p>
          {durMin && (
            <p className="text-[10px] text-gray-400 flex items-center gap-0.5 justify-end">
              <Clock size={9}/> {durMin} min
            </p>
          )}
        </div>
        {expandido ? <ChevronUp size={16} className="text-gray-400 shrink-0"/> : <ChevronDown size={16} className="text-gray-400 shrink-0"/>}
      </button>

      {/* Detalle expandido */}
      {expandido && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">

          {/* Estado de la mascota */}
          <div className="grid grid-cols-2 gap-3">
            {item.estado_mascota && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Estado</p>
                <p className="text-sm font-bold text-gray-700 capitalize">{item.estado_mascota}</p>
              </div>
            )}
            {item.nivel_estres && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Nivel estrés</p>
                <p className={`text-sm font-black ${ESTRES_COLOR(item.nivel_estres)}`}>
                  {item.nivel_estres}/10
                </p>
              </div>
            )}
            {item.condicion_pelaje && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Pelaje</p>
                <p className="text-sm font-bold text-gray-700 capitalize">
                  {PELAJE_EMOJI[item.condicion_pelaje]} {item.condicion_pelaje}
                </p>
              </div>
            )}
            {item.condicion_piel && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Piel</p>
                <p className="text-sm font-bold text-gray-700 capitalize">{item.condicion_piel}</p>
              </div>
            )}
          </div>

          {/* Corte realizado */}
          {item.tipo_corte_realizado && (
            <div className="bg-rose-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-rose-500 font-bold uppercase mb-0.5">Corte realizado</p>
              <p className="text-sm text-gray-700 font-semibold">{item.tipo_corte_realizado}</p>
            </div>
          )}

          {/* Fotos antes/después */}
          {(item.foto_antes_url || item.foto_despues_url) && (
            <div className="grid grid-cols-2 gap-2">
              {item.foto_antes_url && (
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Antes</p>
                  <img src={item.foto_antes_url} alt="Antes"
                    className="w-full h-28 object-cover rounded-xl border-2 border-gray-100"/>
                </div>
              )}
              {item.foto_despues_url && (
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Después</p>
                  <img src={item.foto_despues_url} alt="Después"
                    className="w-full h-28 object-cover rounded-xl border-2 border-gray-100"/>
                </div>
              )}
            </div>
          )}

          {/* Recomendaciones */}
          {item.recomendaciones_duenio && (
            <div className="bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
              <p className="text-[10px] text-amber-600 font-bold uppercase mb-0.5">Recomendaciones al dueño</p>
              <p className="text-xs text-gray-700">{item.recomendaciones_duenio}</p>
            </div>
          )}

          {/* Observaciones de sesión */}
          {item.observaciones && (
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Observaciones</p>
              <p className="text-xs text-gray-600">{item.observaciones}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mini gráfico de barras SVG ─────────────────────────────────────────────
function GraficoBarras({ datos }: { datos: ConsumoDiario[] }) {
  if (!datos.length) return null
  const maxSes = Math.max(...datos.map(d => d.sesiones), 1)
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {datos.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap z-10">
            {d.fecha.slice(5)} · {d.sesiones} serv.
          </div>
          <div
            className="w-full bg-rose-400 rounded-t-sm hover:bg-rose-500 transition-all"
            style={{ height: `${(d.sesiones / maxSes) * 100}%`, minHeight: d.sesiones > 0 ? "4px" : "0" }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function GroomerReportesPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const hoy = new Date().toISOString().split("T")[0]
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
  const hace30str = hace30.toISOString().split("T")[0]

  const [desde, setDesde]   = useState(hace30str)
  const [hasta, setHasta]   = useState(hoy)
  const [datos, setDatos]   = useState<ReporteData | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError]   = useState("")
  const [tabActiva, setTabActiva] = useState<"productividad"|"historial"|"consumo">("productividad")

  useEffect(() => {
    if (!isLoading && (!user || !["groomer","admin"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargar = useCallback(async () => {
    setCargando(true); setError("")
    try {
      const params = new URLSearchParams({ desde, hasta })
      const res = await fetch(`/api/groomer/reportes?${params}`, { headers: authHeaders() })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDatos(d)
    } catch (e: any) {
      setError(e.message || "Error al cargar reportes")
    } finally { setCargando(false) }
  }, [desde, hasta, authHeaders])

  useEffect(() => { if (user) cargar() }, [user])

  const prod = datos?.productividad

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50">
      <PawPrint className="w-10 h-10 text-rose-400 animate-bounce"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Navbar */}
      <header className="bg-gradient-to-r from-rose-600 to-pink-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/groomer")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft size={18}/><span className="hidden sm:block">Mi agenda</span>
            </button>
            <div className="w-px h-5 bg-white/20"/>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-rose-200"/>
              <span className="text-white font-black text-lg">
                Mis <span className="text-rose-200">Reportes</span>
              </span>
            </div>
          </div>
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-semibold">
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""}/>
            <span className="hidden sm:block">Actualizar</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Groomer info + selector de periodo */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl p-6 text-white">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-rose-200 text-xs font-bold uppercase tracking-wider mb-1">
                {user.rol === "admin" ? "Vista admin" : "Tu rendimiento"}
              </p>
              <h1 className="text-2xl font-black">
                {prod?.nombre_groomer || user.nombre} ✂️
              </h1>
              {prod?.especialidad && (
                <p className="text-rose-200 text-sm mt-0.5">
                  {prod.especialidad} · {prod.anos_experiencia} años exp.
                </p>
              )}
            </div>
            {/* Selector periodo */}
            <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-4 py-2">
              <Calendar size={14} className="text-rose-200"/>
              <input type="date" value={desde}
                onChange={e => setDesde(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none w-28"/>
              <span className="text-rose-300 text-xs">—</span>
              <input type="date" value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none w-28"/>
              <button onClick={cargar}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-lg transition-colors">
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16}/> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100">
          {([
            { key:"productividad", icon:TrendingUp,  label:"Productividad" },
            { key:"historial",     icon:Scissors,    label:`Historial (${datos?.historial?.length ?? 0})` },
            { key:"consumo",       icon:Package,     label:"Insumos" },
          ] as const).map(({ key, icon:Icon, label }) => (
            <button key={key} onClick={() => setTabActiva(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tabActiva === key ? "bg-rose-600 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              <Icon size={15}/> <span className="hidden sm:block">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-rose-400" size={32}/>
          </div>
        ) : !datos ? null : (

          <>
            {/* ══════ TAB: PRODUCTIVIDAD ══════ */}
            {tabActiva === "productividad" && (
              <div className="space-y-4">

                {/* KPIs principales */}
                {prod ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label:"Servicios realizados", val:prod.total_servicios, icon:Scissors,      color:"bg-rose-50 text-rose-600 border-rose-200" },
                      { label:"Tiempo promedio",       val:prod.tiempo_promedio_min ? `${prod.tiempo_promedio_min} min` : "—", icon:Clock, color:"bg-blue-50 text-blue-600 border-blue-200" },
                      { label:"Completados",           val:prod.completadas,     icon:CheckCircle,  color:"bg-green-50 text-green-600 border-green-200" },
                      { label:"Días trabajados",       val:prod.dias_trabajados, icon:Calendar,     color:"bg-amber-50 text-amber-600 border-amber-200" },
                      { label:"Promedio por día",      val:prod.promedio_por_dia ?? "—", icon:TrendingUp, color:"bg-purple-50 text-purple-600 border-purple-200" },
                      { label:"Cancelados",            val:prod.canceladas,      icon:AlertTriangle,color:"bg-gray-50 text-gray-500 border-gray-200" },
                    ].map(({ label, val, icon:Icon, color }) => (
                      <div key={label} className={`rounded-2xl border-2 p-4 ${color}`}>
                        <Icon size={18} className="mb-2 opacity-70"/>
                        <p className="text-2xl font-black">{val}</p>
                        <p className="text-xs font-semibold opacity-70 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                    <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">Sin datos en este período</p>
                  </div>
                )}

                {/* Gráfico de actividad diaria */}
                {datos.consumo_diario.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-black text-gray-800 mb-1">Actividad diaria</h3>
                    <p className="text-xs text-gray-400 mb-4">Servicios por día en el período</p>
                    <GraficoBarras datos={datos.consumo_diario}/>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{datos.consumo_diario[0]?.fecha?.slice(5)}</span>
                      <span>{datos.consumo_diario[datos.consumo_diario.length - 1]?.fecha?.slice(5)}</span>
                    </div>
                  </div>
                )}

                {/* Servicios por tipo */}
                {datos.servicios_por_tipo.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-black text-gray-800 mb-4">Servicios más realizados</h3>
                    <div className="space-y-3">
                      {datos.servicios_por_tipo.map((s, i) => {
                        const maxCant = datos.servicios_por_tipo[0].cantidad
                        return (
                          <div key={s.servicio} className="flex items-center gap-3">
                            <span className="text-sm font-black text-gray-400 w-4">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-bold text-gray-700 truncate">{s.servicio}</span>
                                <span className="text-sm font-black text-rose-600 shrink-0 ml-2">{s.cantidad}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-400 rounded-full"
                                  style={{ width:`${(s.cantidad / maxCant) * 100}%` }}/>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════ TAB: HISTORIAL ══════ */}
            {tabActiva === "historial" && (
              <div className="space-y-3">
                {datos.historial.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Scissors className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">Sin servicios completados en este período</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 font-semibold">
                      {datos.historial.length} fichas cerradas · Toca cada una para ver el detalle
                    </p>
                    {datos.historial.map(item => (
                      <TarjetaHistorial key={item.id_sesion_grmm} item={item}/>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ══════ TAB: CONSUMO ══════ */}
            {tabActiva === "consumo" && (
              <div className="space-y-4">
                {datos.consumo_insumos.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-500 font-semibold">Sin insumos registrados en este período</p>
                  </div>
                ) : (
                  <>
                    {/* Resumen totales */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label:"Total usado",    val:datos.consumo_insumos.reduce((s,c) => s + Number(c.total_usado), 0).toFixed(1),    icon:Droplets,    color:"bg-rose-50 text-rose-600 border-rose-200" },
                        { label:"Total devuelto", val:datos.consumo_insumos.reduce((s,c) => s + Number(c.total_devuelto), 0).toFixed(1), icon:RotateCcw,   color:"bg-blue-50 text-blue-600 border-blue-200" },
                        { label:"Merma total",    val:datos.consumo_insumos.reduce((s,c) => s + Number(c.total_merma), 0).toFixed(1),    icon:AlertTriangle,color:"bg-amber-50 text-amber-600 border-amber-200" },
                      ].map(({ label, val, icon:Icon, color }) => (
                        <div key={label} className={`rounded-2xl border-2 p-4 ${color}`}>
                          <Icon size={18} className="mb-2 opacity-70"/>
                          <p className="text-2xl font-black">{val}</p>
                          <p className="text-xs font-semibold opacity-70">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tabla de insumos */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="font-black text-gray-800">Detalle por producto</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {datos.consumo_insumos.map((c, i) => (
                          <div key={i} className="px-5 py-4 flex items-start gap-3">
                            <div className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 mt-0.5 ${CAT_COLOR[c.categoria] ?? "bg-gray-100 text-gray-600"}`}>
                              {c.categoria}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{c.nombre_producto}</p>
                              <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                                <span className="text-rose-600 font-semibold">Usado: {Number(c.total_usado).toFixed(1)}</span>
                                {Number(c.total_devuelto) > 0 && (
                                  <span className="text-blue-600 font-semibold">Devuelto: {Number(c.total_devuelto).toFixed(1)}</span>
                                )}
                                {Number(c.total_merma) > 0 && (
                                  <span className="text-amber-600 font-semibold">Merma: {Number(c.total_merma).toFixed(1)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-gray-700 text-sm">{c.sesiones_uso}</p>
                              <p className="text-[10px] text-gray-400">sesiones</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                ~{Number(c.promedio_por_sesion).toFixed(1)}/sesión
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Botón flotante volver */}
        <div className="text-center pb-4">
          <button onClick={() => router.push("/groomer")}
            className="text-sm text-rose-500 font-bold hover:underline flex items-center gap-1.5 mx-auto">
            <ArrowLeft size={14}/> Volver a mi agenda
          </button>
        </div>

      </main>
    </div>
  )
}