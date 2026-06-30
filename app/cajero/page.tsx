"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import {
  ShoppingCart, CreditCard, Package, Truck, LogOut, Bell,
  PawPrint, ChevronRight, DollarSign, AlertTriangle, RefreshCw,
  ShoppingBag, Loader2, AlertCircle, CheckCircle,
  XCircle, BarChart3, Plus, Search, Edit2, ToggleLeft, ToggleRight,
  ImagePlus, ChevronLeft, X, Layers, Receipt, QrCode,
  Banknote, ArrowRightLeft, Tag, Calendar, Clock,
  Printer, TrendingUp, Hash
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface AlertaStock {
  id_producto: number; nombre: string; categoria: string
  stock_actual: number; stock_minimo: number; estado: string
  nivel_alerta: string; cantidad_recomendada_compra?: number; consumo_30_dias?: number
}
interface AltoConsumo {
  nombre_groomer: string; id_trabajador: number; producto: string
  categoria: string; total_consumido: number; sesiones: number; promedio_por_sesion: number
}
interface Reabastecimiento {
  id_producto: number; nombre: string; categoria: string
  stock_actual: number; stock_minimo: number; stock_objetivo: number
  cantidad_a_pedir: number; proveedor_sugerido: string | null
  email_proveedor: string | null; telefono_proveedor: string | null; precio_referencia: number | null
}
interface ResumenAlertas {
  total_alertas: number; bajo_stock_productos: number
  bajo_stock_insumos: number; alto_consumo: number; reabastecimiento: number
}
interface Producto {
  id_producto: number; nombre: string; descripcion: string | null
  categoria: string; activo: boolean; imagen_url: string | null
  precio_venta: number; precio_costo: number
  presentacion: string | null; marca: string | null; codigo_barras: string | null
  stock_actual: number; stock_minimo: number; estado_stock: string
}
interface CitaPendiente {
  id_cita: number; fecha_programada: string; hora_programada: string
  estado_reserva: string; nombre_cliente: string; telefono_cliente: string
  id_usuario_cliente: number; id_cliente_tabla: number
  nombre_mascota: string; especie: string
  nombre_servicio: string; precio_servicio: number
}
interface PedidoPendiente {
  id_compra: number
  total: number
  descuento_aplicado: number
  fecha: string
  estado: string
  nombre_cliente: string
  telefono_cliente: string
  email_cliente: string
  cantidad_items: number
  items: { nombre_producto: string; cantidad: number; precio_unitario: number; subtotal: number }[]
}
interface CobroHoy {
  id_cobra: number; monto_cobrado: number; fecha: string
  metodo_pago: string; estado_pago: string; id_cita: number
  nombre_cliente: string; nombre_mascota: string; nombre_servicio: string
  nro_factura: string | null; total_compra: number; descuento_aplicado: number
}
interface TotalesHoy {
  total_cobros: number; total_monto: number
  efectivo: number; qr: number; transferencia: number
  tarjeta_credito: number; tarjeta_debito: number
}


interface Cierre {
  fecha: string
  resumen: {
    total_transacciones: number
    cobros_citas: number
    cobros_pedidos: number
    total_bruto: number
    total_citas: number
    total_pedidos: number
    total_descuentos: number
    total_neto: number
    facturas_emitidas: number
  }
  por_metodo: { metodo_pago: string; cantidad: number; total: number }[]
  detalle: {
    id: number; tipo: "servicio" | "producto"; monto_cobrado: number
    metodo_pago: string; hora_programada: string | null; cliente: string
    mascota: string | null; concepto: string; descuento_aplicado: number
    nro_factura: string | null; fecha_str: string
  }[]
  pendientes_cobro: number
  pendientes_pedidos: number
}

// ── Constantes ─────────────────────────────────────────────────────────────
const CATEGORIAS = ["shampoo","acondicionador","accesorio","alimento","suplemento","medicamento","juguete","higiene","otro"]
const CAT_COLOR: Record<string, string> = {
  alimento:"bg-green-100 text-green-700", accesorio:"bg-blue-100 text-blue-700",
  shampoo:"bg-purple-100 text-purple-700", acondicionador:"bg-violet-100 text-violet-700",
  suplemento:"bg-teal-100 text-teal-700", medicamento:"bg-red-100 text-red-700",
  juguete:"bg-pink-100 text-pink-700", higiene:"bg-cyan-100 text-cyan-700",
  otro:"bg-gray-100 text-gray-600",
}
const STOCK_COLOR: Record<string, string> = {
  disponible:"bg-green-100 text-green-700", bajo:"bg-amber-100 text-amber-700", agotado:"bg-red-100 text-red-700"
}
const NIVEL_COLOR: Record<string, string> = {
  agotado:"bg-red-100 text-red-700 border-red-200",
  bajo:"bg-amber-100 text-amber-700 border-amber-200",
  ok:"bg-green-100 text-green-700 border-green-200",
}
const NIVEL_ICONO: Record<string, string> = { agotado:"🔴", bajo:"🟡", ok:"🟢" }
const METODO_ICONO: Record<string, React.ReactNode> = {
  efectivo:       <Banknote size={16} />,
  qr:             <QrCode size={16} />,
  transferencia:  <ArrowRightLeft size={16} />,
  tarjeta_credito:<CreditCard size={16} />,
  tarjeta_debito: <CreditCard size={16} />,
}
const METODO_COLOR: Record<string, string> = {
  efectivo:"bg-green-100 text-green-700",
  qr:"bg-violet-100 text-violet-700",
  transferencia:"bg-blue-100 text-blue-700",
  tarjeta_credito:"bg-amber-100 text-amber-700",
  tarjeta_debito:"bg-orange-100 text-orange-700",
}

const FORM_VACIO = {
  nombre:"", descripcion:"", categoria:"alimento", imagen_url:"",
  precio_venta:"", precio_costo:"", presentacion:"", marca:"", codigo_barras:"",
  stock_inicial:"0", stock_minimo:"5",
}
const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
const selectCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none bg-white"

