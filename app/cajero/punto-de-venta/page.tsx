"use client"
// app/cajero/punto-de-venta/page.tsx
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft, Search, CreditCard, Banknote, Smartphone,
  ArrowLeftRight, QrCode, CheckCircle, XCircle, Loader2,
  PawPrint, Receipt, Download, RefreshCw, AlertCircle,
  ShoppingBag, Scissors, ChevronDown, ChevronUp, Tag, X
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Cita {
  id_cita: number
  nombre_cliente: string
  telefono_cliente: string
  nombre_mascota: string
  especie: string
  nombre_servicio: string
  precio_calculado: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
}

interface Pedido {
  id_compra: number
  nombre_cliente: string
  email_cliente: string
  telefono_cliente: string
  total: number
  estado: string
  cantidad_items: number
  items: { nombre_producto: string; cantidad: number; precio_unitario: number; subtotal: number }[]
}

interface Recibo {
  id_pago: number
  nro_factura: string
  monto: number
  descuento: number
  metodo_pago: string
  fecha: string
  tipo: "cita" | "pedido"
  nombre_cliente: string
  telefono: string
  concepto: string
  servicio?: string
  mascota?: string
  items?: { nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[]
}

// ── Constantes ─────────────────────────────────────────────────────────────
const METODOS = [
  { key: "efectivo",       label: "Efectivo",      icon: Banknote,       color: "border-green-300 bg-green-50 text-green-700" },
  { key: "qr",             label: "QR Banco Unión", icon: QrCode,        color: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "transferencia",  label: "Transferencia",  icon: ArrowLeftRight, color: "border-purple-300 bg-purple-50 text-purple-700" },
  { key: "tarjeta_debito", label: "Tarjeta Débito", icon: CreditCard,     color: "border-amber-300 bg-amber-50 text-amber-700" },
  { key: "tarjeta_credito",label: "Tarjeta Crédito",icon: CreditCard,     color: "border-rose-300 bg-rose-50 text-rose-700" },
]

// ── Modal de pago ──────────────────────────────────────────────────────────
function ModalPago({
  tipo, item, onClose, onPagado, accessToken,
}: {
  tipo: "cita" | "pedido"
  item: Cita | Pedido
  onClose: () => void
  onPagado: (recibo: Recibo) => void
  accessToken: string | null
}) {
  const monto = tipo === "cita"
    ? Number((item as Cita).precio_calculado)
    : Number((item as Pedido).total)

  const [metodoPago, setMetodoPago]   = useState("")
  const [descuento, setDescuento]     = useState(0)
  const [refExt, setRefExt]           = useState("")
  const [procesando, setProcesando]   = useState(false)
  const [error, setError]             = useState("")
  const [mostrarQR, setMostrarQR]     = useState(false)

  const montoFinal = Math.max(0, monto - descuento)

  const registrarPago = async () => {
    if (!metodoPago) { setError("Selecciona un método de pago"); return }
    if (metodoPago === "transferencia" && !refExt.trim()) { setError("Ingresa el número de referencia"); return }
    setProcesando(true); setError("")
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          tipo,
          id_referencia: tipo === "cita" ? (item as Cita).id_cita : (item as Pedido).id_compra,
          metodo_pago: metodoPago,
          monto: montoFinal,
          descuento,
          referencia_externa: refExt || undefined,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        onPagado({ ...d, tipo, descuento })
      } else {
        setError(d.message || "Error al registrar el pago")
      }
    } catch {
      setError("Error de conexión")
    } finally { setProcesando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-lg">Registrar pago</h3>
            <p className="text-amber-100 text-xs mt-0.5">
              {tipo === "cita"
                ? `${(item as Cita).nombre_servicio} — ${(item as Cita).nombre_mascota}`
                : `Pedido #${(item as Pedido).id_compra}`
              }
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">

          {/* Monto */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="text-xs text-amber-600 font-semibold mb-2">Resumen de cobro</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>Bs. {monto.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 flex items-center gap-1"><Tag size={12}/> Descuento (Bs.)</span>
                <input
                  type="number" min="0" max={monto} step="0.50"
                  value={descuento}
                  onChange={e => setDescuento(Math.min(monto, Math.max(0, Number(e.target.value))))}
                  className="ml-auto w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-between font-black text-gray-800 pt-1 border-t border-amber-200">
                <span>Total a cobrar</span>
                <span className="text-xl text-amber-600">Bs. {montoFinal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {METODOS.map(m => {
                const Icon = m.icon
                const sel  = metodoPago === m.key
                return (
                  <button key={m.key}
                    onClick={() => { setMetodoPago(m.key); setMostrarQR(m.key === "qr") }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                      sel ? m.color + " border-current scale-[1.03] shadow" : "border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <Icon size={18} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* QR Banco Unión */}
          {mostrarQR && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 text-center space-y-2">
              <p className="text-xs font-bold text-blue-700">QR Banco Unión — Escanea para pagar</p>
              {/* QR de ejemplo — reemplaza src con tu imagen real */}
              <div className="w-40 h-40 mx-auto bg-white rounded-xl border-2 border-blue-200 flex items-center justify-center overflow-hidden">
                <img
                  src="/qr-banco-union.png"
                  alt="QR Banco Unión"
                  className="w-full h-full object-contain"
                  onError={e => {
                    // Si no existe la imagen, mostrar placeholder
                    const t = e.currentTarget
                    t.style.display = "none"
                    t.nextElementSibling?.classList.remove("hidden")
                  }}
                />
                <div className="hidden flex-col items-center gap-1 text-blue-400">
                  <QrCode size={48} />
                  <p className="text-xs">Coloca tu QR en<br/>/public/qr-banco-union.png</p>
                </div>
              </div>
              <p className="text-xs text-blue-600">Monto: <strong>Bs. {montoFinal.toFixed(2)}</strong></p>
            </div>
          )}

          {/* Referencia transferencia */}
          {(metodoPago === "transferencia" || metodoPago === "tarjeta_debito" || metodoPago === "tarjeta_credito") && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                {metodoPago === "transferencia" ? "Número de referencia *" : "Últimos 4 dígitos"}
              </label>
              <input
                value={refExt}
                onChange={e => setRefExt(e.target.value)}
                placeholder={metodoPago === "transferencia" ? "Ej: TRF-20240601-001" : "Ej: 4521"}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 text-sm">
              Cancelar
            </button>
            <button
              onClick={registrarPago}
              disabled={procesando || !metodoPago}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
            >
              {procesando ? <><Loader2 size={15} className="animate-spin"/> Procesando...</> : <><CheckCircle size={15}/> Cobrar Bs. {montoFinal.toFixed(2)}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal recibo PDF ───────────────────────────────────────────────────────
function ModalRecibo({ recibo, onClose }: { recibo: Recibo; onClose: () => void }) {
  const reciboRef = useRef<HTMLDivElement>(null)

  const descargarPDF = () => {
    const contenido = reciboRef.current
    if (!contenido) return
    const ventana = window.open("", "_blank")
    if (!ventana) return
    ventana.document.write(`
      <!DOCTYPE html><html><head>
      <title>Recibo ${recibo.nro_factura}</title>
      <style>
        body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 20px; font-size: 12px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .logo { font-size: 18px; font-weight: bold; }
        .total { font-size: 16px; font-weight: bold; }
        @media print { body { margin: 0; } button { display: none; } }
      </style></head><body>
      <div class="center"><div class="logo">🐾 SPA MASCOTAS</div>
      <p>Comprobante de Pago</p></div>
      <div class="line"></div>
      <div class="row"><span>Factura:</span><span class="bold">${recibo.nro_factura}</span></div>
      <div class="row"><span>Fecha:</span><span>${recibo.fecha}</span></div>
      <div class="row"><span>Cliente:</span><span>${recibo.nombre_cliente}</span></div>
      ${recibo.telefono ? `<div class="row"><span>Tel:</span><span>${recibo.telefono}</span></div>` : ""}
      <div class="line"></div>
      <div class="bold">Concepto:</div>
      <div>${recibo.concepto}</div>
      ${recibo.items ? recibo.items.map(i => `<div class="row"><span>${i.nombre} x${i.cantidad}</span><span>Bs.${Number(i.subtotal).toFixed(2)}</span></div>`).join("") : ""}
      <div class="line"></div>
      ${recibo.descuento > 0 ? `<div class="row"><span>Descuento:</span><span>-Bs.${Number(recibo.descuento).toFixed(2)}</span></div>` : ""}
      <div class="row total"><span>TOTAL COBRADO:</span><span>Bs.${Number(recibo.monto).toFixed(2)}</span></div>
      <div class="row"><span>Método:</span><span>${recibo.metodo_pago.replace("_"," ").toUpperCase()}</span></div>
      <div class="line"></div>
      <div class="center"><p>¡Gracias por confiar en SPA Mascotas!</p><p>🐶🐱🐾</p></div>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;background:#f59e0b;color:white;border:none;border-radius:8px;cursor:pointer;width:100%">Imprimir / Guardar PDF</button>
      </body></html>
    `)
    ventana.document.close()
    setTimeout(() => ventana.print(), 500)
  }

  const METODO_LABEL: Record<string, string> = {
    efectivo:"Efectivo", qr:"QR Banco Unión", transferencia:"Transferencia",
    tarjeta_debito:"Tarjeta Débito", tarjeta_credito:"Tarjeta Crédito",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-green-500 px-6 py-4 text-center">
          <CheckCircle className="w-10 h-10 text-white mx-auto mb-1" />
          <h3 className="font-black text-white text-lg">¡Pago registrado!</h3>
          <p className="text-green-100 text-xs">{recibo.nro_factura}</p>
        </div>

        {/* Recibo */}
        <div ref={reciboRef} className="p-6 space-y-3 font-mono text-sm">
          <div className="text-center border-b-2 border-dashed border-gray-200 pb-3">
            <p className="text-xl font-black">🐾 SPA MASCOTAS</p>
            <p className="text-xs text-gray-500">Comprobante de Pago</p>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Factura</span><span className="font-bold">{recibo.nro_factura}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span>{recibo.fecha}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cliente</span><span className="font-bold">{recibo.nombre_cliente}</span></div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-2 space-y-1 text-xs">
            <p className="font-bold text-gray-700">Concepto:</p>
            <p>{recibo.concepto}</p>
            {recibo.items?.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>{item.nombre} x{item.cantidad}</span>
                <span>Bs. {Number(item.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-dashed border-gray-300 pt-2 space-y-1">
            {recibo.descuento > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Descuento</span><span>- Bs. {Number(recibo.descuento).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base">
              <span>TOTAL</span><span className="text-amber-600">Bs. {Number(recibo.monto).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Método</span><span>{METODO_LABEL[recibo.metodo_pago] ?? recibo.metodo_pago}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 border-t border-dashed border-gray-200 pt-2">
            ¡Gracias por confiar en SPA Mascotas! 🐶🐱
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 text-sm">
            Cerrar
          </button>
          <button onClick={descargarPDF}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
            <Download size={15}/> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta cita ───────────────────────────────────────────────────────────
function TarjetaCita({ cita, onCobrar }: { cita: Cita; onCobrar: (c: Cita) => void }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 hover:border-amber-200 hover:shadow-md transition-all p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black text-gray-800 text-sm">{cita.nombre_cliente}</p>
          <p className="text-xs text-gray-500">{cita.telefono_cliente}</p>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
          cita.estado_reserva === "completada" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        }`}>
          {cita.estado_reserva}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="text-lg">{cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"}</span>
        <div>
          <p className="font-semibold">{cita.nombre_mascota}</p>
          <p className="text-gray-400">{cita.nombre_servicio}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xl font-black text-amber-600">Bs. {Number(cita.precio_calculado).toFixed(2)}</p>
          <p className="text-[10px] text-gray-400">
            {new Date(cita.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"short" })}
            {" "}{String(cita.hora_programada).slice(0,5)}
          </p>
        </div>
        <button onClick={() => onCobrar(cita)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105">
          <CreditCard size={14}/> Cobrar
        </button>
      </div>
    </div>
  )
}

// ── Tarjeta pedido ─────────────────────────────────────────────────────────
function TarjetaPedido({ pedido, onCobrar }: { pedido: Pedido; onCobrar: (p: Pedido) => void }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 hover:border-amber-200 hover:shadow-md transition-all p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black text-gray-800 text-sm">{pedido.nombre_cliente}</p>
          <p className="text-xs text-gray-500">Pedido #{pedido.id_compra} · {pedido.cantidad_items} productos</p>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">pendiente</span>
      </div>

      <button onClick={() => setExpandido(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
        {expandido ? <><ChevronUp size={12}/> Ocultar</> : <><ChevronDown size={12}/> Ver productos</>}
      </button>

      {expandido && (
        <div className="space-y-1.5 border-t border-gray-50 pt-2">
          {pedido.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.nombre_producto} x{item.cantidad}</span>
              <span>Bs. {Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xl font-black text-amber-600">Bs. {Number(pedido.total).toFixed(2)}</p>
        <button onClick={() => onCobrar(pedido)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all hover:scale-105">
          <CreditCard size={14}/> Cobrar
        </button>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function PuntoDeVentaPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const [tabActiva, setTabActiva]         = useState<"citas"|"pedidos">("citas")
  const [buscar, setBuscar]               = useState("")
  const [citas, setCitas]                 = useState<Cita[]>([])
  const [pedidos, setPedidos]             = useState<Pedido[]>([])
  const [cargando, setCargando]           = useState(false)
  const [itemPago, setItemPago]           = useState<{tipo:"cita"|"pedido"; item:Cita|Pedido} | null>(null)
  const [recibo, setRecibo]               = useState<Recibo | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || !["admin","cajero"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargarCitas = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/citas?estado=confirmada", { headers: authHeaders() })
      const d   = await res.json()
      // También traer completadas
      const res2 = await fetch("/api/citas?estado=completada", { headers: authHeaders() })
      const d2   = await res2.json()
      const todas = [...(d.citas||[]), ...(d2.citas||[])]
      setCitas(todas)
    } finally { setCargando(false) }
  }, [authHeaders])

  const cargarPedidos = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/pedidos?estado=pendiente", { headers: authHeaders() })
      const d   = await res.json()
      setPedidos(d.compras ?? [])
    } finally { setCargando(false) }
  }, [authHeaders])

  useEffect(() => {
    if (!user) return
    if (tabActiva === "citas")   cargarCitas()
    if (tabActiva === "pedidos") cargarPedidos()
  }, [user, tabActiva])

  const citasFiltradas   = citas.filter(c =>
    c.nombre_cliente.toLowerCase().includes(buscar.toLowerCase()) ||
    c.nombre_mascota.toLowerCase().includes(buscar.toLowerCase())
  )
  const pedidosFiltrados = pedidos.filter(p =>
    p.nombre_cliente.toLowerCase().includes(buscar.toLowerCase())
  )

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <PawPrint className="w-10 h-10 text-amber-400 animate-bounce" />
    </div>
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {/* Modales */}
      {itemPago && (
        <ModalPago
          tipo={itemPago.tipo}
          item={itemPago.item}
          onClose={() => setItemPago(null)}
          accessToken={accessToken}
          onPagado={r => {
            setItemPago(null)
            setRecibo(r)
            if (tabActiva === "citas")   cargarCitas()
            if (tabActiva === "pedidos") cargarPedidos()
          }}
        />
      )}
      {recibo && <ModalRecibo recibo={recibo} onClose={() => setRecibo(null)} />}

      {/* Navbar */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cajero")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm">
              <ArrowLeft size={18}/><span className="hidden sm:block">Panel cajero</span>
            </button>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-200" />
              <span className="text-white font-black text-lg">Punto <span className="text-amber-200">de Venta</span></span>
            </div>
          </div>
          <button onClick={() => tabActiva === "citas" ? cargarCitas() : cargarPedidos()}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-semibold">
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            <span className="hidden sm:block">Actualizar</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-8 text-white">
          <h1 className="text-2xl font-black mb-1">Punto de Venta 💳</h1>
          <p className="text-amber-100 text-sm">Cobra citas de servicio y pedidos de productos.</p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre de cliente o mascota..."
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:border-amber-400 focus:outline-none shadow-sm"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 w-fit">
          {([
            { key:"citas",   label:"Citas de servicio", icon:Scissors, count:citasFiltradas.length },
            { key:"pedidos", label:"Pedidos productos",  icon:ShoppingBag, count:pedidosFiltrados.length },
          ] as const).map(({ key, label, icon:Icon, count }) => (
            <button key={key} onClick={() => setTabActiva(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                tabActiva === key ? "bg-amber-500 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              <Icon size={15}/> {label}
              {count > 0 && (
                <span className={`text-[10px] font-black px-1.5 rounded-full ${tabActiva === key ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {cargando ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-400" size={32}/></div>
        ) : tabActiva === "citas" ? (
          citasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <Scissors className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No hay citas pendientes de cobro</p>
              <p className="text-gray-400 text-sm mt-1">Solo aparecen citas confirmadas o completadas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {citasFiltradas.map(c => (
                <TarjetaCita key={c.id_cita} cita={c} onCobrar={c => setItemPago({ tipo:"cita", item:c })} />
              ))}
            </div>
          )
        ) : (
          pedidosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No hay pedidos pendientes de cobro</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pedidosFiltrados.map(p => (
                <TarjetaPedido key={p.id_compra} pedido={p} onCobrar={p => setItemPago({ tipo:"pedido", item:p })} />
              ))}
            </div>
          )
        )}

        {/* Link cierre de caja */}
        <div className="text-center">
          <button onClick={() => router.push("/cajero/cierre-de-caja")}
            className="text-sm text-amber-600 font-bold hover:underline flex items-center gap-1.5 mx-auto">
            <Receipt size={14}/> Ver cierre de caja del día →
          </button>
        </div>

      </main>
    </div>
  )
}