"use client"
// app/groomer/page.tsx — Agenda + Ficha técnica completa

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import {
  Scissors, LogOut, Bell, PawPrint, ChevronRight, ChevronLeft,
  Calendar, Clock, RefreshCw, Loader2, AlertCircle, CheckCircle,
  ClipboardList, Package, Camera, X, Plus, AlertTriangle, LayoutGrid, List
} from "lucide-react"
import FotoUpload from "@/components/FotoUpload"
import { BarChart3 } from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Cita {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
  nombre_cliente: string
  nombre_mascota: string
  especie: string
  tamanio: string
  nombre_servicio: string
  duracion_ajustada: number
  notas: string | null
  id_mascota: number | null
  id_servicio: number | null
  id_sesion_grmm: number | null
}
interface Entrega {
  id_entrega: number
  nombre_producto: string
  categoria: string
  cantidad_entregada: number
  estado: string
  fecha_entrega: string
  notas_entrega: string | null
  entregado_por: string | null
}

interface CheckItem { tarea: string; completada: boolean; observacion: string | null }
interface Insumo { id_usa: number; nombre_producto: string; cantidad_producto: number; categoria: string }
interface Producto { id_producto: number; nombre: string; categoria: string; stock: number; id_inventario: number }

const TAREA_LABELS: Record<string, string> = {
  bano:                   "🛁 Baño",
  secado:                 "💨 Secado",
  corte_pelo:             "✂️ Corte de pelo",
  corte_unas:             "💅 Corte de uñas",
  limpieza_oidos:         "👂 Limpieza de oídos",
  glandulas_anales:       "🐾 Glándulas anales",
  perfume:                "🌸 Perfume",
  dientes:                "🦷 Dientes",
  desparasitacion_externa:"🔬 Desparasitación externa",
}
const ESTADO_COLORES: Record<string, string> = {
  confirmada:  "bg-green-100 text-green-700 border-green-200",
  en_proceso:  "bg-cyan-100 text-cyan-700 border-cyan-200",
  completada:  "bg-blue-100 text-blue-700 border-blue-200",
  pendiente:   "bg-amber-100 text-amber-700 border-amber-200",
  cancelada:   "bg-red-100 text-red-700 border-red-200",
}

