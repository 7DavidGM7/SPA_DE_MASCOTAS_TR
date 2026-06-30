"use client"
// app/recepcion/horario/page.tsx
// UI para gestionar horario del spa, feriados y bloqueos

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Calendar, Clock, ChevronLeft, Plus, Trash2,
  Save, AlertCircle, CheckCircle, Loader2, Lock, PawPrint
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface HorarioDia {
  id_horario: number
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  capacidad_max: number
  activo: boolean
}

interface Feriado {
  id_feriado: number
  fecha: string
  nombre: string
  descripcion: string | null
  es_recuperable: boolean
}

interface Bloqueo {
  id_bloqueo: number
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  motivo: string
  descripcion: string | null
  nombre_groomer: string | null
}

const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
const DIAS_SHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
const MOTIVOS = ["mantenimiento","ausencia","emergencia","otros"]

// ── Página principal ───────────────────────────────────────────────────────
export default function HorarioPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<"horario"|"feriados"|"bloqueos">("horario")
  const [horario, setHorario]   = useState<HorarioDia[]>([])
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]   = useState("")
  const [exito, setExito]   = useState("")

  // Form feriado
  const [formFeriado, setFormFeriado] = useState({ fecha: "", nombre: "", descripcion: "", es_recuperable: false })
  // Form bloqueo
  const [formBloqueo, setFormBloqueo] = useState({
    fecha: "", hora_inicio: "", hora_fin: "",
    motivo: "mantenimiento", descripcion: "", id_trabajador_groomer: ""
  })
  // Edición de horario inline
  const [horarioEditado, setHorarioEditado] = useState<Record<number, Partial<HorarioDia>>>({})

  useEffect(() => {
    if (!isLoading && (!user || !["admin","recepcionista"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const mostrarExito = (msg: string) => {
    setExito(msg); setTimeout(() => setExito(""), 3000)
  }

  // ── Cargar datos ───────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true); setError("")
    try {
      const res = await fetch("/api/admin/horario", { headers: authHeaders() })
      const d = await res.json()
      setHorario(d.horario || [])
      setFeriados(d.feriados || [])
      setBloqueos(d.bloqueos || [])
    } catch { setError("Error al cargar datos") }
    finally { setCargando(false) }
  }, [authHeaders])

  useEffect(() => { if (user) cargarDatos() }, [user, cargarDatos])

  // ── Guardar horario ────────────────────────────────────────────────────
  const guardarHorario = async (dia: HorarioDia) => {
    const cambios = horarioEditado[dia.dia_semana] || {}
    const datos = { ...dia, ...cambios }
    setGuardando(true); setError("")
    try {
      const res = await fetch("/api/admin/horario", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          dia_semana:    datos.dia_semana,
          hora_inicio:   datos.hora_inicio,
          hora_fin:      datos.hora_fin,
          capacidad_max: datos.capacidad_max,
          activo:        datos.activo,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExito("Horario actualizado")
      setHorarioEditado(prev => { const n = {...prev}; delete n[dia.dia_semana]; return n })
      await cargarDatos()
    } catch (e: any) { setError(e.message) }
    finally { setGuardando(false) }
  }

  // ── Crear feriado ──────────────────────────────────────────────────────
  const crearFeriado = async () => {
    if (!formFeriado.fecha || !formFeriado.nombre) {
      setError("Fecha y nombre son requeridos"); return
    }
    setGuardando(true); setError("")
    try {
      const res = await fetch("/api/admin/feriados", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(formFeriado),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExito("Feriado registrado")
      setFormFeriado({ fecha: "", nombre: "", descripcion: "", es_recuperable: false })
      await cargarDatos()
    } catch (e: any) { setError(e.message) }
    finally { setGuardando(false) }
  }

  // ── Eliminar feriado ───────────────────────────────────────────────────
  const eliminarFeriado = async (id: number) => {
    if (!confirm("¿Eliminar este feriado?")) return
    try {
      const res = await fetch(`/api/admin/feriados/${id}`, {
        method: "DELETE", headers: authHeaders()
      })
      if (!res.ok) throw new Error("Error al eliminar")
      mostrarExito("Feriado eliminado")
      await cargarDatos()
    } catch (e: any) { setError(e.message) }
  }

  // ── Crear bloqueo ──────────────────────────────────────────────────────
  const crearBloqueo = async () => {
    if (!formBloqueo.fecha || !formBloqueo.motivo) {
      setError("Fecha y motivo son requeridos"); return
    }
    setGuardando(true); setError("")
    try {
      const res = await fetch("/api/admin/bloqueos", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          ...formBloqueo,
          hora_inicio: formBloqueo.hora_inicio || null,
          hora_fin:    formBloqueo.hora_fin || null,
          id_trabajador_groomer: formBloqueo.id_trabajador_groomer || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExito("Bloqueo registrado")
      setFormBloqueo({ fecha: "", hora_inicio: "", hora_fin: "", motivo: "mantenimiento", descripcion: "", id_trabajador_groomer: "" })
      await cargarDatos()
    } catch (e: any) { setError(e.message) }
    finally { setGuardando(false) }
  }

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <PawPrint className="w-10 h-10 text-teal-400 animate-bounce" />
    </div>
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-emerald-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => router.push("/recepcion")} className="text-white/70 hover:text-white transition">
            <ChevronLeft size={22} />
          </button>
          <Lock className="w-5 h-5 text-teal-200" />
          <span className="text-white font-black text-lg">Gestión de horarios</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Alertas */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {exito && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> {exito}
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl border-2 border-gray-100 p-1">
          {[
            { key: "horario",   label: "🕐 Horario semanal" },
            { key: "feriados",  label: "📅 Feriados" },
            { key: "bloqueos",  label: "🔒 Bloqueos" },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setTab(t.key as any); setError("") }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.key ? "bg-teal-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB HORARIO ── */}
        {tab === "horario" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Configura el horario de atención del spa por día de la semana.</p>

            {cargando ? (
              <div className="bg-white rounded-2xl p-10 flex justify-center">
                <Loader2 className="animate-spin text-teal-500" size={24} />
              </div>
            ) : (
              horario.map(dia => {
                const edit = horarioEditado[dia.dia_semana] || {}
                const val  = { ...dia, ...edit }
                const modificado = Object.keys(edit).length > 0

                return (
                  <div key={dia.dia_semana}
                    className={`bg-white rounded-2xl border-2 p-4 transition-all ${modificado ? "border-teal-300" : "border-gray-100"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center font-black text-sm">
                          {DIAS_SHORT[dia.dia_semana]}
                        </span>
                        <span className="font-black text-gray-800">{DIAS[dia.dia_semana]}</span>
                      </div>
                      {/* Toggle activo */}
                      <button
                        onClick={() => setHorarioEditado(prev => ({
                          ...prev,
                          [dia.dia_semana]: { ...prev[dia.dia_semana], activo: !val.activo }
                        }))}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border-2 transition ${val.activo ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                      >
                        {val.activo ? "Abierto" : "Cerrado"}
                      </button>
                    </div>

                    {val.activo && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Apertura</label>
                          <input type="time" value={val.hora_inicio?.slice(0,5) || ""}
                            onChange={e => setHorarioEditado(prev => ({
                              ...prev, [dia.dia_semana]: { ...prev[dia.dia_semana], hora_inicio: e.target.value }
                            }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Cierre</label>
                          <input type="time" value={val.hora_fin?.slice(0,5) || ""}
                            onChange={e => setHorarioEditado(prev => ({
                              ...prev, [dia.dia_semana]: { ...prev[dia.dia_semana], hora_fin: e.target.value }
                            }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Cap. máx.</label>
                          <input type="number" min={1} max={20} value={val.capacidad_max || ""}
                            onChange={e => setHorarioEditado(prev => ({
                              ...prev, [dia.dia_semana]: { ...prev[dia.dia_semana], capacidad_max: Number(e.target.value) }
                            }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {modificado && (
                      <button
                        onClick={() => guardarHorario(dia)}
                        disabled={guardando}
                        className="mt-3 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition"
                      >
                        {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar cambios
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── TAB FERIADOS ── */}
        {tab === "feriados" && (
          <div className="space-y-4">
            {/* Formulario nuevo feriado */}
            <div className="bg-white rounded-2xl border-2 border-teal-100 p-5 space-y-3">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Plus size={16} className="text-teal-600" /> Agregar feriado
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Fecha *</label>
                  <input type="date" value={formFeriado.fecha}
                    onChange={e => setFormFeriado(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nombre *</label>
                  <input type="text" placeholder="Ej: Día del Trabajo"
                    value={formFeriado.nombre}
                    onChange={e => setFormFeriado(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Descripción (opcional)</label>
                <input type="text" placeholder="Observaciones adicionales"
                  value={formFeriado.descripcion}
                  onChange={e => setFormFeriado(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formFeriado.es_recuperable}
                  onChange={e => setFormFeriado(p => ({ ...p, es_recuperable: e.target.checked }))}
                  className="accent-teal-600" />
                <span className="text-sm text-gray-600 font-semibold">Es recuperable (se puede agendar igual)</span>
              </label>
              <button onClick={crearFeriado} disabled={guardando}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Registrar feriado
              </button>
            </div>

            {/* Lista de feriados */}
            <div className="space-y-2">
              {cargando ? (
                <div className="bg-white rounded-2xl p-8 flex justify-center">
                  <Loader2 className="animate-spin text-teal-500" size={22} />
                </div>
              ) : feriados.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                  <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-semibold">No hay feriados registrados</p>
                </div>
              ) : feriados.map(f => (
                <div key={f.id_feriado}
                  className="bg-white rounded-2xl border-2 border-gray-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-black text-gray-800 text-sm">{f.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
                      {f.es_recuperable && <span className="ml-2 text-green-600 font-semibold">· Recuperable</span>}
                    </p>
                  </div>
                  <button onClick={() => eliminarFeriado(f.id_feriado)}
                    className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB BLOQUEOS ── */}
        {tab === "bloqueos" && (
          <div className="space-y-4">
            {/* Formulario nuevo bloqueo */}
            <div className="bg-white rounded-2xl border-2 border-orange-100 p-5 space-y-3">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Lock size={16} className="text-orange-500" /> Crear bloqueo de horario
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Fecha *</label>
                  <input type="date" value={formBloqueo.fecha}
                    onChange={e => setFormBloqueo(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Motivo *</label>
                  <select value={formBloqueo.motivo}
                    onChange={e => setFormBloqueo(p => ({ ...p, motivo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm bg-white">
                    {MOTIVOS.map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Hora inicio <span className="text-gray-400 font-normal">(vacío = día completo)</span>
                  </label>
                  <input type="time" value={formBloqueo.hora_inicio}
                    onChange={e => setFormBloqueo(p => ({ ...p, hora_inicio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Hora fin</label>
                  <input type="time" value={formBloqueo.hora_fin}
                    onChange={e => setFormBloqueo(p => ({ ...p, hora_fin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Descripción</label>
                <input type="text" placeholder="Ej: Mantenimiento de instalaciones"
                  value={formBloqueo.descripcion}
                  onChange={e => setFormBloqueo(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                ⚠️ Si hay citas activas en esa fecha/hora, el sistema te avisará antes de bloquear.
              </div>

              <button onClick={crearBloqueo} disabled={guardando}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Crear bloqueo
              </button>
            </div>

            {/* Lista de bloqueos */}
            <div className="space-y-2">
              {cargando ? (
                <div className="bg-white rounded-2xl p-8 flex justify-center">
                  <Loader2 className="animate-spin text-orange-400" size={22} />
                </div>
              ) : bloqueos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                  <Lock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-semibold">No hay bloqueos activos</p>
                </div>
              ) : bloqueos.map(b => (
                <div key={b.id_bloqueo}
                  className="bg-white rounded-2xl border-2 border-orange-100 px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-gray-800 text-sm capitalize">{b.motivo}
                        {b.nombre_groomer && <span className="text-gray-400 font-normal text-xs ml-2">· {b.nombre_groomer}</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(b.fecha + "T00:00:00").toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" })}
                        {b.hora_inicio ? ` · ${b.hora_inicio.slice(0,5)} – ${b.hora_fin?.slice(0,5)}` : " · Día completo"}
                      </p>
                      {b.descripcion && <p className="text-xs text-gray-400 mt-0.5">{b.descripcion}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-orange-100 text-orange-700 rounded-full capitalize">
                      {b.motivo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}