"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ShoppingCart, ArrowLeft, Search, Plus, Minus, Trash2,
  CheckCircle, XCircle, Loader2, Package, PawPrint,
  ShoppingBag, ChevronLeft, ChevronRight, X, Tag, Ticket,
  AlertCircle, BadgePercent
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Producto {
  id_producto: number
  nombre: string
  descripcion: string | null
  categoria: string
  imagen_url: string | null
  precio_venta: number
  presentacion: string | null
  marca: string | null
  stock_actual: number
  estado_stock: string
}

interface ItemCarrito {
  producto: Producto
  cantidad: number
}

interface CuponAplicado {
  id_cupon: number
  codigo: string
  descripcion: string
  tipo: "porcentaje" | "monto_fijo"
  valor: number
  descuento_calculado: number
  total_con_descuento: number
}

// ── Constantes ─────────────────────────────────────────────────────────────
const CATEGORIAS = [
  "shampoo", "acondicionador", "accesorio", "alimento",
  "suplemento", "medicamento", "juguete", "higiene", "otro",
]
const CAT_EMOJI: Record<string, string> = {
  shampoo: "🧴", acondicionador: "💆", accesorio: "🎀", alimento: "🍖",
  suplemento: "💊", medicamento: "🩺", juguete: "🎾", higiene: "✨", otro: "📦",
}
const CAT_COLOR: Record<string, string> = {
  alimento: "bg-green-100 text-green-700", accesorio: "bg-blue-100 text-blue-700",
  shampoo: "bg-purple-100 text-purple-700", acondicionador: "bg-violet-100 text-violet-700",
  suplemento: "bg-teal-100 text-teal-700", medicamento: "bg-red-100 text-red-700",
  juguete: "bg-pink-100 text-pink-700", higiene: "bg-cyan-100 text-cyan-700",
  otro: "bg-gray-100 text-gray-600",
}

// ── Sección cupón dentro del drawer ───────────────────────────────────────
function SeccionCupon({
  subtotal, cupon, onAplicar, onQuitar, accessToken,
}: {
  subtotal: number
  cupon: CuponAplicado | null
  onAplicar: (c: CuponAplicado) => void
  onQuitar: () => void
  accessToken: string | null
}) {
  const [codigo, setCodigo]     = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState("")

  const validar = async () => {
    if (!codigo.trim()) { setError("Ingresa un código"); return }
    setCargando(true); setError("")
    try {
      const res = await fetch("/api/cupones/validar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ codigo: codigo.trim().toUpperCase(), subtotal }),
      })
      const d = await res.json()
      if (d.valido) {
        onAplicar(d)
        setCodigo("")
      } else {
        setError(d.message || "Cupón inválido")
      }
    } catch {
      setError("Error de conexión")
    } finally { setCargando(false) }
  }

  // Si ya hay cupón aplicado — mostrar resumen
  if (cupon) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Ticket size={16} className="text-green-600" />
            </div>
            <div>
              <p className="font-black text-green-800 text-sm">{cupon.codigo}</p>
              <p className="text-xs text-green-600">{cupon.descripcion}</p>
            </div>
          </div>
          <button onClick={onQuitar} className="text-green-400 hover:text-red-500 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between bg-green-100 rounded-xl px-3 py-1.5">
          <span className="text-xs text-green-700 font-semibold">
            {cupon.tipo === "porcentaje" ? `${cupon.valor}% de descuento` : `Bs. ${cupon.valor} de descuento`}
          </span>
          <span className="text-sm font-black text-green-700">
            - Bs. {cupon.descuento_calculado.toFixed(2)}
          </span>
        </div>
      </div>
    )
  }

  // Sin cupón — mostrar input
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BadgePercent size={14} className="text-violet-500" />
        <p className="text-xs font-bold text-gray-600">¿Tienes un cupón de descuento?</p>
      </div>
      <div className="flex gap-2">
        <input
          value={codigo}
          onChange={e => { setCodigo(e.target.value.toUpperCase()); setError("") }}
          onKeyDown={e => e.key === "Enter" && validar()}
          placeholder="Ej: VERANO25"
          className="flex-1 border-2 border-dashed border-violet-200 rounded-xl px-3 py-2 text-sm font-bold text-violet-700 placeholder-violet-300 focus:border-violet-400 focus:outline-none tracking-wider"
        />
        <button
          onClick={validar}
          disabled={cargando || !codigo.trim()}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {cargando ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />}
          Aplicar
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  )
}