// ── Recibo de pago (pantalla de confirmación) ──────────────────────────────
// ── Recibo de pago — con botón de descarga PDF via jsPDF (CDN) ──────────────
function Recibo({ cobro, cita, onCerrar }: {
  cobro: { id_pago: number; monto_cobrado: number; metodo_pago: string; descuento_aplicado: number; nro_factura: string | null }
  cita: CitaPendiente
  onCerrar: () => void
}) {
  const [generandoPdf, setGenerandoPdf] = React.useState(false)

  const descargarPDF = async () => {
    setGenerandoPdf(true)
    try {
      // Cargamos jsPDF dinámicamente desde CDN (no requiere instalación npm)
      if (!(window as any).jspdf) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script")
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          s.onload = () => resolve()
          s.onerror = () => reject(new Error("No se pudo cargar jsPDF"))
          document.head.appendChild(s)
        })
      }
      const { jsPDF } = (window as any).jspdf
      const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" })

      const W = doc.internal.pageSize.getWidth()
      let y = 15

      // ── Encabezado ──────────────────────────────────────────────────────
      doc.setFillColor(245, 158, 11)          // amber-500
      doc.roundedRect(10, y - 5, W - 20, 28, 4, 4, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16); doc.setFont("helvetica", "bold")
      doc.text("SPA MASCOTAS", W / 2, y + 4, { align: "center" })
      doc.setFontSize(9); doc.setFont("helvetica", "normal")
      doc.text("Comprobante de Pago", W / 2, y + 11, { align: "center" })
      doc.text(`Recibo #${cobro.id_pago}  ·  ${new Date().toLocaleDateString("es-BO")}`, W / 2, y + 17, { align: "center" })
      y += 32

      // ── Línea separadora ────────────────────────────────────────────────
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.4)
      doc.line(10, y, W - 10, y)
      y += 6

      // ── Datos del servicio ───────────────────────────────────────────────
      doc.setTextColor(55, 65, 81)
      doc.setFontSize(8); doc.setFont("helvetica", "bold")
      doc.text("DETALLE DEL SERVICIO", 12, y)
      y += 5

      const filas = [
        ["Cliente",  cita.nombre_cliente],
        ["Mascota",  cita.nombre_mascota || "—"],
        ["Servicio", cita.nombre_servicio || "—"],
        ["Fecha",    new Date(cita.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })],
        ["Hora",     cita.hora_programada?.slice(0, 5) || "—"],
      ]

      doc.setFontSize(8)
      for (const [label, val] of filas) {
        doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128)
        doc.text(label, 12, y)
        doc.setFont("helvetica", "bold"); doc.setTextColor(31, 41, 55)
        doc.text(String(val), W / 2, y, { align: "left" })
        y += 6
      }

      y += 2
      doc.setDrawColor(229, 231, 235); doc.line(10, y, W - 10, y); y += 5

      // ── Resumen de cobro ─────────────────────────────────────────────────
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(55, 65, 81)
      doc.text("RESUMEN DE COBRO", 12, y); y += 5

      const precio = Number(cita.precio_servicio) || 0
      const desc   = Number(cobro.descuento_aplicado) || 0

      doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128)
      doc.text("Subtotal",       12, y); doc.setTextColor(31, 41, 55); doc.text(`Bs. ${precio.toFixed(2)}`,       W - 12, y, { align: "right" }); y += 5
      if (desc > 0) {
        doc.setTextColor(107, 114, 128); doc.text("Descuento",     12, y)
        doc.setTextColor(22, 163, 74);   doc.text(`- Bs. ${desc.toFixed(2)}`, W - 12, y, { align: "right" }); y += 5
      }

      // Total
      doc.setFillColor(254, 243, 199)
      doc.roundedRect(10, y - 3, W - 20, 10, 2, 2, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(180, 83, 9)
      doc.text("TOTAL PAGADO",                 14, y + 3)
      doc.text(`Bs. ${Number(cobro.monto_cobrado).toFixed(2)}`, W - 12, y + 3, { align: "right" })
      y += 14

      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128)
      doc.text("Método de pago", 12, y)
      doc.setTextColor(31, 41, 55); doc.setFont("helvetica", "bold")
      doc.text(cobro.metodo_pago.replace("_", " ").toUpperCase(), W - 12, y, { align: "right" }); y += 5

      if (cobro.nro_factura) {
        doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128)
        doc.text("Nro. Factura", 12, y)
        doc.setFont("helvetica", "bold"); doc.setTextColor(109, 40, 217)
        doc.text(cobro.nro_factura, W - 12, y, { align: "right" }); y += 5
      }

      y += 3
      doc.setDrawColor(229, 231, 235); doc.line(10, y, W - 10, y); y += 6

      // ── Pie ─────────────────────────────────────────────────────────────
      doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(156, 163, 175)
      doc.text("SPA Mascotas · Gracias por su preferencia 🐾", W / 2, y, { align: "center" })

      doc.save(`recibo-${cobro.id_pago}-${cita.nombre_cliente.replace(/ /g, "_")}.pdf`)
    } catch (err) {
      console.error("Error generando PDF:", err)
      alert("No se pudo generar el PDF. Revisa la consola.")
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header verde */}
        <div className="bg-green-500 px-6 py-5 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-black text-lg">¡Pago registrado!</p>
          <p className="text-green-100 text-sm">Recibo #{cobro.id_pago}</p>
        </div>

        {/* Cuerpo recibo */}
        <div className="px-6 py-5 space-y-1 text-sm border-b border-dashed border-gray-200">
          {[
            ["Cliente",   cita.nombre_cliente],
            ["Mascota",   cita.nombre_mascota],
            ["Servicio",  cita.nombre_servicio],
            ["Fecha",     new Date(cita.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" })],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-1">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-800">{val}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-semibold">Bs. {Number(cita.precio_servicio).toFixed(2)}</span>
          </div>
          {cobro.descuento_aplicado > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Descuento</span>
              <span className="font-semibold">- Bs. {Number(cobro.descuento_aplicado).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black text-gray-800 border-t border-gray-100 pt-2 mt-2">
            <span>Total pagado</span>
            <span className="text-green-600">Bs. {Number(cobro.monto_cobrado).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Método de pago</span>
            <span className="font-semibold capitalize">{cobro.metodo_pago.replace("_", " ")}</span>
          </div>
          {cobro.nro_factura && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Nro. Factura</span>
              <span className="font-semibold text-violet-600">{cobro.nro_factura}</span>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 space-y-2 text-center">
          <p className="text-xs text-gray-400">SPA Mascotas · Gracias por su preferencia 🐾</p>
          {/* Botón PDF — solo aparece si se emitió factura o siempre como comprobante */}
          <button
            onClick={descargarPDF}
            disabled={generandoPdf}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition"
          >
            {generandoPdf
              ? <><Loader2 size={14} className="animate-spin" /> Generando PDF...</>
              : <><Printer size={14} /> Descargar comprobante PDF</>
            }
          </button>
          <button
            onClick={onCerrar}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition"
          >
            Cerrar recibo
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de cobro — flujo diferenciado por método de pago ─────────────────
function ModalCobro({ cita, onClose, onCobrado, accessToken }: {
  cita: CitaPendiente
  onClose: () => void
  onCobrado: (cobro: any) => void
  accessToken: string | null
}) {
  const [metodoPago, setMetodoPago]         = useState("efectivo")
  const [codigoCupon, setCodigoCupon]       = useState("")
  const [descuento, setDescuento]           = useState(0)
  const [cuponData, setCuponData]           = useState<any>(null)
  const [cuponMsg, setCuponMsg]             = useState<{ ok: boolean; texto: string } | null>(null)
  const [validandoCupon, setValidandoCupon] = useState(false)
  const [emitirFactura, setEmitirFactura]   = useState(false)
  const [datosFiscales, setDatosFiscales]   = useState("")
  const [procesando, setProcesando]         = useState(false)
  const [error, setError]                   = useState("")

  // Campos específicos por método
  const [nroTarjeta, setNroTarjeta]         = useState("")
  const [tarjetaValida, setTarjetaValida]   = useState<boolean | null>(null)
  const [comprobante, setComprobante]       = useState("") // para transferencia: nro de transacción

  const precioBase = Number(cita.precio_servicio) || 0
  const montoFinal = Math.max(0, precioBase - descuento)

  // ── QR de cobro estático (datos del spa codificados) ────────────────────
  // Usamos la API pública qr-server.com — no requiere librería
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    `SPA MASCOTAS\nMonto: Bs. ${montoFinal.toFixed(2)}\nConcepto: ${cita.nombre_servicio || "Servicio"}\nCliente: ${cita.nombre_cliente}\nRef: CITA-${cita.id_cita}`
  )}`

  // ── Algoritmo de Luhn para validar tarjeta ───────────────────────────────
  const validarLuhn = (num: string): boolean => {
    const digits = num.replace(/\s/g, "").split("").map(Number)
    if (digits.length < 13 || digits.length > 19) return false
    let suma = 0
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits[i]
      if ((digits.length - 1 - i) % 2 === 1) {
        d *= 2
        if (d > 9) d -= 9
      }
      suma += d
    }
    return suma % 10 === 0
  }

  const manejarTarjeta = (val: string) => {
    // Formatear con espacios cada 4 dígitos
    const clean = val.replace(/\D/g, "").slice(0, 16)
    const formateado = clean.replace(/(.{4})/g, "$1 ").trim()
    setNroTarjeta(formateado)
    if (clean.length === 16) setTarjetaValida(validarLuhn(clean))
    else setTarjetaValida(null)
  }

  const validarCupon = async () => {
    if (!codigoCupon.trim()) return
    setValidandoCupon(true); setCuponMsg(null)
    try {
      // POST /api/cupones/validar — accesible por cualquier rol autenticado
      const res = await fetch("/api/cupones/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ codigo: codigoCupon.trim(), subtotal: precioBase }),
      })
      const d = await res.json()
      if (d.valido) {
        setDescuento(d.descuento_calculado)
        setCuponData(d)
        setCuponMsg({ ok: true, texto: `✓ ${d.message}` })
      } else {
        setDescuento(0); setCuponData(null)
        setCuponMsg({ ok: false, texto: d.message })
      }
    } catch {
      setCuponMsg({ ok: false, texto: "Error al validar cupón" })
    } finally { setValidandoCupon(false) }
  }

  const cobrar = async () => {
    // Validaciones adicionales por método
    if ((metodoPago === "tarjeta_credito" || metodoPago === "tarjeta_debito") && tarjetaValida !== true) {
      setError("Ingresa un número de tarjeta válido (16 dígitos)"); return
    }
    if (metodoPago === "transferencia" && !comprobante.trim()) {
      setError("Ingresa el número de comprobante de transferencia"); return
    }
    setProcesando(true); setError("")
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          id_cita:            cita.id_cita,
          metodo_pago:        metodoPago,
          monto_cobrado:      montoFinal,
          descuento_aplicado: descuento,
          codigo_cupon:       cuponData?.codigo || undefined,
          emitir_factura:     emitirFactura,
          datos_fiscales:     datosFiscales || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.message); return }
      onCobrado({ ...d, descuento_aplicado: descuento })
    } catch {
      setError("Error de conexión")
    } finally { setProcesando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pt-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-gray-800">Punto de venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Resumen de la cita */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Detalle del servicio</p>
            <div className="space-y-1 text-sm">
              {[
                ["Cliente",  cita.nombre_cliente],
                ["Mascota",  `${cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"} ${cita.nombre_mascota}`],
                ["Servicio", cita.nombre_servicio],
                ["Hora",     cita.hora_programada?.slice(0,5)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-bold text-gray-800">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-amber-200 pt-2 mt-2">
                <span className="font-bold text-gray-700">Precio base</span>
                <span className="font-black text-amber-600 text-base">Bs. {precioBase.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key:"efectivo",        label:"Efectivo",     icon:<Banknote size={18}/> },
                { key:"qr",              label:"QR",           icon:<QrCode size={18}/> },
                { key:"transferencia",   label:"Transferencia",icon:<ArrowRightLeft size={18}/> },
                { key:"tarjeta_credito", label:"T. Crédito",   icon:<CreditCard size={18}/> },
                { key:"tarjeta_debito",  label:"T. Débito",    icon:<CreditCard size={18}/> },
              ].map(({ key, label, icon }) => (
                <button key={key} onClick={() => { setMetodoPago(key); setError("") }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    metodoPago === key
                      ? "border-amber-500 bg-amber-50 text-amber-700 scale-[1.02]"
                      : "border-gray-200 text-gray-500 hover:border-amber-300 hover:bg-amber-50"
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Panel específico por método ── */}

          {/* EFECTIVO: sin campos extra, solo confirmación visual */}
          {metodoPago === "efectivo" && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-black text-green-800 text-sm">Cobro en efectivo</p>
                <p className="text-xs text-green-600">Recibe <strong>Bs. {montoFinal.toFixed(2)}</strong> del cliente y entrega cambio si corresponde.</p>
              </div>
            </div>
          )}

          {/* QR: mostrar código QR para que el cliente escanee */}
          {metodoPago === "qr" && (
            <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs font-black text-violet-700 uppercase tracking-wider">Código QR de cobro</p>
              <div className="flex justify-center">
                <img
                  src={qrUrl}
                  alt="QR de cobro"
                  className="w-44 h-44 rounded-xl border-4 border-white shadow-lg"
                />
              </div>
              <p className="text-sm font-black text-violet-800">Bs. {montoFinal.toFixed(2)}</p>
              <p className="text-xs text-violet-500">Muestra este QR al cliente para que realice el pago desde su billetera digital.</p>
            </div>
          )}

          {/* TRANSFERENCIA: el cliente muestra su comprobante */}
          {metodoPago === "transferencia" && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="font-black text-blue-800 text-sm">Transferencia bancaria</p>
              </div>
              <div className="bg-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-0.5">
                <p className="font-black">Datos bancarios del spa:</p>
                <p>Banco: <strong>Banco Unión S.A.</strong></p>
                <p>Cuenta: <strong>10000123456789</strong></p>
                <p>Titular: <strong>Spa Mascotas S.R.L.</strong></p>
                <p>Monto exacto: <strong>Bs. {montoFinal.toFixed(2)}</strong></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-1">Nro. de comprobante / transacción <span className="text-red-500">*</span></label>
                <input
                  value={comprobante}
                  onChange={e => { setComprobante(e.target.value); setError("") }}
                  placeholder="Ej: TRX-20260602-001"
                  className="w-full border-2 border-blue-200 rounded-xl px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <p className="text-xs text-blue-500">Solicita al cliente que muestre su comprobante de transferencia antes de confirmar.</p>
            </div>
          )}

          {/* TARJETA CRÉDITO / DÉBITO */}
          {(metodoPago === "tarjeta_credito" || metodoPago === "tarjeta_debito") && (
            <div className={`border-2 rounded-2xl p-4 space-y-3 ${metodoPago === "tarjeta_credito" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
              <div className="flex items-center gap-2">
                <CreditCard className={`w-5 h-5 shrink-0 ${metodoPago === "tarjeta_credito" ? "text-amber-600" : "text-orange-600"}`} />
                <p className={`font-black text-sm ${metodoPago === "tarjeta_credito" ? "text-amber-800" : "text-orange-800"}`}>
                  {metodoPago === "tarjeta_credito" ? "Tarjeta de Crédito" : "Tarjeta de Débito"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Número de tarjeta <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    value={nroTarjeta}
                    onChange={e => manejarTarjeta(e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none transition-colors ${
                      tarjetaValida === true  ? "border-green-400 bg-green-50" :
                      tarjetaValida === false ? "border-red-400 bg-red-50" :
                      "border-gray-200 focus:border-amber-400"
                    }`}
                  />
                  {tarjetaValida === true  && <CheckCircle  size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
                  {tarjetaValida === false && <XCircle      size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"   />}
                </div>
                {tarjetaValida === true  && <p className="text-xs text-green-600 font-semibold mt-1">✓ Tarjeta válida</p>}
                {tarjetaValida === false && <p className="text-xs text-red-500 font-semibold mt-1">✗ Número de tarjeta inválido</p>}
                <p className="text-xs text-gray-400 mt-1">Solo se valida el formato (16 dígitos, algoritmo Luhn). No se almacena el número.</p>
              </div>
            </div>
          )}

          {/* Cupón de descuento */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Tag size={14}/> Cupón de descuento</p>
            <div className="flex gap-2">
              <input
                value={codigoCupon}
                onChange={e => { setCodigoCupon(e.target.value.toUpperCase()); setCuponMsg(null); setDescuento(0); setCuponData(null) }}
                onKeyDown={e => e.key === "Enter" && validarCupon()}
                placeholder="Ej: DESCUENTO20"
                className={inputCls + " uppercase"}
              />
              <button onClick={validarCupon} disabled={validandoCupon || !codigoCupon}
                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold rounded-xl text-sm disabled:opacity-40 whitespace-nowrap">
                {validandoCupon ? <Loader2 size={14} className="animate-spin"/> : "Validar"}
              </button>
            </div>
            {cuponMsg && (
              <p className={`text-xs mt-1.5 font-semibold ${cuponMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {cuponMsg.texto}
              </p>
            )}
          </div>

          {/* Factura */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={emitirFactura} onChange={e => setEmitirFactura(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded" />
              <span className="text-sm font-bold text-gray-700">Emitir factura</span>
            </label>
            {emitirFactura && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre / NIT para factura</label>
                <input value={datosFiscales} onChange={e => setDatosFiscales(e.target.value)}
                  placeholder={cita.nombre_cliente}
                  className={inputCls} />
              </div>
            )}
          </div>

          {/* Resumen de cobro */}
          <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>Bs. {precioBase.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento</span>
                <span>- Bs. {descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base border-t border-amber-100 pt-2 mt-2">
              <span>Total a cobrar</span>
              <span className="text-amber-600 text-xl">Bs. {montoFinal.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={13}/> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={cobrar}
            disabled={procesando || montoFinal <= 0 ||
              ((metodoPago === "tarjeta_credito" || metodoPago === "tarjeta_debito") && tarjetaValida !== true) ||
              (metodoPago === "transferencia" && !comprobante.trim())
            }
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {procesando ? <Loader2 size={15} className="animate-spin"/> : <Receipt size={15}/>}
            {procesando ? "Procesando..." : `Cobrar Bs. ${montoFinal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalProducto({ producto, onClose, onSaved, accessToken }: {
  producto: Producto | null; onClose: () => void; onSaved: () => void; accessToken: string | null
}) {
  const esEdicion = !!producto
  const [form, setForm] = useState(esEdicion ? {
    nombre: producto!.nombre, descripcion: producto!.descripcion ?? "",
    categoria: producto!.categoria, imagen_url: producto!.imagen_url ?? "",
    precio_venta: String(producto!.precio_venta), precio_costo: String(producto!.precio_costo),
    presentacion: producto!.presentacion ?? "", marca: producto!.marca ?? "",
    codigo_barras: producto!.codigo_barras ?? "", stock_inicial: String(producto!.stock_actual),
    stock_minimo: String(producto!.stock_minimo),
  } : FORM_VACIO)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<{tipo:"ok"|"error", texto:string} | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  const subirImagen = async (file: File) => {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body:fd })
      const data = await res.json()
      if (data.secure_url) set("imagen_url", data.secure_url)
      else setMsg({ tipo:"error", texto:"Error al subir imagen" })
    } catch { setMsg({ tipo:"error", texto:"Error de conexión con Cloudinary" }) }
    finally { setSubiendo(false) }
  }

  const guardar = async () => {
    if (!form.nombre || !form.categoria || !form.precio_venta || !form.precio_costo) {
      setMsg({ tipo:"error", texto:"Nombre, categoría y precios son requeridos" }); return
    }
    setGuardando(true); setMsg(null)
    try {
      const url = esEdicion ? `/api/productos/${producto!.id_producto}` : "/api/productos"
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type":"application/json", ...(accessToken ? { Authorization:`Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ ...form, precio_venta:parseFloat(form.precio_venta), precio_costo:parseFloat(form.precio_costo), stock_inicial:parseInt(form.stock_inicial), stock_actual:esEdicion?parseInt(form.stock_inicial):undefined, stock_minimo:parseInt(form.stock_minimo) }),
      })
      const data = await res.json()
      if (res.ok) { setMsg({ tipo:"ok", texto:data.message }); setTimeout(() => { onSaved(); onClose() }, 800) }
      else setMsg({ tipo:"error", texto:data.message || "Error al guardar" })
    } catch { setMsg({ tipo:"error", texto:"Error de conexión" }) }
    finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-6 pb-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-black text-gray-800 text-base">{esEdicion ? "Editar producto" : "Nuevo producto"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${msg.tipo==="ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {msg.tipo==="ok" ? <CheckCircle size={15}/> : <XCircle size={15}/>} {msg.texto}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Imagen</label>
            <div className="flex gap-3 items-start">
              {form.imagen_url ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200 shrink-0">
                  <img src={form.imagen_url} alt="preview" className="w-full h-full object-cover"/>
                  <button onClick={() => set("imagen_url","")} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"><X size={10}/></button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 shrink-0"><ImagePlus size={24}/></div>
              )}
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && subirImagen(e.target.files[0])}/>
                <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-amber-300 text-amber-600 text-sm font-semibold rounded-xl hover:bg-amber-50 disabled:opacity-50">
                  {subiendo ? <Loader2 size={14} className="animate-spin"/> : <ImagePlus size={14}/>}
                  {subiendo ? "Subiendo..." : "Subir imagen"}
                </button>
                <input value={form.imagen_url} onChange={e => set("imagen_url",e.target.value)} placeholder="O pega una URL..." className={inputCls+" text-xs"}/>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre <span className="text-red-500">*</span></label><input value={form.nombre} onChange={e => set("nombre",e.target.value)} className={inputCls} placeholder="Shampoo para perros"/></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoría <span className="text-red-500">*</span></label><select value={form.categoria} onChange={e => set("categoria",e.target.value)} className={selectCls}>{CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></div>
          </div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Descripción</label><textarea value={form.descripcion} onChange={e => set("descripcion",e.target.value)} rows={2} className={inputCls} placeholder="Descripción opcional..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Marca</label><input value={form.marca} onChange={e => set("marca",e.target.value)} className={inputCls} placeholder="BioClean"/></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Presentación</label><input value={form.presentacion} onChange={e => set("presentacion",e.target.value)} className={inputCls} placeholder="500ml, 1kg..."/></div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Precios (Bs.)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Precio venta <span className="text-red-500">*</span></label><input type="number" min="0" step="0.01" value={form.precio_venta} onChange={e => set("precio_venta",e.target.value)} className={inputCls} placeholder="0.00"/></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Precio costo <span className="text-red-500">*</span></label><input type="number" min="0" step="0.01" value={form.precio_costo} onChange={e => set("precio_costo",e.target.value)} className={inputCls} placeholder="0.00"/></div>
            </div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Código de barras</label><input value={form.codigo_barras} onChange={e => set("codigo_barras",e.target.value)} className={inputCls} placeholder="Opcional"/></div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Inventario</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">{esEdicion ? "Stock actual" : "Stock inicial"}</label><input type="number" min="0" value={form.stock_inicial} onChange={e => set("stock_inicial",e.target.value)} className={inputCls}/></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Stock mínimo</label><input type="number" min="0" value={form.stock_minimo} onChange={e => set("stock_minimo",e.target.value)} className={inputCls}/></div>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {guardando ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>}
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
function PedidoPendienteRow({ pedido, accessToken, onCobrado }: {
  pedido: PedidoPendiente
  accessToken: string | null
  onCobrado: () => void
}) {
  const [expandido, setExpandido] = useState(false)
  const [cobrando, setCobrando]   = useState(false)
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [modalAbierto, setModalAbierto] = useState(false)
  const [error, setError]         = useState("")
  const [procesando, setProcesando] = useState(false)
 
  const cobrarPedido = async () => {
    setProcesando(true); setError("")
    try {
      const res = await fetch(`/api/pedidos/${pedido.id_compra}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
         body: JSON.stringify({ estado: "pagada", metodo_pago: metodoPago }),
      })
      const d = await res.json()
      if (res.ok) {
        setModalAbierto(false)
        onCobrado()
      } else {
        setError(d.message || "Error al cobrar")
      }
    } catch {
      setError("Error de conexión")
    } finally { setProcesando(false) }
  }
 
  const METODOS_SIMPLES = [
    { key:"efectivo",       label:"Efectivo" },
    { key:"qr",             label:"QR Banco Unión" },
    { key:"transferencia",  label:"Transferencia" },
    { key:"tarjeta_debito", label:"T. Débito" },
    { key:"tarjeta_credito",label:"T. Crédito" },
  ]
 
  return (
    <>
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-violet-50 transition-colors">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-xl shrink-0">
          🛍️
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 truncate">{pedido.nombre_cliente}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">
              Pedido #{pedido.id_compra} · {pedido.cantidad_items} producto{pedido.cantidad_items !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setExpandido(v => !v)}
              className="text-[10px] text-violet-500 font-bold hover:underline"
            >
              {expandido ? "ocultar" : "ver detalle"}
            </button>
          </div>
          {expandido && (
            <div className="mt-2 space-y-1">
              {pedido.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-500">
                  <span>{item.nombre_producto} x{item.cantidad}</span>
                  <span>Bs. {Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-violet-600">Bs. {Number(pedido.total).toFixed(2)}</p>
          {pedido.descuento_aplicado > 0 && (
            <p className="text-[10px] text-green-600">cupón - Bs. {Number(pedido.descuento_aplicado).toFixed(2)}</p>
          )}
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shrink-0"
        >
          <Receipt size={13}/> Cobrar
        </button>
      </div>
 
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <p className="font-black text-white">Cobrar pedido #{pedido.id_compra}</p>
                <p className="text-violet-100 text-xs">{pedido.nombre_cliente}</p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="text-white/70 hover:text-white">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                <div className="flex justify-between text-sm font-black text-gray-800">
                  <span>Total a cobrar</span>
                  <span className="text-violet-600 text-xl">Bs. {Number(pedido.total).toFixed(2)}</span>
                </div>
                {pedido.descuento_aplicado > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Incluye descuento de Bs. {Number(pedido.descuento_aplicado).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_SIMPLES.map(m => (
                    <button key={m.key}
                      onClick={() => setMetodoPago(m.key)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                        metodoPago === m.key
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-gray-200 text-gray-500 hover:border-violet-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200 flex items-center gap-1">
                  <AlertCircle size={12}/> {error}
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setModalAbierto(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={cobrarPedido} disabled={procesando}
                  className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {procesando ? <><Loader2 size={14} className="animate-spin"/> Procesando...</> : <><Receipt size={14}/> Confirmar cobro</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


async function generarPDFCierre(cierre: any) {
  if (!(window as any).jspdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script")
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
      s.onload = () => resolve()
      s.onerror = () => reject()
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = (window as any).jspdf
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const W = doc.internal.pageSize.getWidth()
  let y = 14
 
  const fmt = (v: any) => `Bs. ${Number(v).toFixed(2)}`
  const fechaES = new Date(cierre.fecha + "T00:00:00").toLocaleDateString("es-BO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })
 
  // ── Encabezado ────────────────────────────────────────────────────────
  doc.setFillColor(245, 158, 11) // amber-500
  doc.rect(0, 0, W, 24, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15); doc.setFont("helvetica", "bold")
  doc.text("SPA MASCOTAS — Cierre de Caja Diario", W / 2, 10, { align: "center" })
  doc.setFontSize(9); doc.setFont("helvetica", "normal")
  doc.text(fechaES, W / 2, 17, { align: "center" })
  doc.text(`Generado: ${new Date().toLocaleString("es-BO")}`, W / 2, 21, { align: "center" })
  y = 32
 
  // ── Resumen en tarjetas ────────────────────────────────────────────────
  const cards = [
    { label: "Transacciones",  val: cierre.resumen.total_transacciones },
    { label: "Total bruto",    val: fmt(cierre.resumen.total_bruto) },
    { label: "Citas cobradas", val: fmt(cierre.resumen.total_citas) },
    { label: "Pedidos cobrados",val: fmt(cierre.resumen.total_pedidos) },
    { label: "Descuentos",     val: fmt(cierre.resumen.total_descuentos) },
    { label: "Facturas",       val: cierre.resumen.facturas_emitidas },
  ]
  const cW = (W - 20) / 3
  cards.forEach(({ label, val }, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = 10 + col * cW
    const cy = y + row * 18
    doc.setFillColor(254, 243, 199)
    doc.roundedRect(cx, cy - 3, cW - 2, 15, 2, 2, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(180, 83, 9)
    doc.text(String(val), cx + (cW - 2) / 2, cy + 4, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(107, 114, 128)
    doc.text(label, cx + (cW - 2) / 2, cy + 9, { align: "center" })
  })
  y += 42
 
  // ── Por método de pago ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(55, 65, 81)
  doc.text("Desglose por método de pago", 10, y); y += 4
  doc.setLineWidth(0.3); doc.setDrawColor(229, 231, 235); doc.line(10, y, W - 10, y); y += 4
 
  cierre.por_metodo.forEach((m: any) => {
    const pct = cierre.resumen.total_bruto > 0
      ? Math.min(100, (Number(m.total) / Number(cierre.resumen.total_bruto)) * 100)
      : 0
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(55, 65, 81)
    doc.text(m.metodo_pago.replace(/_/g, " ").toUpperCase(), 10, y)
    // barra
    doc.setFillColor(229, 231, 235)
    doc.rect(45, y - 3.5, 100, 5, "F")
    doc.setFillColor(245, 158, 11)
    doc.rect(45, y - 3.5, pct, 5, "F")
    doc.setFont("helvetica", "bold"); doc.setTextColor(31, 41, 55)
    doc.text(`${fmt(m.total)} (${m.cantidad})`, W - 10, y, { align: "right" })
    y += 8
  })
  y += 4
 
  if (cierre.pendientes_cobro > 0 || cierre.pendientes_pedidos > 0) {
    doc.setFillColor(254, 226, 226)
    doc.roundedRect(10, y - 3, W - 20, 10, 2, 2, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(185, 28, 28)
    const msg = []
    if (cierre.pendientes_cobro > 0) msg.push(`${cierre.pendientes_cobro} citas sin cobrar`)
    if (cierre.pendientes_pedidos > 0) msg.push(`${cierre.pendientes_pedidos} pedidos sin cobrar`)
    doc.text(`⚠ Pendientes: ${msg.join(" · ")}`, W / 2, y + 3, { align: "center" })
    y += 14
  }
 
  // ── Detalle de cobros ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(55, 65, 81)
  doc.text("Detalle de cobros", 10, y); y += 4
  doc.line(10, y, W - 10, y); y += 3
 
  // Encabezado tabla
  doc.setFillColor(245, 158, 11)
  doc.rect(10, y - 2, W - 20, 7, "F")
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold")
  const headers = ["Tipo", "Cliente", "Concepto", "Método", "Desc.", "Total", "Factura"]
  const colW =    [16,      40,        45,          22,       14,      20,      28]
  let cx = 12
  headers.forEach((h, i) => { doc.text(h, cx, y + 3); cx += colW[i] })
  y += 8
 
  cierre.detalle.forEach((d: any, idx: number) => {
    if (y > 270) { doc.addPage(); y = 14 }
    if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(10, y - 2, W - 20, 6.5, "F") }
    doc.setTextColor(31, 41, 55); doc.setFont("helvetica", "normal"); doc.setFontSize(7)
    let x2 = 12
    const row = [
      d.tipo === "servicio" ? "🐾 Serv." : "🛍 Prod.",
      d.cliente,
      d.concepto || "—",
      (d.metodo_pago || "—").replace(/_/g, " "),
      d.descuento_aplicado > 0 ? `-Bs.${Number(d.descuento_aplicado).toFixed(0)}` : "—",
      fmt(d.monto_cobrado),
      d.nro_factura || "—",
    ]
    row.forEach((val, i) => {
      const maxW = colW[i] - 2
      const txt = doc.splitTextToSize(String(val), maxW)[0]
      doc.text(txt, x2, y + 3)
      x2 += colW[i]
    })
    y += 7
  })
 
  // Totalizador
  y += 3
  doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.5); doc.line(10, y, W - 10, y); y += 4
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(180, 83, 9)
  doc.text(`TOTAL DEL DÍA: ${fmt(cierre.resumen.total_bruto)}`, W - 10, y, { align: "right" })
 
  // Pie
  y += 12
  doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(156, 163, 175)
  doc.text("SPA Mascotas · Cierre de caja oficial · Conservar este documento", W / 2, y, { align: "center" })
 
  doc.save(`cierre-caja-${cierre.fecha}.pdf`)
}




export default function CajeroPage() {
  const { user, logout, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [avisoTimeout, setAvisoTimeout] = useState(false)
   const [generandoPDFCierre, setGenerandoPDFCierre] = useState(false)

  const [tabPrincipal, setTabPrincipal] = useState<"cobros" | "alertas" | "catalogo" | "cierre">("cobros")

  // ── Estados alertas ──
  const [tabAlerta, setTabAlerta] = useState<"resumen"|"productos"|"insumos"|"consumo"|"reabastecimiento">("resumen")
  const [cargandoAlertas, setCargandoAlertas] = useState(false)
  const [errorAlertas, setErrorAlertas]       = useState("")
  const [resumen, setResumen]                 = useState<ResumenAlertas | null>(null)
  const [bajoStockProductos, setBajoStockProductos] = useState<AlertaStock[]>([])
  const [bajoStockInsumos, setBajoStockInsumos]     = useState<AlertaStock[]>([])
  const [altoConsumo, setAltoConsumo]               = useState<AltoConsumo[]>([])
  const [reabastecimiento, setReabastecimiento]     = useState<Reabastecimiento[]>([])

  // ── Estados catálogo ──
  const [productos, setProductos]       = useState<Producto[]>([])
  const [cargandoProd, setCargandoProd] = useState(false)
  const [totalProd, setTotalProd]       = useState(0)
  const [paginaProd, setPaginaProd]     = useState(1)
  const [totalPagProd, setTotalPagProd] = useState(1)
  const [filtroCat, setFiltroCat]       = useState("")
  const [filtroBuscar, setFiltroBuscar] = useState("")
  const [modalProducto, setModalProducto] = useState<Producto | null | "nuevo">(null)

  // ── Estados cobros ──
  const [fechaCobros, setFechaCobros]           = useState(new Date().toISOString().split("T")[0])
  const [citasPendientes, setCitasPendientes]   = useState<CitaPendiente[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([])
  const [cobrosHoy, setCobrosHoy]               = useState<CobroHoy[]>([])
  const [totalesHoy, setTotalesHoy]             = useState<TotalesHoy | null>(null)
  const [cargandoCobros, setCargandoCobros]     = useState(false)
  const [citaACobrar, setCitaACobrar]           = useState<CitaPendiente | null>(null)
  const [reciboData, setReciboData]             = useState<{ cobro: any; cita: CitaPendiente } | null>(null)

  // ── Estados cierre ──
  const [fechaCierre, setFechaCierre]   = useState(new Date().toISOString().split("T")[0])
  const [cierre, setCierre]             = useState<Cierre | null>(null)
  const [cargandoCierre, setCargandoCierre] = useState(false)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || !["admin", "cajero"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  // Cargar alertas
  const cargarAlertas = useCallback(async () => {
    setCargandoAlertas(true); setErrorAlertas("")
    try {
      const res = await fetch("/api/alertas", { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setResumen(d.resumen)
      setBajoStockProductos(d.bajo_stock_productos || [])
      setBajoStockInsumos(d.bajo_stock_insumos || [])
      setAltoConsumo(d.alto_consumo || [])
      setReabastecimiento(d.reabastecimiento || [])
    } catch (e: any) { setErrorAlertas(e.message || "Error al cargar alertas") }
    finally { setCargandoAlertas(false) }
  }, [authHeaders])

  // Cargar catálogo
  const cargarProductos = useCallback(async (pagina = 1) => {
    setCargandoProd(true)
    try {
      const params = new URLSearchParams()
      if (filtroCat)    params.set("categoria", filtroCat)
      if (filtroBuscar) params.set("buscar", filtroBuscar)
      params.set("pagina", String(pagina))
      const res = await fetch(`/api/productos?${params}`, { headers: authHeaders() })
      const d = await res.json()
      if (res.ok) { setProductos(d.productos??[]); setTotalProd(d.total??0); setTotalPagProd(d.totalPaginas??1); setPaginaProd(pagina) }
    } finally { setCargandoProd(false) }
  }, [authHeaders, filtroCat, filtroBuscar])

  // Cargar cobros
  const cargarCobros = useCallback(async (fecha: string) => {
    setCargandoCobros(true)
    try {
      const res = await fetch(`/api/pagos?fecha=${fecha}`, { headers: authHeaders() })
      const d = await res.json()
      if (res.ok) {
        setCitasPendientes(d.citas_pendientes || [])
        setCobrosHoy(d.cobros_hoy || [])
        setTotalesHoy(d.totales || null)
        setPedidosPendientes(d.pedidos_pendientes || [])
      }
    } finally { setCargandoCobros(false) }
  }, [authHeaders])

  // Cargar cierre
  const cargarCierre = useCallback(async (fecha: string) => {
    setCargandoCierre(true)
    try {
      const res = await fetch(`/api/pagos/cierre?fecha=${fecha}`, { headers: authHeaders() })
      const d = await res.json()
      if (res.ok) setCierre(d)
    } finally { setCargandoCierre(false) }
  }, [authHeaders])

  const toggleActivo = async (p: Producto) => {
    await fetch(`/api/productos/${p.id_producto}`, { method:"PATCH", headers:authHeaders(), body:JSON.stringify({ activo:!p.activo }) })
    cargarProductos(paginaProd)
  }

  useEffect(() => { if (user) cargarAlertas() }, [user, cargarAlertas])
  useEffect(() => { if (user && tabPrincipal === "catalogo") cargarProductos(1) }, [user, tabPrincipal])
  useEffect(() => { if (user && tabPrincipal === "cobros")  cargarCobros(fechaCobros) }, [user, tabPrincipal, fechaCobros])
  useEffect(() => { if (user && tabPrincipal === "cierre")  cargarCierre(fechaCierre) }, [user, tabPrincipal, fechaCierre])

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <PawPrint className="w-10 h-10 text-amber-400 animate-bounce"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {/* Modales */}
      {modalProducto !== null && (
        <ModalProducto
          producto={modalProducto === "nuevo" ? null : modalProducto}
          onClose={() => setModalProducto(null)}
          onSaved={() => cargarProductos(paginaProd)}
          accessToken={accessToken}
        />
      )}

      {citaACobrar && !reciboData && (
        <ModalCobro
          cita={citaACobrar}
          onClose={() => setCitaACobrar(null)}
          accessToken={accessToken}
          onCobrado={(cobro) => {
            setReciboData({ cobro, cita: citaACobrar })
            setCitaACobrar(null)
            cargarCobros(fechaCobros)
          }}
        />
      )}

      {reciboData && (
        <Recibo
          cobro={reciboData.cobro}
          cita={reciboData.cita}
          onCerrar={() => setReciboData(null)}
        />
      )}

      {avisoTimeout && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18}/>
          <span className="font-semibold text-sm">Sesión expirará en 1 minuto.</span>
          <button onClick={() => setAvisoTimeout(false)} className="underline text-sm">Continuar</button>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-white"/>
            <span className="text-white font-black text-lg">Panel <span className="text-amber-200">Cajero</span></span>
          </div>
          <div className="flex items-center gap-3">
            {resumen && resumen.total_alertas > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-white"/>
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center text-white">
                  {resumen.total_alertas > 9 ? "9+" : resumen.total_alertas}
                </span>
              </div>
            )}
            <span className="text-white/80 text-sm font-medium">{user.nombre}</span>
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Bienvenida */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-6 text-white">
          <h1 className="text-2xl font-black mb-1">Hola, {user.nombre} 👋</h1>
          <p className="text-amber-100 text-sm">Panel de caja — gestiona cobros, catálogo y cierre diario.</p>
          {totalesHoy && tabPrincipal === "cobros" && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/15 rounded-2xl p-3 text-center">
                <p className="text-xl font-black">{totalesHoy.total_cobros}</p>
                <p className="text-xs text-amber-100">Cobros hoy</p>
              </div>
              <div className="bg-white/15 rounded-2xl p-3 text-center">
                <p className="text-xl font-black">Bs. {Number(totalesHoy.total_monto).toFixed(0)}</p>
                <p className="text-xs text-amber-100">Total recaudado</p>
              </div>
              <div className="bg-white/15 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-amber-200">{citasPendientes.length}</p>
                <p className="text-xs text-amber-100">Pendientes</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs principales */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex-wrap">
          {([
            { key:"cobros",   icon:Receipt,        label:"Cobros" },
            { key:"cierre",   icon:TrendingUp,      label:"Cierre de caja" },
            { key:"alertas",  icon:AlertTriangle,   label:"Alertas" },
            { key:"catalogo", icon:Layers,          label:"Catálogo" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTabPrincipal(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tabPrincipal === key ? "bg-amber-500 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              <Icon size={16}/> {label}
              {key === "alertas" && resumen && resumen.total_alertas > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 rounded-full">{resumen.total_alertas}</span>
              )}
              {key === "cobros" && citasPendientes.length > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 rounded-full">{citasPendientes.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ════════ TAB: COBROS ════════ */}
        {tabPrincipal === "cobros" && (
          <div className="space-y-4">

            {/* Selector de fecha */}
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <Calendar size={18} className="text-amber-500 shrink-0"/>
              <input type="date" value={fechaCobros} onChange={e => setFechaCobros(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"/>
              <button onClick={() => cargarCobros(fechaCobros)}
                className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold hover:text-amber-800">
                <RefreshCw size={14}/> Actualizar
              </button>
            </div>

            {cargandoCobros ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-400" size={28}/></div>
            ) : (
              <>
                {/* Citas pendientes de cobro */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-amber-500"/>
                      <h3 className="font-black text-gray-800">Pendientes de cobro</h3>
                      {citasPendientes.length > 0 && (
                        <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{citasPendientes.length}</span>
                      )}
                    </div>
                  </div>
                  {citasPendientes.length === 0 ? (
                    <div className="p-10 text-center">
                      <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2"/>
                      <p className="text-gray-400 text-sm font-medium">No hay citas pendientes de cobro para este día</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {citasPendientes.map(cita => (
                        <div key={cita.id_cita} className="flex items-center gap-4 px-5 py-4 hover:bg-amber-50 transition-colors">
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                            {cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-800 truncate">{cita.nombre_mascota} · {cita.nombre_cliente}</p>
                            <p className="text-xs text-gray-500">{cita.nombre_servicio} · {cita.hora_programada?.slice(0,5)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-amber-600">Bs. {Number(cita.precio_servicio).toFixed(2)}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${cita.estado_reserva === "completada" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                              {cita.estado_reserva}
                            </span>
                          </div>
                          <button onClick={() => setCitaACobrar(cita)}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shrink-0">
                            <Receipt size={13}/> Cobrar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {pedidosPendientes.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                      <ShoppingBag size={16} className="text-violet-500"/>
                      <h3 className="font-black text-gray-800">Pedidos de productos pendientes</h3>
                      <span className="bg-violet-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                        {pedidosPendientes.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {pedidosPendientes.map(pedido => (
                        <PedidoPendienteRow
                          key={pedido.id_compra}
                          pedido={pedido}
                          accessToken={accessToken}
                          onCobrado={() => cargarCobros(fechaCobros)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Cobros realizados hoy */}
                {cobrosHoy.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500"/>
                        <h3 className="font-black text-gray-800">Cobros realizados</h3>
                        <span className="bg-green-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{cobrosHoy.length}</span>
                      </div>
                      <p className="text-sm font-black text-green-600">Total: Bs. {Number(totalesHoy?.total_monto || 0).toFixed(2)}</p>
                    </div>

                    {/* Totales por método */}
                    {totalesHoy && (
                      <div className="px-5 py-3 border-b border-gray-50 flex gap-3 overflow-x-auto">
                        {[
                          { key:"efectivo",       label:"Efectivo",    val:totalesHoy.efectivo },
                          { key:"qr",             label:"QR",          val:totalesHoy.qr },
                          { key:"transferencia",  label:"Transfer.",   val:totalesHoy.transferencia },
                          { key:"tarjeta_credito",label:"T.Crédito",   val:totalesHoy.tarjeta_credito },
                          { key:"tarjeta_debito", label:"T.Débito",    val:totalesHoy.tarjeta_debito },
                        ].filter(m => m.val > 0).map(m => (
                          <div key={m.key} className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${METODO_COLOR[m.key] || "bg-gray-100 text-gray-600"}`}>
                            {METODO_ICONO[m.key]}
                            <span>{m.label}: Bs. {Number(m.val).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="divide-y divide-gray-50">
                      {cobrosHoy.map(cobro => (
                        <div key={cobro.id_cobra} className="flex items-center gap-4 px-5 py-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${METODO_COLOR[cobro.metodo_pago] || "bg-gray-100"}`}>
                            {METODO_ICONO[cobro.metodo_pago]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{cobro.nombre_cliente} · {cobro.nombre_mascota}</p>
                            <p className="text-xs text-gray-400">{cobro.nombre_servicio}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-green-600 text-sm">Bs. {Number(cobro.monto_cobrado).toFixed(2)}</p>
                            {cobro.nro_factura && (
                              <p className="text-[10px] text-violet-600 font-semibold flex items-center gap-0.5 justify-end">
                                <Hash size={8}/>{cobro.nro_factura}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ TAB: CIERRE DE CAJA ════════ */}
            {tabPrincipal === "cierre" && (
      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-wrap">
          <Calendar size={18} className="text-amber-500 shrink-0"/>
          <input type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"/>
          <button onClick={() => cargarCierre(fechaCierre)}
            className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold hover:text-amber-800">
            <RefreshCw size={14}/> Generar cierre
          </button>
          {cierre && (
            <button
              onClick={async () => {
                setGenerandoPDFCierre(true)
                try { await generarPDFCierre(cierre) }
                finally { setGenerandoPDFCierre(false) }
              }}
              disabled={generandoPDFCierre}
              className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition ml-auto"
            >
              {generandoPDFCierre
                ? <><Loader2 size={14} className="animate-spin"/> Generando...</>
                : <><Printer size={14}/> Descargar PDF</>
              }
            </button>
          )}
        </div>
    
        {cargandoCierre ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-400" size={28}/></div>
        ) : cierre ? (
          <>
            {/* Resumen */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-6 text-white">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-black text-lg">
                  Cierre del {new Date(cierre.fecha + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" })}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {cierre.pendientes_cobro > 0 && (
                    <span className="bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full">
                      {cierre.pendientes_cobro} citas sin cobrar
                    </span>
                  )}
                  {cierre.pendientes_pedidos > 0 && (
                    <span className="bg-orange-600 text-white text-xs font-black px-2 py-1 rounded-full">
                      {cierre.pendientes_pedidos} pedidos sin cobrar
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label:"Transacciones",  val: cierre.resumen.total_transacciones,       fmt:(v:any) => v },
                  { label:"Total del día",  val: cierre.resumen.total_bruto,               fmt:(v:any) => `Bs. ${Number(v).toFixed(2)}` },
                  { label:"Citas cobradas", val: cierre.resumen.total_citas,               fmt:(v:any) => `Bs. ${Number(v).toFixed(2)}` },
                  { label:"Pedidos cobrados",val: cierre.resumen.total_pedidos,            fmt:(v:any) => `Bs. ${Number(v).toFixed(2)}` },
                  { label:"Descuentos",     val: cierre.resumen.total_descuentos,          fmt:(v:any) => `Bs. ${Number(v).toFixed(2)}` },
                  { label:"Facturas",       val: cierre.resumen.facturas_emitidas,         fmt:(v:any) => v },
                ].map(({ label, val, fmt }) => (
                  <div key={label} className="bg-white/15 rounded-2xl p-3 text-center">
                    <p className="text-xl font-black">{fmt(val)}</p>
                    <p className="text-xs text-amber-100">{label}</p>
                  </div>
                ))}
              </div>
            </div>
    
            {/* Por método de pago */}
            {cierre.por_metodo.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-black text-gray-800 mb-4">Desglose por método de pago</h3>
                <div className="space-y-2">
                  {cierre.por_metodo.map((m:any) => (
                    <div key={m.metodo_pago} className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 w-36 shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${METODO_COLOR[m.metodo_pago] || "bg-gray-100 text-gray-600"}`}>
                        {METODO_ICONO[m.metodo_pago]}
                        <span className="capitalize">{m.metodo_pago.replace("_"," ")}</span>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width:`${Math.min(100, (Number(m.total) / Math.max(Number(cierre.resumen.total_bruto), 1)) * 100)}%` }}/>
                      </div>
                      <div className="text-right w-28 shrink-0">
                        <p className="font-black text-gray-800 text-sm">Bs. {Number(m.total).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{m.cantidad} cobro{m.cantidad !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
    
            {/* Detalle de cobros */}
            {cierre.detalle.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-black text-gray-800">Detalle de cobros</h3>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">🐾 {cierre.resumen.cobros_citas} servicios</span>
                    <span className="bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">🛍 {cierre.resumen.cobros_pedidos} pedidos</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        {["Tipo","#","Cliente","Concepto","Método","Desc.","Total","Factura"].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cierre.detalle.map((d:any, i:number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${d.tipo === "servicio" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                              {d.tipo === "servicio" ? "🐾 Serv." : "🛍 Prod."}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{d.id}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{d.cliente}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{d.concepto}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${METODO_COLOR[d.metodo_pago] || "bg-gray-100"}`}>
                              {d.metodo_pago?.replace("_"," ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-green-600 text-xs font-semibold">
                            {d.descuento_aplicado > 0 ? `- Bs. ${Number(d.descuento_aplicado).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3 font-black text-amber-600">Bs. {Number(d.monto_cobrado).toFixed(2)}</td>
                          <td className="px-4 py-3 text-violet-600 text-xs">{d.nro_factura || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
    
            {cierre.resumen.total_transacciones === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                <DollarSign className="w-10 h-10 text-gray-200 mx-auto mb-2"/>
                <p className="text-gray-400 font-medium">No hay cobros registrados para esta fecha</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    )}
 
        {/* ════════ TAB: ALERTAS ════════ */}
        {tabPrincipal === "alertas" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500"/>
                <h2 className="font-black text-gray-800">Alertas de inventario</h2>
                {resumen && resumen.total_alertas > 0 && <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{resumen.total_alertas}</span>}
              </div>
              <button onClick={cargarAlertas} disabled={cargandoAlertas} className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold disabled:opacity-50">
                <RefreshCw size={14} className={cargandoAlertas ? "animate-spin" : ""}/> Actualizar
              </button>
            </div>
            <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
              {([
                { key:"resumen", label:"Resumen", badge:null },
                { key:"productos", label:"Tienda", badge:resumen?.bajo_stock_productos },
                { key:"insumos", label:"Insumos", badge:resumen?.bajo_stock_insumos },
                { key:"consumo", label:"Consumo", badge:resumen?.alto_consumo },
                { key:"reabastecimiento", label:"Reponer", badge:resumen?.reabastecimiento },
              ] as const).map(({ key, label, badge }) => (
                <button key={key} onClick={() => setTabAlerta(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tabAlerta === key ? "border-amber-500 text-amber-700 bg-amber-50" : "border-transparent text-gray-500 hover:bg-gray-50"}`}>
                  {label}
                  {badge !== undefined && badge !== null && badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-1.5 rounded-full">{badge}</span>}
                </button>
              ))}
            </div>
            <div className="p-5">
              {errorAlertas && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm mb-4"><AlertCircle size={16}/>{errorAlertas}</div>}
              {cargandoAlertas ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-400" size={28}/></div> : (
                <>
                  {tabAlerta === "resumen" && (
                    resumen?.total_alertas === 0 ? (
                      <div className="text-center py-10"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3"/><p className="font-bold text-gray-700">Todo en orden</p></div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label:"Bajo stock", val:resumen?.bajo_stock_productos, color:"border-red-200 bg-red-50", icon:"📦", t:"productos" as const },
                          { label:"Insumos críticos", val:resumen?.bajo_stock_insumos, color:"border-amber-200 bg-amber-50", icon:"🧴", t:"insumos" as const },
                          { label:"Alto consumo", val:resumen?.alto_consumo, color:"border-orange-200 bg-orange-50", icon:"📈", t:"consumo" as const },
                          { label:"A reponer", val:resumen?.reabastecimiento, color:"border-purple-200 bg-purple-50", icon:"🛒", t:"reabastecimiento" as const },
                        ].map(({ label, val, color, icon, t }) => (
                          <button key={label} onClick={() => setTabAlerta(t)} className={`border-2 ${color} rounded-2xl p-4 text-left hover:scale-[1.02] transition-all`}>
                            <div className="text-2xl mb-1">{icon}</div>
                            <p className="text-2xl font-black text-gray-800">{val ?? 0}</p>
                            <p className="text-xs text-gray-600 font-semibold">{label}</p>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                  {tabAlerta === "productos" && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 mb-3">Productos por debajo del stock mínimo</p>
                      {bajoStockProductos.length === 0 ? <div className="text-center py-8 text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 text-gray-200"/><p className="text-sm">Sin alertas</p></div>
                      : bajoStockProductos.map(p => (
                        <div key={p.id_producto} className={`rounded-xl border-2 px-4 py-3 ${NIVEL_COLOR[p.nivel_alerta]||"bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-start justify-between"><div><p className="font-black text-sm">{NIVEL_ICONO[p.nivel_alerta]} {p.nombre}</p><p className="text-xs opacity-70 capitalize mt-0.5">{p.categoria}</p></div><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/60 uppercase">{p.nivel_alerta}</span></div>
                          <div className="flex gap-4 mt-2 text-xs"><span>Stock: <strong>{p.stock_actual}</strong></span><span>Mínimo: <strong>{p.stock_minimo}</strong></span>{p.cantidad_recomendada_compra !== undefined && <span className="font-bold">Pedir: {p.cantidad_recomendada_compra}</span>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tabAlerta === "insumos" && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 mb-3">Materiales de grooming en riesgo</p>
                      {bajoStockInsumos.length === 0 ? <div className="text-center py-8 text-gray-400"><ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-200"/><p className="text-sm">Sin alertas</p></div>
                      : bajoStockInsumos.map(p => (
                        <div key={p.id_producto} className={`rounded-xl border-2 px-4 py-3 ${NIVEL_COLOR[p.nivel_alerta]||"bg-gray-50 border-gray-200"}`}>
                          <div className="flex items-start justify-between"><div><p className="font-black text-sm">{NIVEL_ICONO[p.nivel_alerta]} {p.nombre}</p><p className="text-xs opacity-70 capitalize">{p.categoria}</p></div><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/60 uppercase">{p.nivel_alerta}</span></div>
                          <div className="flex gap-4 mt-2 text-xs"><span>Stock: <strong>{p.stock_actual}</strong></span><span>Mínimo: <strong>{p.stock_minimo}</strong></span></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tabAlerta === "consumo" && (
                    <div className="space-y-2">
                      {altoConsumo.length === 0 ? <div className="text-center py-8 text-gray-400"><BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-200"/><p className="text-sm">Sin alertas</p></div>
                      : altoConsumo.map((c, i) => (
                        <div key={i} className="bg-orange-50 border-2 border-orange-200 rounded-xl px-4 py-3">
                          <div className="flex items-start justify-between"><div><p className="font-black text-sm text-orange-800">📈 {c.nombre_groomer}</p><p className="text-xs text-orange-600">{c.producto} · {c.categoria}</p></div><span className="font-black text-orange-700 text-lg">{c.total_consumido}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tabAlerta === "reabastecimiento" && (
                    <div className="space-y-3">
                      {reabastecimiento.length === 0 ? <div className="text-center py-8 text-gray-400"><CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-200"/><p className="text-sm">No hay productos que reponer</p></div>
                      : reabastecimiento.map(r => (
                        <div key={r.id_producto} className="bg-purple-50 border-2 border-purple-200 rounded-xl px-4 py-4 space-y-2">
                          <div className="flex items-start justify-between"><div><p className="font-black text-sm text-purple-800">🛒 {r.nombre}</p><p className="text-xs text-purple-600 capitalize">{r.categoria}</p></div><div className="text-right"><p className="font-black text-purple-700 text-lg">{r.cantidad_a_pedir}</p><p className="text-[10px] text-purple-500">unidades</p></div></div>
                          {r.proveedor_sugerido && <div className="bg-white/70 rounded-xl px-3 py-2 text-xs"><p className="font-bold text-purple-800">{r.proveedor_sugerido}</p></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: CATÁLOGO ════════ */}
        {tabPrincipal === "catalogo" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div><h2 className="font-black text-gray-800">Catálogo de productos</h2><p className="text-xs text-gray-400 mt-0.5">{totalProd} productos registrados</p></div>
              <button onClick={() => setModalProducto("nuevo")} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
                <Plus size={16}/> Nuevo producto
              </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-50 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={filtroBuscar} onChange={e => setFiltroBuscar(e.target.value)} onKeyDown={e => e.key==="Enter" && cargarProductos(1)} placeholder="Buscar producto..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none w-full"/>
              </div>
              <select value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setTimeout(() => cargarProductos(1), 50) }} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none">
                <option value="">Todas las categorías</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
              <button onClick={() => cargarProductos(1)} className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold hover:text-amber-800 px-3 py-2 rounded-xl hover:bg-amber-50">
                <RefreshCw size={14}/> Buscar
              </button>
            </div>
            {cargandoProd ? <div className="flex justify-center py-14"><Loader2 className="animate-spin text-amber-400" size={28}/></div>
            : productos.length === 0 ? (
              <div className="text-center py-14"><Package className="w-12 h-12 text-gray-200 mx-auto mb-3"/><p className="text-gray-400 font-medium">No hay productos</p><button onClick={() => setModalProducto("nuevo")} className="mt-3 text-amber-500 font-bold text-sm hover:underline">+ Crear el primero</button></div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {productos.map(p => (
                  <div key={p.id_producto} className={`rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md ${p.activo ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
                    <div className="h-36 bg-gray-50 relative overflow-hidden">
                      {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-200"><Package size={40}/></div>}
                      <span className={`absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full ${STOCK_COLOR[p.estado_stock]??"bg-gray-100 text-gray-600"}`}>{p.estado_stock}</span>
                      {!p.activo && <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center"><span className="bg-gray-800 text-white text-xs font-black px-3 py-1 rounded-full">Inactivo</span></div>}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0"><p className="font-black text-gray-800 text-sm truncate">{p.nombre}</p>{p.marca && <p className="text-xs text-gray-400">{p.marca}</p>}</div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${CAT_COLOR[p.categoria]??"bg-gray-100 text-gray-600"}`}>{p.categoria}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div><p className="font-black text-amber-600 text-base">Bs. {Number(p.precio_venta).toFixed(2)}</p><p className="text-xs text-gray-400">Costo: Bs. {Number(p.precio_costo).toFixed(2)}</p></div>
                        <div className="text-right"><p className="font-black text-gray-700">{p.stock_actual}</p><p className="text-[10px] text-gray-400">en stock</p></div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${p.stock_actual===0?"bg-red-400":p.stock_actual<=p.stock_minimo?"bg-amber-400":"bg-green-400"}`} style={{ width:`${Math.min(100,(p.stock_actual/Math.max(p.stock_minimo*2,1))*100)}%` }}/>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setModalProducto(p)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-50"><Edit2 size={12}/> Editar</button>
                        <button onClick={() => toggleActivo(p)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl ${p.activo ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"}`}>
                          {p.activo ? <><ToggleLeft size={12}/> Desactivar</> : <><ToggleRight size={12}/> Activar</>}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {totalPagProd > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">Página {paginaProd} de {totalPagProd}</p>
                <div className="flex gap-2">
                  <button onClick={() => cargarProductos(paginaProd-1)} disabled={paginaProd===1} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={14}/> Anterior</button>
                  <button onClick={() => cargarProductos(paginaProd+1)} disabled={paginaProd>=totalPagProd} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Siguiente <ChevronRight size={14}/></button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}