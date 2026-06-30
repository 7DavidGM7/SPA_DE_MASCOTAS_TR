"use client"

// components/NotificacionesCampana.tsx
import { useState, useEffect, useCallback, useRef } from "react"
import { Bell, X, CheckCheck, BellOff, Clock } from "lucide-react"

interface Notificacion {
  id_notificacion: number
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  canal: string
  whatsapp_enviado: boolean
  entidad: string | null
  entidad_id: number | null
  created_at: string
}

const TIPO_EMOJI: Record<string, string> = {
  cita_solicitada:  "📋",
  cita_confirmada:  "✅",
  cita_cancelada:   "❌",
  recordatorio_24h: "⏰",
  recordatorio_2h:  "🔔",
  grooming_listo:   "🎉",
  pago_registrado:  "💳",
  bajo_stock:       "⚠️",
}

const TIPO_COLOR: Record<string, string> = {
  cita_solicitada:  "border-l-blue-400",
  cita_confirmada:  "border-l-green-400",
  cita_cancelada:   "border-l-red-400",
  recordatorio_24h: "border-l-amber-400",
  recordatorio_2h:  "border-l-orange-400",
  grooming_listo:   "border-l-purple-400",
  pago_registrado:  "border-l-teal-400",
  bajo_stock:       "border-l-red-500",
}

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return "Ahora mismo"
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)  return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

export default function NotificacionesCampana({
  accessToken,
}: {
  accessToken: string | null
}) {
  const [abierto, setAbierto]               = useState(false)
  const [notifs, setNotifs]                 = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas]             = useState(0)
  const [cargando, setCargando]             = useState(false)
  const panelRef                            = useRef<HTMLDivElement>(null)

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  // Cargar notificaciones
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    try {
      const res = await fetch("/api/notificaciones?limite=30", { headers: authHeaders() })
      if (!res.ok) return
      const d = await res.json()
      setNotifs(d.notificaciones ?? [])
      setNoLeidas(d.no_leidas ?? 0)
    } catch { /* silencioso */ } finally {
      if (!silencioso) setCargando(false)
    }
  }, [authHeaders])

  // Polling cada 30 segundos
  useEffect(() => {
    cargar()
    const interval = setInterval(() => cargar(true), 30_000)
    return () => clearInterval(interval)
  }, [cargar])

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setAbierto(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Al abrir — cargar fresh
  const toggleAbierto = () => {
    if (!abierto) cargar()
    setAbierto(v => !v)
  }

  // Marcar todas como leídas
  const marcarTodas = async () => {
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ todas: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    setNoLeidas(0)
  }

  // Marcar una como leída
  const marcarUna = async (id: number) => {
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifs(prev => prev.map(n => n.id_notificacion === id ? { ...n, leida: true } : n))
    setNoLeidas(prev => Math.max(0, prev - 1))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <button
        onClick={toggleAbierto}
        className="relative text-white/80 hover:text-white transition-colors p-1"
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 rounded-full text-[9px] font-black flex items-center justify-center text-white px-0.5 animate-pulse">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {abierto && (
        <div className="absolute right-0 top-9 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

          {/* Header panel */}
          <div className="flex items-center justify-between px-4 py-3 bg-violet-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-violet-600" />
              <span className="font-black text-gray-800 text-sm">Notificaciones</span>
              {noLeidas > 0 && (
                <span className="bg-violet-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {noLeidas} nueva{noLeidas > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {noLeidas > 0 && (
                <button
                  onClick={marcarTodas}
                  className="text-xs text-violet-600 font-bold hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Marcar todas
                </button>
              )}
              <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {cargando ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BellOff className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm font-semibold">Sin notificaciones</p>
                <p className="text-gray-400 text-xs mt-1">Te avisaremos sobre tus citas y pedidos</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id_notificacion}
                  onClick={() => !n.leida && marcarUna(n.id_notificacion)}
                  className={`px-4 py-3 border-l-4 cursor-pointer transition-colors ${
                    TIPO_COLOR[n.tipo] ?? "border-l-gray-300"
                  } ${n.leida ? "bg-white" : "bg-violet-50/40 hover:bg-violet-50"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{TIPO_EMOJI[n.tipo] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${n.leida ? "font-semibold text-gray-700" : "font-black text-gray-800"}`}>
                          {n.titulo}
                        </p>
                        {!n.leida && (
                          <div className="w-2 h-2 bg-violet-500 rounded-full shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.mensaje}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Clock size={9} /> {tiempoRelativo(n.created_at)}
                        </span>
                        {n.whatsapp_enviado && (
                          <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-1.5 rounded-full">
                            📱 WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 text-center">
                Actualizando cada 30 segundos · {notifs.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}