// ── Drawer carrito ─────────────────────────────────────────────────────────
function DrawerCarrito({
  items, cupon, onClose, onCambiarCantidad, onEliminar,
  onConfirmar, onAplicarCupon, onQuitarCupon,
  confirmando, resultado, accessToken,
}: {
  items: ItemCarrito[]
  cupon: CuponAplicado | null
  onClose: () => void
  onCambiarCantidad: (id: number, delta: number) => void
  onEliminar: (id: number) => void
  onConfirmar: () => void
  onAplicarCupon: (c: CuponAplicado) => void
  onQuitarCupon: () => void
  confirmando: boolean
  resultado: { tipo: "ok" | "error"; texto: string } | null
  accessToken: string | null
}) {
  const subtotal     = items.reduce((s, i) => s + Number(i.producto.precio_venta) * i.cantidad, 0)
  const descuento    = cupon ? cupon.descuento_calculado : 0
  const totalFinal   = Math.max(0, subtotal - descuento)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full flex flex-col shadow-2xl animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-violet-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-violet-600" />
            <h2 className="font-black text-gray-800">Mi carrito</h2>
            {items.length > 0 && (
              <span className="bg-violet-600 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {items.reduce((s, i) => s + i.cantidad, 0)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-500 font-semibold">Tu carrito está vacío</p>
              <p className="text-gray-400 text-sm mt-1">Agrega productos desde el catálogo</p>
            </div>
          ) : (
            items.map(({ producto, cantidad }) => (
              <div key={producto.id_producto}
                className="flex gap-3 bg-gray-50 rounded-2xl p-3 border border-gray-100">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-100 shrink-0">
                  {producto.imagen_url
                    ? <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">{CAT_EMOJI[producto.categoria] ?? "📦"}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{producto.nombre}</p>
                  <p className="text-xs text-gray-400">{producto.presentacion ?? producto.categoria}</p>
                  <p className="text-violet-600 font-black text-sm mt-0.5">
                    Bs. {(Number(producto.precio_venta) * cantidad).toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => onEliminar(producto.id_producto)}
                    className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onCambiarCantidad(producto.id_producto, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors">
                      <Minus size={10} />
                    </button>
                    <span className="font-black text-gray-800 text-sm w-5 text-center">{cantidad}</span>
                    <button onClick={() => onCambiarCantidad(producto.id_producto, +1)}
                      disabled={cantidad >= producto.stock_actual}
                      className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center text-white hover:bg-violet-700 transition-colors disabled:opacity-40">
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer con cupón + resumen + confirmar */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-white">

            {/* Sección cupón */}
            <SeccionCupon
              subtotal={subtotal}
              cupon={cupon}
              onAplicar={onAplicarCupon}
              onQuitar={onQuitarCupon}
              accessToken={accessToken}
            />

            {/* Resumen de precios */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>Bs. {subtotal.toFixed(2)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Ticket size={12} /> Descuento ({cupon?.codigo})
                  </span>
                  <span>- Bs. {descuento.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total</span>
                <span className="text-2xl font-black text-gray-800">Bs. {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Resultado */}
            {resultado && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold ${
                resultado.tipo === "ok"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {resultado.tipo === "ok" ? <CheckCircle size={15} /> : <XCircle size={15} />}
                {resultado.texto}
              </div>
            )}

            {/* Botón confirmar */}
            <button
              onClick={onConfirmar}
              disabled={confirmando}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
            >
              {confirmando
                ? <><Loader2 size={16} className="animate-spin" /> Confirmando...</>
                : <><CheckCircle size={16} /> Confirmar pedido</>
              }
            </button>
            <p className="text-center text-xs text-gray-400">
              El cajero procesará tu pedido
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta producto ───────────────────────────────────────────────────────
function TarjetaProducto({
  producto, cantidadEnCarrito, onAgregar, onCambiarCantidad,
}: {
  producto: Producto
  cantidadEnCarrito: number
  onAgregar: (p: Producto) => void
  onCambiarCantidad: (id: number, delta: number) => void
}) {
  const agotado = producto.stock_actual === 0 || producto.estado_stock === "agotado"

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
      agotado ? "opacity-60 border-gray-100" : "border-gray-100 hover:border-violet-200"
    }`}>
      <div className="h-40 bg-gray-50 relative overflow-hidden">
        {producto.imagen_url
          ? <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-200">{CAT_EMOJI[producto.categoria] ?? "📦"}</div>
        }
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${CAT_COLOR[producto.categoria] ?? "bg-gray-100 text-gray-600"}`}>
            {CAT_EMOJI[producto.categoria]} {producto.categoria}
          </span>
        </div>
        {agotado && (
          <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-black px-3 py-1 rounded-full">Agotado</span>
          </div>
        )}
        {cantidadEnCarrito > 0 && !agotado && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg">
            {cantidadEnCarrito}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div>
          <p className="font-black text-gray-800 text-sm leading-tight">{producto.nombre}</p>
          {producto.marca && <p className="text-xs text-gray-400">{producto.marca}</p>}
          {producto.presentacion && <p className="text-xs text-gray-400">{producto.presentacion}</p>}
        </div>
        <p className="text-xl font-black text-violet-600">Bs. {Number(producto.precio_venta).toFixed(2)}</p>

        {agotado ? (
          <div className="w-full py-2 bg-gray-100 text-gray-400 text-xs font-bold rounded-xl text-center">Sin stock</div>
        ) : cantidadEnCarrito === 0 ? (
          <button onClick={() => onAgregar(producto)}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm">
            <Plus size={14} /> Agregar
          </button>
        ) : (
          <div className="flex items-center justify-between bg-violet-50 rounded-xl px-3 py-1.5 border-2 border-violet-200">
            <button onClick={() => onCambiarCantidad(producto.id_producto, -1)}
              className="w-8 h-8 rounded-lg bg-white border border-violet-200 flex items-center justify-center text-violet-700 hover:bg-violet-100 font-black">
              <Minus size={12} />
            </button>
            <span className="font-black text-violet-700 text-lg">{cantidadEnCarrito}</span>
            <button onClick={() => onCambiarCantidad(producto.id_producto, +1)}
              disabled={cantidadEnCarrito >= producto.stock_actual}
              className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white hover:bg-violet-700 disabled:opacity-40">
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function TiendaPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const [productos, setProductos]     = useState<Producto[]>([])
  const [cargando, setCargando]       = useState(false)
  const [buscar, setBuscar]           = useState("")
  const [catActiva, setCatActiva]     = useState("")
  const [pagina, setPagina]           = useState(1)
  const [totalPags, setTotalPags]     = useState(1)
  const [total, setTotal]             = useState(0)

  const [carrito, setCarrito]         = useState<ItemCarrito[]>([])
  const [cupon, setCupon]             = useState<CuponAplicado | null>(null)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado]     = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)

  useEffect(() => {
    if (!isLoading && !user) router.push("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargarProductos = useCallback(async (pag = 1) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (catActiva) params.set("categoria", catActiva)
      if (buscar)    params.set("buscar", buscar)
      params.set("pagina", String(pag))
      const res = await fetch(`/api/productos?${params}`, { headers: authHeaders() })
      const d   = await res.json()
      if (res.ok) {
        setProductos(d.productos ?? [])
        setTotal(d.total ?? 0)
        setTotalPags(d.totalPaginas ?? 1)
        setPagina(pag)
      }
    } finally { setCargando(false) }
  }, [authHeaders, catActiva, buscar])

  useEffect(() => { if (user) cargarProductos(1) }, [user, catActiva])

  // Quitar cupón si el carrito cambia (el descuento puede ya no aplicar)
  useEffect(() => { if (cupon) setCupon(null) }, [carrito])

  const totalItems  = carrito.reduce((s, i) => s + i.cantidad, 0)
  const subtotal    = carrito.reduce((s, i) => s + Number(i.producto.precio_venta) * i.cantidad, 0)
  const descuento   = cupon?.descuento_calculado ?? 0
  const totalFinal  = Math.max(0, subtotal - descuento)

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id_producto === producto.id_producto)
      if (existe) return prev.map(i => i.producto.id_producto === producto.id_producto
        ? { ...i, cantidad: Math.min(i.cantidad + 1, producto.stock_actual) } : i)
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (id: number, delta: number) => {
    setCarrito(prev => prev
      .map(i => i.producto.id_producto === id
        ? { ...i, cantidad: Math.max(0, Math.min(i.cantidad + delta, i.producto.stock_actual)) } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  const eliminarDelCarrito = (id: number) => {
    setCarrito(prev => prev.filter(i => i.producto.id_producto !== id))
  }

  const confirmarPedido = async () => {
    if (carrito.length === 0) return
    setConfirmando(true); setResultado(null)
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          items: carrito.map(i => ({ id_producto: i.producto.id_producto, cantidad: i.cantidad })),
          cupon: cupon ? {
            id_cupon: cupon.id_cupon,
            codigo: cupon.codigo,
            descuento_calculado: cupon.descuento_calculado,
          } : undefined,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setResultado({
          tipo: "ok",
          texto: `¡Pedido #${d.id_compra} confirmado! Total: Bs. ${Number(d.total).toFixed(2)}`,
        })
        setCarrito([])
        setCupon(null)
        cargarProductos(pagina)
        setTimeout(() => { setDrawerAbierto(false); setResultado(null) }, 2800)
      } else {
        setResultado({ tipo: "error", texto: d.message || "Error al confirmar" })
      }
    } catch {
      setResultado({ tipo: "error", texto: "Error de conexión" })
    } finally { setConfirmando(false) }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-violet-50">
        <PawPrint className="w-10 h-10 text-violet-400 animate-bounce" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>

      {drawerAbierto && (
        <DrawerCarrito
          items={carrito}
          cupon={cupon}
          onClose={() => setDrawerAbierto(false)}
          onCambiarCantidad={cambiarCantidad}
          onEliminar={eliminarDelCarrito}
          onConfirmar={confirmarPedido}
          onAplicarCupon={setCupon}
          onQuitarCupon={() => setCupon(null)}
          confirmando={confirmando}
          resultado={resultado}
          accessToken={accessToken}
        />
      )}

      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 to-purple-800 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm">
              <ArrowLeft size={18} /><span className="hidden sm:block">Volver</span>
            </button>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-300" />
              <span className="text-white font-black text-lg">Tienda <span className="text-purple-300">Spa</span></span>
            </div>
          </div>
          <button onClick={() => setDrawerAbierto(true)}
            className="relative flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl transition-all font-bold text-sm">
            <ShoppingCart size={18} />
            <span className="hidden sm:block">Carrito</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full text-[11px] font-black flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-800 rounded-3xl p-8 text-white">
          <span className="inline-block bg-white/15 text-xs font-bold px-3 py-1 rounded-full mb-3">🛍️ Tienda online</span>
          <h1 className="text-3xl font-black mb-1">Productos para tu mascota</h1>
          <p className="text-violet-200 text-sm">Agrega productos y usa tus cupones de descuento al confirmar.</p>
          {/* Hint de cupón */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 text-xs text-violet-200">
            <Ticket size={13} /> ¿Tienes un cupón? Ingrésalo en el carrito antes de confirmar.
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              onKeyDown={e => e.key === "Enter" && cargarProductos(1)}
              placeholder="Buscar productos..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCatActiva("")}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${catActiva === "" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              Todos
            </button>
            {CATEGORIAS.map(cat => (
              <button key={cat} onClick={() => setCatActiva(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${catActiva === cat ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {CAT_EMOJI[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Contador + botón carrito */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {total > 0 && <><strong className="text-gray-800">{total}</strong> productos</>}
          </p>
          {carrito.length > 0 && (
            <button onClick={() => setDrawerAbierto(true)}
              className="flex items-center gap-2 bg-violet-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
              <ShoppingCart size={15} />
              Carrito ({totalItems}) · Bs. {totalFinal.toFixed(2)}
              {cupon && <span className="bg-green-400 text-white text-[10px] font-black px-1.5 rounded-full">Cupón ✓</span>}
            </button>
          )}
        </div>

        {/* Grid productos */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-violet-400" size={32} />
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No hay productos disponibles</p>
            {catActiva && (
              <button onClick={() => setCatActiva("")} className="mt-2 text-violet-600 text-sm font-bold hover:underline">
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {productos.map(p => (
              <TarjetaProducto
                key={p.id_producto}
                producto={p}
                cantidadEnCarrito={carrito.find(i => i.producto.id_producto === p.id_producto)?.cantidad ?? 0}
                onAgregar={agregarAlCarrito}
                onCambiarCantidad={cambiarCantidad}
              />
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPags > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => cargarProductos(pagina - 1)} disabled={pagina === 1}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-semibold">
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="text-sm text-gray-500 font-semibold">Página {pagina} de {totalPags}</span>
            <button onClick={() => cargarProductos(pagina + 1)} disabled={pagina >= totalPags}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-semibold">
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </main>

      {/* Botón flotante móvil */}
      {totalItems > 0 && !drawerAbierto && (
        <button onClick={() => setDrawerAbierto(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-violet-300 font-black transition-all hover:scale-105 active:scale-95">
          <ShoppingCart size={20} />
          <span>{totalItems} {totalItems === 1 ? "item" : "items"}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">Bs. {totalFinal.toFixed(2)}</span>
          {cupon && <span className="bg-green-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">% ✓</span>}
        </button>
      )}
    </div>
  )
}