function formatFecha(d: Date) { return d.toISOString().split("T")[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── Página ─────────────────────────────────────────────────────────────────
export default function GroomerPage() {
  const { user, logout, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [avisoTimeout, setAvisoTimeout] = useState(false)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(formatFecha(new Date()))
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [idGroomer, setIdGroomer] = useState<number | null>(null)
  const [accionando, setAccionando] = useState<number | null>(null)
  
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [confirmandoEntrega, setConfirmandoEntrega] = useState<number | null>(null)

  // Calendario semanal
  const [vistaCalendario, setVistaCalendario] = useState(false)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [todasCitas, setTodasCitas] = useState<Cita[]>([])
  const [citasPorFecha, setCitasPorFecha] = useState<Record<string, Cita[]>>({})

  // Ficha técnica
  const [citaActiva, setCitaActiva] = useState<Cita | null>(null)
  const [idSesion, setIdSesion] = useState<number | null>(null)
  const [tab, setTab] = useState<"ficha"|"checklist"|"insumos">("ficha")
  const [cargandoSesion, setCargandoSesion] = useState(false)

  // Datos de la sesión
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [ficha, setFicha] = useState({
    estado_mascota: "relajado",
    nivel_estres: 1,
    condicion_pelaje: "bueno",
    condicion_piel: "normal",
    tipo_corte_realizado: "",
    foto_antes_url: "",
    foto_despues_url: "",
    recomendaciones_duenio: "",
    proxima_visita_sugerida: "",
  })
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [insumoForm, setInsumoForm] = useState({ id_producto: "", cantidad: "1", estado_producto: "lleno" })
  const [idSalaDefault, setIdSalaDefault] = useState<number | null>(null)
  const [cerrandoServicio, setCerrandoServicio] = useState(false)
  const [fichaGuardada, setFichaGuardada] = useState(false)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || !["groomer", "admin"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  // Obtener id_trabajador del groomer
  useEffect(() => {
    if (!user || user.rol !== "groomer") { if (user?.rol === "admin") setIdGroomer(null); return }
    fetch("/api/groomers/me", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.id_trabajador) setIdGroomer(d.id_trabajador) })
      .catch(() => {})
  }, [user, authHeaders])

  // Cargar sala de servicio por defecto
  useEffect(() => {
    if (!user) return
    fetch("/api/grooming/sala", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.id_sala_servicio) setIdSalaDefault(d.id_sala_servicio) })
      .catch(() => setIdSalaDefault(1))
  }, [user, authHeaders])

  const cargarTodasCitas = useCallback(async () => {
    if (!idGroomer && user?.rol !== "admin") return
    try {
      const params = new URLSearchParams()
      if (idGroomer) params.set("id_groomer", String(idGroomer))
      const res = await fetch(`/api/citas?${params}`, { headers: authHeaders() })
      const d = await res.json()
      const todas: Cita[] = d.citas || []
      setTodasCitas(todas)
      // Agrupar por fecha
      const agrup: Record<string, Cita[]> = {}
      todas.forEach(c => {
        const f = c.fecha_programada.slice(0, 10)
        if (!agrup[f]) agrup[f] = []
        agrup[f].push(c)
      })
      setCitasPorFecha(agrup)
    } catch {}
  }, [idGroomer, authHeaders, user])

  const cargarCitas = useCallback(async (fecha: string) => {
    setCargando(true); setError("")
    try {
      const params = new URLSearchParams({ fecha })
      if (idGroomer) params.set("id_groomer", String(idGroomer))
      const res = await fetch(`/api/citas?${params}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setCitas(d.citas || [])
    } catch (e: any) { setError(e.message || "Error al cargar citas") }
    finally { setCargando(false) }
  }, [idGroomer, authHeaders, user])

  useEffect(() => {
    if (user && (idGroomer !== undefined)) {
      cargarCitas(fechaSeleccionada)
      cargarTodasCitas()
    }
  }, [fechaSeleccionada, idGroomer, user])

  // Cargar productos para insumos
  useEffect(() => {
    if (!citaActiva) return
    fetch("/api/grooming/productos", { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setProductos(d.productos || []))
      .catch(() => {})
  }, [citaActiva, authHeaders])

  // Cargar datos de la sesión activa
  const cargarSesion = useCallback(async (idSes: number) => {
    setCargandoSesion(true)
    try {
      const res = await fetch(`/api/grooming/sesion/${idSes}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setChecklist(d.checklist || [])
      setInsumos(d.insumos || [])
      setEntregas(d.entregas || [])
      if (d.ficha) {
        setFicha({
          estado_mascota:        d.ficha.estado_mascota || "relajado",
          nivel_estres:          d.ficha.nivel_estres || 1,
          condicion_pelaje:      d.ficha.condicion_pelaje || "bueno",
          condicion_piel:        d.ficha.condicion_piel || "normal",
          tipo_corte_realizado:  d.ficha.tipo_corte_realizado || "",
          foto_antes_url:        d.ficha.foto_antes_url || "",
          foto_despues_url:      d.ficha.foto_despues_url || "",
          recomendaciones_duenio: d.ficha.recomendaciones_duenio || "",
          proxima_visita_sugerida: d.ficha.proxima_visita_sugerida?.slice(0,10) || "",
        })
        setFichaGuardada(true)
      }
    } catch (e: any) { setError(e.message) }
    finally { setCargandoSesion(false) }
  }, [authHeaders])

  // Iniciar sesión de grooming
  const iniciarSesion = async (cita: Cita) => {
    if (!idGroomer) { setError("No se encontró tu perfil de groomer"); return }
    setAccionando(cita.id_cita)
    try {
      const res = await fetch("/api/grooming/sesion", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ id_cita: cita.id_cita, id_trabajador_groomer: idGroomer }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      const idSes = d.id_sesion_grmm
      setIdSesion(idSes)
      setCitaActiva(cita)
      await cargarSesion(idSes)
      await cargarCitas(fechaSeleccionada)
    } catch (e: any) { setError(e.message) }
    finally { setAccionando(null) }
  }

  // Abrir sesión existente
  const abrirSesion = async (cita: Cita) => {
    if (!cita.id_sesion_grmm) return
    setCitaActiva(cita)
    setIdSesion(cita.id_sesion_grmm)
    await cargarSesion(cita.id_sesion_grmm)
  }

  // Guardar ficha
  const guardarFicha = async () => {
    if (!idSesion || !citaActiva) return
    setGuardandoFicha(true)
    try {
      const res = await fetch(`/api/grooming/sesion/${idSesion}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ accion: "guardar_ficha", id_mascota: citaActiva.id_mascota, ...ficha }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setFichaGuardada(true)
    } catch (e: any) { setError(e.message) }
    finally { setGuardandoFicha(false) }
  }

  // Toggle checklist
  const toggleChecklist = async (tarea: string, completada: boolean) => {
    if (!idSesion) return
    setChecklist(prev => prev.map(c => c.tarea === tarea ? { ...c, completada } : c))
    try {
      await fetch(`/api/grooming/sesion/${idSesion}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ accion: "checklist", tarea, completada }),
      })
    } catch (e: any) { setError(e.message) }
  }

  // Registrar insumo
  const registrarInsumo = async () => {
    if (!idSesion || !insumoForm.id_producto) { setError("Selecciona un producto"); return }
    const idSala = idSalaDefault || 1
    try {
      const res = await fetch(`/api/grooming/sesion/${idSesion}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({
          accion: "insumo",
          id_producto: Number(insumoForm.id_producto),
          id_sala_servicio: idSala,
          cantidad: Number(insumoForm.cantidad),
          estado_producto: insumoForm.estado_producto,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setInsumoForm({ id_producto: "", cantidad: "1", estado_producto: "lleno" })
      await cargarSesion(idSesion)
    } catch (e: any) { setError(e.message) }
  }

  // Cerrar servicio
  const cerrarServicio = async () => {
    if (!idSesion) return
    setCerrandoServicio(true); setError("")
    try {
      const res = await fetch(`/api/grooming/sesion/${idSesion}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ accion: "cerrar" }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setCitaActiva(null); setIdSesion(null); setFichaGuardada(false)
      setFicha({ estado_mascota: "relajado", nivel_estres: 1, condicion_pelaje: "bueno", condicion_piel: "normal", tipo_corte_realizado: "", foto_antes_url: "", foto_despues_url: "", recomendaciones_duenio: "", proxima_visita_sugerida: "" })
      await cargarCitas(fechaSeleccionada)
    } catch (e: any) { setError(e.message) }
    finally { setCerrandoServicio(false) }
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50">
      <PawPrint className="w-10 h-10 text-rose-400 animate-bounce" />
    </div>
  )

  const completadas = checklist.filter(c => c.completada).length
  const totalTareas = checklist.length
  const porcentaje  = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 0
  const hoy = new Date()
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(hoy, i - 3))

  // ── Vista de ficha técnica ────────────────────────────────────────────────
  if (citaActiva && idSesion) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

        {/* Header ficha */}
        <header className="sticky top-0 z-40 bg-gradient-to-r from-rose-600 to-pink-700 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={() => { setCitaActiva(null); setIdSesion(null) }} className="text-white/70 hover:text-white">
              <ChevronLeft size={22} />
            </button>
            <div className="text-center">
              <p className="text-white font-black">{citaActiva.nombre_mascota}</p>
              <p className="text-rose-200 text-xs">{citaActiva.nombre_servicio}</p>
            </div>
            {/* Progreso checklist */}
            <div className="text-right">
              <p className="text-white font-black text-sm">{porcentaje}%</p>
              <p className="text-rose-200 text-xs">{completadas}/{totalTareas}</p>
            </div>
          </div>
          {/* Barra de progreso */}
          <div className="h-1 bg-rose-800">
            <div className="h-1 bg-white transition-all duration-500" style={{ width: `${porcentaje}%` }} />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={16} /> {error}
              <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
            </div>
          )}

          {/* Info mascota */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-2xl">
                {citaActiva.especie === "perro" ? "🐶" : citaActiva.especie === "gato" ? "🐱" : "🐾"}
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-800">{citaActiva.nombre_mascota}</p>
                <p className="text-xs text-gray-500">{citaActiva.nombre_cliente} · {citaActiva.tamanio} · {citaActiva.especie}</p>
                {citaActiva.notas && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1">📝 {citaActiva.notas}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-black text-rose-700">{citaActiva.hora_programada?.slice(0,5)}</p>
                <p className="text-xs text-gray-400">{citaActiva.duracion_ajustada}min</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-white rounded-2xl border-2 border-gray-100 p-1">
            {[
              { key: "ficha", label: "📋 Ficha", icon: ClipboardList },
              { key: "checklist", label: "✅ Checklist", icon: CheckCircle },
              { key: "insumos", label: "📦 Insumos", icon: Package },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.key ? "bg-rose-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {cargandoSesion ? (
            <div className="bg-white rounded-2xl p-10 flex justify-center"><Loader2 className="animate-spin text-rose-400" size={24} /></div>
          ) : (
            <>
              {/* ── TAB FICHA ── */}
              {tab === "ficha" && (
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
                  <h3 className="font-black text-gray-800">Estado de ingreso</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Estado de la mascota</label>
                      <select value={ficha.estado_mascota}
                        onChange={e => setFicha(p => ({ ...p, estado_mascota: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                        <option value="relajado">😌 Relajado</option>
                        <option value="nervioso">😰 Nervioso</option>
                        <option value="estresado">😨 Estresado</option>
                        <option value="agresivo">😤 Agresivo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Nivel de estrés (1-10)</label>
                      <input type="range" min={1} max={10} value={ficha.nivel_estres}
                        onChange={e => setFicha(p => ({ ...p, nivel_estres: Number(e.target.value) }))}
                        className="w-full mt-2 accent-rose-600" />
                      <p className="text-center text-sm font-black text-rose-600">{ficha.nivel_estres}/10</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Condición del pelaje</label>
                      <select value={ficha.condicion_pelaje}
                        onChange={e => setFicha(p => ({ ...p, condicion_pelaje: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                        <option value="excelente">Excelente</option>
                        <option value="bueno">Bueno</option>
                        <option value="descuidado">Descuidado</option>
                        <option value="enredado">Enredado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Condición de la piel</label>
                      <select value={ficha.condicion_piel}
                        onChange={e => setFicha(p => ({ ...p, condicion_piel: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                        <option value="normal">Normal</option>
                        <option value="seca">Seca</option>
                        <option value="irritada">Irritada</option>
                        <option value="con_parasitos">Con parásitos</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de corte realizado</label>
                    <input type="text" placeholder="Ej: Corte higiénico, Corte de raza..."
                      value={ficha.tipo_corte_realizado}
                      onChange={e => setFicha(p => ({ ...p, tipo_corte_realizado: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FotoUpload
                      label="Foto ANTES del servicio"
                      urlActual={ficha.foto_antes_url}
                      onUpload={url => setFicha(p => ({ ...p, foto_antes_url: url }))}
                      folder="fichas/antes"
                    />
                    <FotoUpload
                      label="Foto DESPUÉS del servicio"
                      urlActual={ficha.foto_despues_url}
                      onUpload={url => setFicha(p => ({ ...p, foto_despues_url: url }))}
                      folder="fichas/despues"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Recomendaciones para el dueño</label>
                    <textarea rows={3} placeholder="Indicaciones de cuidado, próxima visita, productos recomendados..."
                      value={ficha.recomendaciones_duenio}
                      onChange={e => setFicha(p => ({ ...p, recomendaciones_duenio: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Próxima visita sugerida</label>
                    <input type="date" value={ficha.proxima_visita_sugerida}
                      onChange={e => setFicha(p => ({ ...p, proxima_visita_sugerida: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm"
                    />
                  </div>

                  <button onClick={guardarFicha} disabled={guardandoFicha}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                    {guardandoFicha ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {fichaGuardada ? "Actualizar ficha" : "Guardar ficha"}
                  </button>
                </div>
              )}

              {/* ── TAB CHECKLIST ── */}
              {tab === "checklist" && (
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-gray-800">Tareas del servicio</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${porcentaje === 100 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {completadas}/{totalTareas} completadas
                    </span>
                  </div>
                  {checklist.map(item => (
                    <label key={item.tarea}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${item.completada ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 hover:border-rose-200"}`}>
                      <input type="checkbox" checked={item.completada}
                        onChange={e => toggleChecklist(item.tarea, e.target.checked)}
                        className="accent-green-600 w-5 h-5 cursor-pointer" />
                      <span className={`font-bold text-sm flex-1 ${item.completada ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {TAREA_LABELS[item.tarea] || item.tarea}
                      </span>
                      {item.completada && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                    </label>
                  ))}
                  {checklist.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">No hay tareas en el checklist</p>
                  )}
                </div>
              )}

              {/* ── TAB INSUMOS ── */}
                {tab === "insumos" && (
          <div className="space-y-4">
        
            {/* ── SECCIÓN 7.1: Insumos recibidos de recepción ── */}
            <div className="bg-white rounded-2xl border-2 border-blue-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Package size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 text-sm">Insumos recibidos de recepción</h3>
                  <p className="text-xs text-gray-400">Autorizados antes de iniciar el servicio</p>
                </div>
              </div>
        
              {entregas.length === 0 ? (
                <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                  <p className="text-blue-600 text-xs font-semibold">
                    Recepción aún no ha registrado entregas para esta cita
                  </p>
                  <p className="text-blue-400 text-xs mt-1">
                    Espera a que recepción autorice los insumos antes de iniciar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entregas.map(e => {
                    const ESTADO_COLOR: Record<string, string> = {
                      entregado:    "bg-amber-50 border-amber-200 text-amber-700",
                      usado:        "bg-green-50 border-green-200 text-green-700",
                      devuelto:     "bg-blue-50 border-blue-200 text-blue-700",
                      desperdiciado:"bg-red-50 border-red-200 text-red-700",
                    }
                    const ESTADO_EMOJI: Record<string, string> = {
                      entregado: "📦", usado: "✅", devuelto: "↩️", desperdiciado: "⚠️"
                    }
                    const puedeConfirmar = e.estado === "entregado"
        
                    return (
                      <div key={e.id_entrega}
                        className={`rounded-xl border-2 px-4 py-3 transition-all ${ESTADO_COLOR[e.estado] || "bg-gray-50 border-gray-200 text-gray-600"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-black text-sm">
                              {ESTADO_EMOJI[e.estado]} {e.nombre_producto}
                            </p>
                            <p className="text-xs opacity-70 capitalize">{e.categoria}</p>
                            <p className="text-xs mt-0.5">
                              Cantidad: <span className="font-bold">{e.cantidad_entregada}</span>
                              {e.entregado_por && (
                                <span className="ml-2 opacity-60">· Por: {e.entregado_por}</span>
                              )}
                            </p>
                            {e.notas_entrega && (
                              <p className="text-xs opacity-60 mt-0.5">📝 {e.notas_entrega}</p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 capitalize shrink-0">
                            {e.estado}
                          </span>
                        </div>
        
                        {/* Botones de confirmación — solo si está en estado "entregado" */}
                        {puedeConfirmar && (
                          <div className="flex gap-1.5 mt-2">
                            {[
                              { estado: "usado",         label: "✅ Usado",        cls: "bg-green-600 hover:bg-green-700 text-white" },
                              { estado: "devuelto",      label: "↩️ Devolver",     cls: "bg-blue-600 hover:bg-blue-700 text-white" },
                              { estado: "desperdiciado", label: "⚠️ Desperdicio",  cls: "bg-red-500 hover:bg-red-600 text-white" },
                            ].map(btn => (
                              <button
                                key={btn.estado}
                                disabled={confirmandoEntrega === e.id_entrega}
                                onClick={async () => {
                                  setConfirmandoEntrega(e.id_entrega)
                                  try {
                                    const res = await fetch(`/api/grooming/sesion/${idSesion}`, {
                                      method: "PATCH", headers: authHeaders(),
                                      body: JSON.stringify({
                                        accion: "confirmar_entrega",
                                        id_entrega: e.id_entrega,
                                        estado: btn.estado,
                                      }),
                                    })
                                    const d = await res.json()
                                    if (!res.ok) throw new Error(d.message)
                                    // Recargar sesión para ver cambio
                                    if (idSesion) await cargarSesion(idSesion)
                                  } catch (err: any) {
                                    setError(err.message)
                                  } finally {
                                    setConfirmandoEntrega(null)
                                  }
                                }}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-1 ${btn.cls}`}
                              >
                                {confirmandoEntrega === e.id_entrega
                                  ? <Loader2 size={10} className="animate-spin" />
                                  : btn.label
                                }
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
        
                  {/* Resumen de estado de entregas */}
                  {entregas.length > 0 && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {["entregado","usado","devuelto","desperdiciado"].map(est => {
                        const n = entregas.filter(e => e.estado === est).length
                        if (!n) return null
                        return (
                          <span key={est} className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-1 rounded-full capitalize">
                            {n} {est}{n > 1 ? "s" : ""}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
        
            {/* ── SECCIÓN: Insumos usados en sesión (registro manual groomer) ── */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center">
                  <Plus size={16} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 text-sm">Registrar insumo adicional</h3>
                  <p className="text-xs text-gray-400">Productos extra no incluidos en la entrega</p>
                </div>
              </div>
        
              <select value={insumoForm.id_producto}
                onChange={e => setInsumoForm(p => ({ ...p, id_producto: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                <option value="">Selecciona producto</option>
                {productos.map(p => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre} ({p.categoria}) — Stock: {p.stock}
                  </option>
                ))}
              </select>
        
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Cantidad</label>
                  <input type="number" min={1} value={insumoForm.cantidad}
                    onChange={e => setInsumoForm(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Estado del envase</label>
                  <select value={insumoForm.estado_producto}
                    onChange={e => setInsumoForm(p => ({ ...p, estado_producto: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 outline-none text-sm bg-white">
                    <option value="lleno">Lleno</option>
                    <option value="medio_lleno">Medio lleno</option>
                    <option value="vacio">Vacío</option>
                  </select>
                </div>
              </div>
        
              <button onClick={registrarInsumo} disabled={!insumoForm.id_producto}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition">
                <Plus size={14} /> Registrar insumo adicional
              </button>
            </div>
        
            {/* Lista insumos usados manualmente */}
            {insumos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-gray-600 text-xs uppercase tracking-wide">
                  Insumos adicionales registrados ({insumos.length})
                </h3>
                {insumos.map((ins, i) => (
                  <div key={i} className="bg-white rounded-xl border-2 border-gray-100 px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{ins.nombre_producto}</p>
                      <p className="text-xs text-gray-400 capitalize">{ins.categoria}</p>
                    </div>
                    <span className="font-black text-rose-600">×{ins.cantidad_producto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}              
            </>
          )}

          {/* Botón cerrar servicio */}
          <div className="pt-2">
            {porcentaje < 100 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-amber-700 text-xs mb-3 flex items-center gap-2">
                <AlertTriangle size={14} /> Completa el checklist ({totalTareas - completadas} tareas pendientes) antes de finalizar
              </div>
            )}
            <button
              onClick={cerrarServicio}
              disabled={porcentaje < 100 || cerrandoServicio}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg"
            >
              {cerrandoServicio ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
              Finalizar servicio — Notificar cliente
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Vista agenda ─────────────────────────────────────────────────────────
  const confirmadas    = citas.filter(c => c.estado_reserva === "confirmada").length
  const enProceso      = citas.filter(c => c.estado_reserva === "en_proceso").length
  const completadasHoy = citas.filter(c => c.estado_reserva === "completada").length

  // Semana del calendario
  const hoyBase = new Date()
  const lunesSemana = new Date(hoyBase)
  lunesSemana.setDate(hoyBase.getDate() - ((hoyBase.getDay() + 6) % 7) + semanaOffset * 7)
  const diasSemanaCalendario = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunesSemana); d.setDate(lunesSemana.getDate() + i); return d
  })

  // Horas del día (09:00 a 18:00)
  const HORAS = Array.from({ length: 10 }, (_, i) => i + 9) // 9,10,...,18

  const ESTADO_BG: Record<string, string> = {
    confirmada:  "bg-green-500",
    en_proceso:  "bg-cyan-500",
    completada:  "bg-blue-400",
    pendiente:   "bg-amber-400",
    cancelada:   "bg-red-300",
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {avisoTimeout && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18} />
          <span className="font-semibold text-sm">Sesión expirará en 1 minuto.</span>
          <button onClick={() => setAvisoTimeout(false)} className="underline text-sm">Continuar</button>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-rose-600 to-pink-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-white" />
            <span className="text-white font-black text-lg">Mi <span className="text-rose-200">Agenda</span></span>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle vista */}
            <div className="flex items-center bg-white/20 rounded-xl p-1">
              <button onClick={() => setVistaCalendario(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!vistaCalendario ? "bg-white text-rose-600 shadow" : "text-white/70 hover:text-white"}`}>
                <List size={14} /> Lista
              </button>
              <button onClick={() => { setVistaCalendario(true); cargarTodasCitas() }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${vistaCalendario ? "bg-white text-rose-600 shadow" : "text-white/70 hover:text-white"}`}>
                <LayoutGrid size={14} /> Calendario
              </button>
            </div>
            <button onClick={() => router.push("/groomer/reportes")}
  className="text-white/70 hover:text-white transition-colors">
  <BarChart3 size={18}/>
</button>
            <span className="text-white/80 text-sm font-medium hidden sm:block">{user.nombre}</span>            
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white"><LogOut size={18} /></button>
            
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Stats */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl p-5 text-white">
          <h1 className="text-xl font-black mb-1">Hola, {user.nombre} ✂️</h1>
          <p className="text-rose-100 text-xs mb-4">
            {vistaCalendario ? "Semana del " + diasSemanaCalendario[0].toLocaleDateString("es-BO", { day:"numeric", month:"short" }) + " al " + diasSemanaCalendario[6].toLocaleDateString("es-BO", { day:"numeric", month:"short" }) : "Tu agenda de hoy"}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black">{confirmadas}</p>
              <p className="text-xs text-rose-100">Confirmadas</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-cyan-300">{enProceso}</p>
              <p className="text-xs text-rose-100">En proceso</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-green-300">{completadasHoy}</p>
              <p className="text-xs text-rose-100">Completadas</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── VISTA CALENDARIO SEMANAL ── */}
        {vistaCalendario ? (
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
            {/* Nav semana */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button onClick={() => setSemanaOffset(s => s - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition">
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <p className="font-black text-gray-800 text-sm">
                  {diasSemanaCalendario[0].toLocaleDateString("es-BO", { day:"numeric", month:"long" })} –{" "}
                  {diasSemanaCalendario[6].toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" })}
                </p>
                {semanaOffset !== 0 && (
                  <button onClick={() => setSemanaOffset(0)} className="text-xs text-rose-500 hover:underline font-semibold">
                    Volver a hoy
                  </button>
                )}
              </div>
              <button onClick={() => setSemanaOffset(s => s + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Cabecera días */}
            <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
              <div className="py-2 border-r border-gray-100" />
              {diasSemanaCalendario.map((d, i) => {
                const f = formatFecha(d)
                const esHoy = f === formatFecha(new Date())
                const nCitas = (citasPorFecha[f] || []).length
                return (
                  <div key={f} className={`py-2 text-center border-r border-gray-100 last:border-r-0 ${esHoy ? "bg-rose-50" : ""}`}>
                    <p className={`text-[10px] font-bold uppercase ${esHoy ? "text-rose-500" : "text-gray-400"}`}>
                      {d.toLocaleDateString("es-BO", { weekday: "short" })}
                    </p>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black mx-auto ${esHoy ? "bg-rose-600 text-white" : "text-gray-700"}`}>
                      {d.getDate()}
                    </div>
                    {nCitas > 0 && (
                      <div className="flex justify-center gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(nCitas, 3) }).map((_, j) => (
                          <span key={j} className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Grid horas */}
            <div className="overflow-y-auto max-h-[600px]">
              {HORAS.map(hora => (
                <div key={hora} className="grid border-b border-gray-50 min-h-[64px]"
                  style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                  {/* Label hora */}
                  <div className="px-2 py-1 text-[10px] text-gray-400 font-bold border-r border-gray-100 text-right pt-2">
                    {String(hora).padStart(2,"0")}:00
                  </div>
                  {/* Celdas por día */}
                  {diasSemanaCalendario.map((d) => {
                    const f = formatFecha(d)
                    const esHoy = f === formatFecha(new Date())
                    const citasHora = (citasPorFecha[f] || []).filter(c => {
                      const h = parseInt(c.hora_programada?.slice(0,2) || "0")
                      return h === hora
                    })
                    return (
                      <div key={f} className={`border-r border-gray-50 last:border-r-0 p-0.5 relative ${esHoy ? "bg-rose-50/40" : ""}`}>
                        {citasHora.map(cita => (
                          <button key={cita.id_cita}
                            onClick={() => {
                              setFechaSeleccionada(f)
                              setVistaCalendario(false)
                              cargarCitas(f)
                            }}
                            className={`w-full text-left rounded-lg p-1.5 mb-0.5 text-white text-[10px] font-bold leading-tight transition hover:opacity-90 hover:scale-[1.02] ${ESTADO_BG[cita.estado_reserva] || "bg-gray-400"}`}
                          >
                            <p className="truncate">{cita.hora_programada?.slice(0,5)} {cita.nombre_mascota}</p>
                            <p className="truncate opacity-80 font-normal">{cita.nombre_servicio}</p>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-100 flex-wrap">
              {[
                { color: "bg-green-500", label: "Confirmada" },
                { color: "bg-cyan-500",  label: "En proceso" },
                { color: "bg-blue-400",  label: "Completada" },
                { color: "bg-amber-400", label: "Pendiente" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`w-3 h-3 rounded-full ${color}`} /> {label}
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-auto">Clic en una cita para ver detalles</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── VISTA LISTA ── */}
            {/* Selector de fecha */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-gray-800 text-sm">Día</h2>
                <button onClick={() => { cargarCitas(fechaSeleccionada); cargarTodasCitas() }} className="text-rose-500 hover:text-rose-700"><RefreshCw size={16} /></button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 3)).map(d => {
                  const f = formatFecha(d)
                  const esHoy = f === formatFecha(new Date())
                  const esDom = d.getDay() === 0
                  const nCitas = (citasPorFecha[f] || []).length
                  return (
                    <button key={f} onClick={() => { setFechaSeleccionada(f); cargarCitas(f) }} disabled={esDom}
                      className={`flex flex-col items-center min-w-[52px] py-2 px-1.5 rounded-xl border-2 text-center transition-all relative ${esDom ? "opacity-30 cursor-not-allowed" : ""} ${fechaSeleccionada === f ? "border-rose-500 bg-rose-50" : "border-gray-200 hover:border-rose-300"}`}>
                      <span className={`text-[10px] font-bold uppercase ${fechaSeleccionada === f ? "text-rose-500" : "text-gray-400"}`}>
                        {d.toLocaleDateString("es-BO", { weekday: "short" })}
                      </span>
                      <span className={`text-lg font-black ${fechaSeleccionada === f ? "text-rose-700" : "text-gray-700"}`}>{d.getDate()}</span>
                      {esHoy && <span className="text-[9px] text-rose-500 font-bold">Hoy</span>}
                      {nCitas > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {Array.from({ length: Math.min(nCitas, 3) }).map((_, j) => (
                            <span key={j} className={`w-1.5 h-1.5 rounded-full ${fechaSeleccionada === f ? "bg-rose-500" : "bg-rose-300"}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Lista citas del día */}
            <div className="space-y-3">
              {cargando ? (
                <div className="bg-white rounded-2xl p-10 flex items-center justify-center gap-3 text-rose-400">
                  <Loader2 className="animate-spin" size={22} />
                  <span className="font-semibold text-sm">Cargando agenda...</span>
                </div>
              ) : citas.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-semibold">Sin citas asignadas este día</p>
                  <button onClick={() => { setVistaCalendario(true); cargarTodasCitas() }}
                    className="mt-3 text-rose-500 text-sm font-bold hover:underline flex items-center gap-1 mx-auto">
                    <LayoutGrid size={14} /> Ver calendario semanal
                  </button>
                </div>
              ) : (
                citas.sort((a, b) => a.hora_programada.localeCompare(b.hora_programada)).map(cita => (
                  <div key={cita.id_cita} className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                          {cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"}
                        </div>
                        <div>
                          <p className="font-black text-gray-800">{cita.nombre_mascota}</p>
                          <p className="text-xs text-gray-500">{cita.nombre_cliente} · {cita.tamanio}</p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border capitalize ${ESTADO_COLORES[cita.estado_reserva] || "bg-gray-100 text-gray-500"}`}>
                        {cita.estado_reserva}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1.5"><Scissors size={12} className="text-rose-400" />{cita.nombre_servicio}</span>
                      <span className="flex items-center gap-1.5"><Clock size={12} className="text-rose-400" />{cita.hora_programada?.slice(0,5)} · {cita.duracion_ajustada}min</span>
                    </div>
                    {cita.notas && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">📝 {cita.notas}</p>
                    )}
                    <div className="flex gap-2">
                      {cita.estado_reserva === "confirmada" && (
                        <button onClick={() => iniciarSesion(cita)} disabled={!!accionando}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                          {accionando === cita.id_cita ? <Loader2 size={14} className="animate-spin" /> : "🐾"}
                          Iniciar servicio
                        </button>
                      )}
                      {cita.estado_reserva === "en_proceso" && (
                        <button onClick={() => abrirSesion(cita)}
                          className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition">
                          <ClipboardList size={14} /> Continuar ficha
                        </button>
                      )}
                      {cita.estado_reserva === "completada" && (
                        <div className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl text-sm text-center">
                          ✅ Servicio completado
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}