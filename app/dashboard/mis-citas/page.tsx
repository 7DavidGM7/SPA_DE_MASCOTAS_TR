"use client"
// app/dashboard/mis-citas/page.tsx
// Parcial 3: El cliente ve sus citas con estado actualizado en tiempo real

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Calendar, Clock, ChevronLeft, PawPrint, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronRight
} from "lucide-react"

interface Cita {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
  nombre_mascota: string
  especie: string
  nombre_servicio: string
  duracion_ajustada: number
  precio_calculado: number
  nombre_groomer: string | null
  notas: string | null
  fecha_creacion: string
}

const ESTADO_INFO: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  pendiente:    { label: "En revisión",  color: "bg-amber-100 text-amber-700 border-amber-200",   icon: "⏳", desc: "Recepción revisará tu solicitud pronto" },
  confirmada:   { label: "Confirmada",   color: "bg-green-100 text-green-700 border-green-200",   icon: "✅", desc: "Tu cita está confirmada" },
  en_proceso:   { label: "En proceso",   color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: "🐾", desc: "Tu mascota está siendo atendida" },
  completada:   { label: "Completada",   color: "bg-blue-100 text-blue-700 border-blue-200",      icon: "🎉", desc: "Servicio finalizado, puedes recoger a tu mascota" },
  cancelada:    { label: "Cancelada",    color: "bg-red-100 text-red-700 border-red-200",         icon: "❌", desc: "Esta cita fue cancelada" },
  reprogramada: { label: "Reprogramada", color: "bg-purple-100 text-purple-700 border-purple-200",icon: "📅", desc: "Tu cita fue reprogramada" },
  no_asistio:   { label: "No asistió",   color: "bg-gray-100 text-gray-500 border-gray-200",     icon: "😔", desc: "No se registró asistencia" },
}

function formatFechaLegible(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-BO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })
}

