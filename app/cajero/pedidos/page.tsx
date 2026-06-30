"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock,
  Package, Loader2, AlertCircle, PawPrint, ShoppingBag,
  ChevronDown, ChevronUp, User, Calendar, DollarSign, Tag
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface ItemPedido {
  id_producto: number
  nombre_producto: string
  imagen_url: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface Pedido {
  id_compra: number
  fecha: string
  total: number
  estado: "pendiente" | "pagada" | "anulada"
  descuento_aplicado: number
  nombre_cliente: string
  email_cliente: string
  telefono_cliente: string | null
  cantidad_items: number
  items: ItemPedido[]
}

// ── Constantes ─────────────────────────────────────────────────────────────
const ESTADO_STYLES: Record<string, { badge: string; label: string; icon: React.ElementType }> = {
  pendiente: { badge: "bg-amber-100 text-amber-700 border-amber-200", label: "Pendiente", icon: Clock },
  pagada:    { badge: "bg-green-100 text-green-700 border-green-200",  label: "Pagada",    icon: CheckCircle },
  anulada:   { badge: "bg-red-100 text-red-700 border-red-200",        label: "Anulada",   icon: XCircle },
}

// ── Tarjeta pedido ─────────────────────────────────────────────────────────
function TarjetaPedido({
  pedido, onCambiarEstado, cambiando,
}: {
  pedido: Pedido
  onCambiarEstado: (id: number, estado: string) => void
  cambiando: number | null
}) {
  const [expandido, setExpandido] = useState(false)
  const est = ESTADO_STYLES[pedido.estado] ?? ESTADO_STYLES.pendiente
  const Icon = est.icon

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
      pedido.estado === "pendiente" ? "border-amber-200 shadow-md shadow-amber-50" :
      pedido.estado === "pagada"    ? "border-green-100" : "border-gray-100 opacity-70"
    }`}>
      {/* Header tarjeta */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-gray-800 text-sm">Pedido #{pedido.id_compra}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${est.badge} flex items-center gap-1`}>
              <Icon size={10} /> {est.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <User size={11} />
            <span className="font-semibold text-gray-700">{pedido.nombre_cliente}</span>
            {pedido.telefono_cliente && (
              <span className="text-gray-400">· {pedido.telefono_cliente}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {new Date(pedido.fecha + "T00:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Package size={10} />
              {pedido.cantidad_items} {pedido.cantidad_items === 1 ? "producto" : "productos"}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-black text-gray-800">Bs. {Number(pedido.total).toFixed(2)}</p>
          {pedido.descuento_aplicado > 0 && (
            <p className="text-xs text-green-600">-Bs. {Number(pedido.descuento_aplicado).toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Toggle items */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full px-5 py-2 flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 border-t border-gray-50 transition-colors bg-gray-50/50"
      >
        <span>{expandido ? "Ocultar productos" : "Ver productos"}</span>
        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Detalle items */}
      {expandido && (
        <div className="px-5 py-3 space-y-2 border-t border-gray-50">
          {pedido.items.map(item => (
            <div key={item.id_producto} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                {item.imagen_url ? (
                  <img src={item.imagen_url} alt={item.nombre_producto} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">{item.nombre_producto}</p>
                <p className="text-xs text-gray-400">Bs. {Number(item.precio_unitario).toFixed(2)} × {item.cantidad}</p>
              </div>
              <p className="font-black text-gray-700 text-sm shrink-0">Bs. {Number(item.subtotal).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Acciones (solo para pendiente) */}
      {pedido.estado === "pendiente" && (
        <div className="px-5 pb-4 pt-2 flex gap-2 border-t border-gray-50">
          <button
            onClick={() => onCambiarEstado(pedido.id_compra, "pagada")}
            disabled={cambiando === pedido.id_compra}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {cambiando === pedido.id_compra
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCircle size={14} />
            }
            Marcar pagado
          </button>
          <button
            onClick={() => onCambiarEstado(pedido.id_compra, "anulada")}
            disabled={cambiando === pedido.id_compra}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            <XCircle size={14} />
            Anular
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function PedidosCajeroPage() {
  const { user, accessToken, logout, isLoading } = useAuth()
  const router = useRouter()

  const [pedidos, setPedidos]       = useState<Pedido[]>([])
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState("")
  const [filtroEstado, setFiltroEstado] = useState("pendiente")
  const [pagina, setPagina]         = useState(1)
  const [totalPags, setTotalPags]   = useState(1)
  const [total, setTotal]           = useState(0)
  const [cambiando, setCambiando]   = useState<number | null>(null)
  const [toast, setToast]           = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || !["admin", "cajero"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargarPedidos = useCallback(async (pag = 1) => {
    setCargando(true); setError("")
    try {
      const params = new URLSearchParams()
      if (filtroEstado) params.set("estado", filtroEstado)
      params.set("pagina", String(pag))
      const res = await fetch(`/api/pedidos?${params}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setPedidos(d.compras ?? [])
      setTotal(d.total ?? 0)
      setTotalPags(d.totalPaginas ?? 1)
      setPagina(pag)
    } catch (e: any) {
      setError(e.message || "Error al cargar pedidos")
    } finally { setCargando(false) }
  }, [authHeaders, filtroEstado])

  useEffect(() => { if (user) cargarPedidos(1) }, [user, filtroEstado])

  const cambiarEstado = async (id: number, estado: string) => {
    setCambiando(id)
    try {
      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ estado }),
      })
      const d = await res.json()
      if (res.ok) {
        setToast({ tipo: "ok", texto: d.message })
        cargarPedidos(pagina)
      } else {
        setToast({ tipo: "error", texto: d.message || "Error al actualizar" })
      }
    } catch {
      setToast({ tipo: "error", texto: "Error de conexión" })
    } finally {
      setCambiando(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const pendientes = pedidos.filter(p => p.estado === "pendiente").length

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <PawPrint className="w-10 h-10 text-amber-400 animate-bounce" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold transition-all ${
          toast.tipo === "ok" ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.tipo === "ok" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.texto}
        </div>
      )}

      {/* Navbar */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cajero")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm">
              <ArrowLeft size={18} />
              <span className="hidden sm:block">Panel cajero</span>
            </button>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-200" />
              <span className="text-white font-black text-lg">
                Pedidos <span className="text-amber-200">de clientes</span>
              </span>
              {pendientes > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                  {pendientes} nuevo{pendientes > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => cargarPedidos(pagina)}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-semibold transition-colors">
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            <span className="hidden sm:block">Actualizar</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pendientes", val: filtroEstado === "pendiente" ? total : "—", color: "bg-amber-50 text-amber-600 border-amber-200" },
            { label: "Total hoy",  val: pedidos.reduce((s,p) => p.estado !== "anulada" ? s + Number(p.total) : s, 0).toFixed(0), prefix: "Bs.", color: "bg-green-50 text-green-600 border-green-200" },
            { label: "Mostrados",  val: pedidos.length, color: "bg-blue-50 text-blue-600 border-blue-200" },
          ].map(({ label, val, color, prefix }) => (
            <div key={label} className={`rounded-2xl border-2 p-4 ${color}`}>
              <p className="text-xs font-semibold opacity-70">{label}</p>
              <p className="text-2xl font-black">{prefix}{val}</p>
            </div>
          ))}
        </div>

        {/* Filtros estado */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 w-fit">
          {(["pendiente", "pagada", "anulada"] as const).map(est => {
            const s = ESTADO_STYLES[est]
            const Icon = s.icon
            return (
              <button
                key={est}
                onClick={() => setFiltroEstado(est)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  filtroEstado === est ? "bg-amber-500 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} /> {s.label}
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Lista pedidos */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-amber-400" size={32} />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <ShoppingBag className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No hay pedidos {filtroEstado === "pendiente" ? "pendientes" : filtroEstado === "pagada" ? "pagados" : "anulados"}</p>
            {filtroEstado === "pendiente" && (
              <p className="text-gray-400 text-sm mt-1">Los nuevos pedidos de clientes aparecerán aquí</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 font-semibold">{total} pedido{total !== 1 ? "s" : ""}</p>
            {pedidos.map(p => (
              <TarjetaPedido
                key={p.id_compra}
                pedido={p}
                onCambiarEstado={cambiarEstado}
                cambiando={cambiando}
              />
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPags > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => cargarPedidos(pagina - 1)} disabled={pagina === 1}
              className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-semibold">
              ← Anterior
            </button>
            <span className="text-sm text-gray-500">Página {pagina} de {totalPags}</span>
            <button onClick={() => cargarPedidos(pagina + 1)} disabled={pagina >= totalPags}
              className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-semibold">
              Siguiente →
            </button>
          </div>
        )}

      </main>
    </div>
  )
}