export default function MisCitasPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [filtro, setFiltro] = useState<"proximas" | "historial">("proximas")
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [citaCancelar, setCitaCancelar] = useState<Cita | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState("")
  const [aceptaTerminos, setAceptaTerminos] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.push("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargarCitas = useCallback(async () => {
    setCargando(true)
    setError("")
    try {
      const res = await fetch("/api/citas", { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setCitas(d.citas || [])
    } catch (e: any) {
      setError(e.message || "Error al cargar citas")
    } finally {
      setCargando(false)
    }
  }, [authHeaders])

  useEffect(() => {
    if (user) cargarCitas()
  }, [user, cargarCitas])

  // Cancelar cita con motivo
  const cancelarCita = async () => {
    if (!citaCancelar || !motivoCancelacion || !aceptaTerminos) return
    setCancelando(citaCancelar.id_cita)
    try {
      const res = await fetch(`/api/citas/${citaCancelar.id_cita}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          estado_reserva: "cancelada",
          motivo_cancelacion: motivoCancelacion,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setCitaCancelar(null)
      setMotivoCancelacion("")
      setAceptaTerminos(false)
      await cargarCitas()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCancelando(null)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-violet-50">
        <PawPrint className="w-10 h-10 text-violet-400 animate-bounce" />
      </div>
    )
  }

  const hoy = new Date().toISOString().split("T")[0]
  const proximas = citas.filter(c =>
    c.fecha_programada >= hoy && !["cancelada", "completada", "no_asistio"].includes(c.estado_reserva)
  )
  const historial = citas.filter(c =>
    c.fecha_programada < hoy || ["cancelada", "completada", "no_asistio"].includes(c.estado_reserva)
  )
  const citasMostradas = filtro === "proximas" ? proximas : historial

  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Modal cancelación */}
      {citaCancelar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-black text-gray-800 text-lg mb-1">Cancelar cita</h3>
            <p className="text-sm text-gray-500 mb-4">
              {citaCancelar.nombre_mascota} · {citaCancelar.nombre_servicio} · {formatFechaLegible(citaCancelar.fecha_programada)}
            </p>

            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-600 mb-1">Motivo de cancelación *</label>
              <select
                value={motivoCancelacion}
                onChange={e => setMotivoCancelacion(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm bg-white"
              >
                <option value="">Selecciona un motivo</option>
                <option value="Salud de la mascota">Salud de la mascota</option>
                <option value="Emergencia personal">Emergencia personal</option>
                <option value="Falta de tiempo">Falta de tiempo</option>
                <option value="Error al agendar">Error al agendar</option>
                <option value="Otros">Otros</option>
              </select>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
              ⚠️ Solo puedes cancelar con al menos <strong>24 horas de anticipación</strong>.
            </div>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={aceptaTerminos}
                onChange={e => setAceptaTerminos(e.target.checked)}
                className="mt-0.5 accent-violet-600" />
              <span className="text-xs text-gray-600">
                Entiendo la política de cancelación y acepto que esta acción no se puede deshacer.
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs mb-3 flex items-center gap-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setCitaCancelar(null); setError(""); setMotivoCancelacion(""); setAceptaTerminos(false) }}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Volver
              </button>
              <button
                onClick={cancelarCita}
                disabled={!motivoCancelacion || !aceptaTerminos || !!cancelando}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {cancelando ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 to-purple-800 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-white/70 hover:text-white transition">
            <ChevronLeft size={22} />
          </button>
          <PawPrint className="w-5 h-5 text-purple-300" />
          <span className="text-white font-black text-lg">Mis citas</span>
          <button onClick={cargarCitas} className="ml-auto text-white/70 hover:text-white transition">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl border-2 border-gray-100 p-1">
          {[
            { key: "proximas", label: `Próximas (${proximas.length})` },
            { key: "historial", label: `Historial (${historial.length})` },
          ].map(t => (
            <button key={t.key}
              onClick={() => setFiltro(t.key as any)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${filtro === t.key ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && !citaCancelar && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Lista */}
        {cargando ? (
          <div className="bg-white rounded-2xl p-10 flex items-center justify-center gap-3 text-violet-500">
            <Loader2 className="animate-spin" size={22} />
            <span className="font-semibold text-sm">Cargando...</span>
          </div>
        ) : citasMostradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">
              {filtro === "proximas" ? "No tienes citas próximas" : "Sin historial de citas"}
            </p>
            {filtro === "proximas" && (
              <button onClick={() => router.push("/dashboard/agendar")}
                className="mt-3 text-violet-600 text-sm font-bold hover:underline">
                Agendar ahora →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {citasMostradas
              .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))
              .map(cita => {
                const info = ESTADO_INFO[cita.estado_reserva] || ESTADO_INFO.pendiente
                const puedeCancelar = ["pendiente", "confirmada"].includes(cita.estado_reserva)
                  && cita.fecha_programada >= hoy

                return (
                  <div key={cita.id_cita}
                    className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-3">

                    {/* Header tarjeta */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-black text-gray-800">
                          {cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"} {cita.nombre_mascota}
                        </p>
                        <p className="text-sm text-gray-500">{cita.nombre_servicio}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${info.color}`}>
                        {info.icon} {info.label}
                      </span>
                    </div>

                    {/* Descripción del estado */}
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      {info.desc}
                    </p>

                    {/* Detalles */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar size={12} className="text-violet-400" />
                        <span className="capitalize">{formatFechaLegible(cita.fecha_programada)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock size={12} className="text-violet-400" />
                        <span>{cita.hora_programada?.slice(0, 5)} · {cita.duracion_ajustada}min</span>
                      </div>
                    </div>

                    {cita.nombre_groomer && (
                      <p className="text-xs text-teal-600 font-semibold">✂️ Groomer: {cita.nombre_groomer}</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-black text-violet-700">Bs. {Number(cita.precio_calculado ?? 0).toFixed(2)}</span>
                      {puedeCancelar && (
                        <button
                          onClick={() => { setCitaCancelar(cita); setError("") }}
                          className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 hover:underline"
                        >
                          <XCircle size={13} /> Cancelar cita
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* Botón agendar nueva */}
        <button
          onClick={() => router.push("/dashboard/agendar")}
          className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-black rounded-2xl hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          <Calendar size={18} /> Agendar nueva cita
        </button>
      </main>
    </div>
  )
}