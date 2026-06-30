"use client"
// components/ModalCobro.tsx
// Modal de punto de venta completo:
// - Efectivo: cobro normal
// - QR: muestra código QR para escanear
// - Transferencia: muestra datos de cuenta
// - Tarjeta crédito/débito: campo de número con validación Luhn
// - Cupón de descuento validado vía API
// - Emisión de factura con PDF descargable

import { useState, useRef } from "react"
import {
  X, Receipt, QrCode, Banknote, ArrowRightLeft, CreditCard,
  Tag, CheckCircle, XCircle, Loader2, AlertCircle, Download,
  Building2, Copy, Check
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface CitaPendiente {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
  nombre_cliente: string
  telefono_cliente: string
  id_usuario_cliente: number
  id_cliente_tabla: number
  nombre_mascota: string
  especie: string
  nombre_servicio: string
  precio_servicio: number
}

// ── Algoritmo de Luhn (validación básica de tarjeta) ──────────────────────
function validarLuhn(numero: string): boolean {
  const digits = numero.replace(/\D/g, "")
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let isEven = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i])
    if (isEven) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    isEven = !isEven
  }
  return sum % 10 === 0
}

function formatearTarjeta(value: string): string {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
}

function detectarTipoTarjeta(numero: string): string {
  const n = numero.replace(/\D/g, "")
  if (/^4/.test(n)) return "Visa"
  if (/^5[1-5]/.test(n)) return "Mastercard"
  if (/^3[47]/.test(n)) return "American Express"
  return ""
}

// ── Generar PDF de recibo (sin dependencias externas) ─────────────────────
function generarPDFRecibo(params: {
  nroPago: number
  nroFactura: string | null
  nombreCliente: string
  nombreMascota: string
  nombreServicio: string
  fechaServicio: string
  metodoPago: string
  precioBase: number
  descuento: number
  montoFinal: number
  datosFiscales: string
}) {
  const {
    nroPago, nroFactura, nombreCliente, nombreMascota, nombreServicio,
    fechaServicio, metodoPago, precioBase, descuento, montoFinal, datosFiscales
  } = params

  const fechaEmision = new Date().toLocaleDateString("es-BO", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  })

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Recibo #${nroPago} - SPA Mascotas</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
  .page { width: 380px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; text-align: center; }
  .header h1 { color: white; font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header p { color: #ddd6fe; font-size: 12px; }
  .badge { background: rgba(255,255,255,0.2); color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; }
  .body { padding: 20px; }
  .success-icon { text-align: center; margin: 16px 0; }
  .success-icon span { font-size: 48px; }
  .section { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
  .section-title { font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f9fafb; }
  .row:last-child { border-bottom: none; }
  .row .label { color: #6b7280; font-size: 12px; }
  .row .value { color: #111827; font-size: 12px; font-weight: 600; text-align: right; max-width: 60%; }
  .total-row { display: flex; justify-content: space-between; padding: 12px 14px; background: #f5f3ff; border-radius: 8px; margin-bottom: 14px; }
  .total-row .label { font-weight: 700; color: #374151; font-size: 14px; }
  .total-row .value { font-weight: 900; color: #7c3aed; font-size: 18px; }
  .discount-row { display: flex; justify-content: space-between; padding: 6px 14px; }
  .discount-row .label { color: #059669; font-size: 12px; }
  .discount-row .value { color: #059669; font-size: 12px; font-weight: 700; }
  .factura-badge { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .factura-badge .nro { font-size: 13px; font-weight: 800; color: #7c3aed; }
  .factura-badge .label { font-size: 11px; color: #6b7280; }
  .footer { background: #f9fafb; padding: 16px; text-align: center; border-top: 1px dashed #e5e7eb; }
  .footer p { font-size: 11px; color: #9ca3af; line-height: 1.6; }
  .footer .brand { font-size: 14px; font-weight: 800; color: #7c3aed; margin-bottom: 4px; }
  @media print { body { background: white; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>🐾 SPA Mascotas</h1>
    <p>Comprobante de pago</p>
    <div class="badge">Pago #${nroPago}</div>
  </div>
  <div class="body">
    <div class="success-icon"><span>✅</span></div>
    
    <div class="section">
      <div class="section-title">Detalle del servicio</div>
      <div class="row"><span class="label">Cliente</span><span class="value">${nombreCliente}</span></div>
      <div class="row"><span class="label">Mascota</span><span class="value">${nombreMascota}</span></div>
      <div class="row"><span class="label">Servicio</span><span class="value">${nombreServicio}</span></div>
      <div class="row"><span class="label">Fecha</span><span class="value">${fechaServicio}</span></div>
      <div class="row"><span class="label">Método de pago</span><span class="value">${metodoPago.replace("_"," ").toUpperCase()}</span></div>
    </div>

    ${descuento > 0 ? `
    <div class="discount-row">
      <span class="label">Subtotal</span>
      <span class="value">Bs. ${precioBase.toFixed(2)}</span>
    </div>
    <div class="discount-row">
      <span class="label">Descuento aplicado</span>
      <span class="value">- Bs. ${descuento.toFixed(2)}</span>
    </div>` : ""}

    <div class="total-row">
      <span class="label">TOTAL PAGADO</span>
      <span class="value">Bs. ${montoFinal.toFixed(2)}</span>
    </div>

    ${nroFactura ? `
    <div class="factura-badge">
      <span style="font-size:20px">🧾</span>
      <div>
        <div class="label">Factura emitida</div>
        <div class="nro">${nroFactura}</div>
        ${datosFiscales ? `<div class="label">${datosFiscales}</div>` : ""}
      </div>
    </div>` : ""}
  </div>
  <div class="footer">
    <div class="brand">SPA Mascotas</div>
    <p>Emitido el ${fechaEmision}</p>
    <p>Gracias por confiar en nosotros 🐾</p>
    <p>Conserve este comprobante como respaldo de su pago</p>
  </div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href     = url
  link.download = `recibo-${nroPago}.html`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Sub-componentes por método de pago ─────────────────────────────────────

function PanelEfectivo({ montoFinal }: { montoFinal: number }) {
  const [recibido, setRecibido] = useState("")
  const cambio = recibido ? Math.max(0, parseFloat(recibido) - montoFinal) : null

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
        <Banknote size={13}/> Cobro en efectivo
      </p>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Monto recibido del cliente (Bs.)</label>
        <input
          type="number" min={montoFinal} step="0.50"
          value={recibido}
          onChange={e => setRecibido(e.target.value)}
          placeholder={montoFinal.toFixed(2)}
          className="w-full border border-green-300 rounded-xl px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none font-bold text-lg"
        />
      </div>
      {cambio !== null && recibido && (
        <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-sm font-black ${cambio >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          <span>{cambio >= 0 ? "Cambio a devolver" : "⚠️ Monto insuficiente"}</span>
          <span className="text-base">Bs. {Math.abs(cambio).toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}

function PanelQR({ montoFinal, nombreNegocio = "SPA Mascotas" }: { montoFinal: number; nombreNegocio?: string }) {
  // QR simple generado con una URL de API pública (no requiere librerías)
  const qrData = encodeURIComponent(`SPA Mascotas - Pago Bs. ${montoFinal.toFixed(2)}`)
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`
  const [copiado, setCopiado] = useState(false)

  const copiar = () => {
    navigator.clipboard.writeText(`SPA Mascotas - Pago Bs. ${montoFinal.toFixed(2)}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1">
        <QrCode size={13}/> Pago por QR
      </p>
      <p className="text-xs text-gray-500">Muestra este código al cliente para que escanee con su app bancaria.</p>
      <div className="flex flex-col items-center gap-3">
        <div className="bg-white p-3 rounded-2xl border-2 border-violet-200 shadow-sm">
          <img
            src={qrUrl}
            alt="QR de pago"
            width={180} height={180}
            className="rounded-xl"
            onError={(e) => {
              // Si falla la imagen externa, mostrar placeholder
              (e.target as HTMLImageElement).style.display = "none"
            }}
          />
          {/* Fallback visual si no carga la imagen */}
          <div className="hidden text-center py-8 text-violet-300">
            <QrCode size={60} className="mx-auto mb-2"/>
            <p className="text-xs">QR no disponible sin internet</p>
          </div>
        </div>
        <div className="text-center">
          <p className="font-black text-violet-700 text-xl">Bs. {montoFinal.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{nombreNegocio}</p>
        </div>
        <button onClick={copiar}
          className="flex items-center gap-2 text-xs text-violet-600 font-bold hover:underline">
          {copiado ? <Check size={12}/> : <Copy size={12}/>}
          {copiado ? "¡Copiado!" : "Copiar información"}
        </button>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-semibold">
        ⏳ Esperando confirmación del pago... Haz clic en "Cobrar" una vez confirmado.
      </div>
    </div>
  )
}

function PanelTransferencia({ montoFinal }: { montoFinal: number }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const CUENTA = { banco:"Banco BCP Bolivia", cuenta:"1234567890", titular:"SPA Mascotas S.R.L.", nit:"1234567890" }

  const copiar = (campo: string, valor: string) => {
    navigator.clipboard.writeText(valor)
    setCopiado(campo)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
        <ArrowRightLeft size={13}/> Transferencia bancaria
      </p>
      <p className="text-xs text-gray-500">Proporciona estos datos al cliente para realizar la transferencia.</p>
      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
        {[
          { label:"Banco",   valor:CUENTA.banco },
          { label:"Cuenta",  valor:CUENTA.cuenta },
          { label:"Titular", valor:CUENTA.titular },
          { label:"NIT",     valor:CUENTA.nit },
          { label:"Monto",   valor:`Bs. ${montoFinal.toFixed(2)}` },
        ].map(({ label, valor }) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
            <span className="text-xs font-bold text-gray-800 flex-1 text-center">{valor}</span>
            <button onClick={() => copiar(label, valor)}
              className="text-blue-400 hover:text-blue-600 shrink-0">
              {copiado === label ? <Check size={13}/> : <Copy size={13}/>}
            </button>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-semibold">
        ⏳ Solicita comprobante de transferencia antes de confirmar el cobro.
      </div>
    </div>
  )
}

function PanelTarjeta({ tipo }: { tipo: "tarjeta_credito" | "tarjeta_debito" }) {
  const [numero, setNumero]   = useState("")
  const [expiry, setExpiry]   = useState("")
  const [cvv, setCvv]         = useState("")
  const [nombre, setNombre]   = useState("")
  const [touched, setTouched] = useState(false)

  const numLimpio = numero.replace(/\D/g, "")
  const tipoTarjeta = detectarTipoTarjeta(numLimpio)
  const esValida    = touched && validarLuhn(numLimpio) && numLimpio.length === 16
  const esInvalida  = touched && numLimpio.length >= 13 && !validarLuhn(numLimpio)

  const handleNumero = (v: string) => {
    setNumero(formatearTarjeta(v))
    setTouched(true)
  }

  const handleExpiry = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4)
    setExpiry(clean.length > 2 ? `${clean.slice(0,2)}/${clean.slice(2)}` : clean)
  }

  const color = tipo === "tarjeta_credito" ? "amber" : "orange"
  const bgCls = `bg-${color}-50 border-${color}-200`

  return (
    <div className={`${bgCls} border rounded-2xl p-4 space-y-3`} style={{ background: tipo === "tarjeta_credito" ? "#fffbeb" : "#fff7ed", borderColor: tipo === "tarjeta_credito" ? "#fde68a" : "#fed7aa" }}>
      <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: tipo === "tarjeta_credito" ? "#92400e" : "#9a3412" }}>
        <CreditCard size={13}/> Tarjeta de {tipo === "tarjeta_credito" ? "crédito" : "débito"}
      </p>

      {/* Preview tarjeta */}
      <div className="relative rounded-2xl p-4 text-white text-sm overflow-hidden"
        style={{ background: tipo === "tarjeta_credito" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#f97316,#ea580c)", minHeight: 100 }}>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 translate-x-8 -translate-y-8"/>
        <p className="font-mono text-base font-bold tracking-widest mb-3">
          {numero || "•••• •••• •••• ••••"}
        </p>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[10px] opacity-70">Titular</p>
            <p className="font-bold text-sm">{nombre || "NOMBRE APELLIDO"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-70">Vence</p>
            <p className="font-bold">{expiry || "MM/AA"}</p>
          </div>
          {tipoTarjeta && <div className="text-xs font-black bg-white/20 px-2 py-0.5 rounded-full">{tipoTarjeta}</div>}
        </div>
      </div>

      {/* Campos */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Número de tarjeta</label>
        <div className="relative">
          <input
            value={numero}
            onChange={e => handleNumero(e.target.value)}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none ${
              esValida ? "border-green-400 bg-green-50" : esInvalida ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-amber-400"
            }`}
          />
          {esValida  && <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"/>}
          {esInvalida && <XCircle   size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"/>}
        </div>
        {esInvalida && <p className="text-xs text-red-500 mt-1">Número de tarjeta inválido</p>}
        {esValida   && <p className="text-xs text-green-600 mt-1">✓ Tarjeta válida {tipoTarjeta && `— ${tipoTarjeta}`}</p>}
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Nombre del titular</label>
        <input value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())}
          placeholder="JUAN PEREZ"
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase focus:border-amber-400 focus:outline-none"/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vencimiento</label>
          <input value={expiry} onChange={e => handleExpiry(e.target.value)}
            placeholder="MM/AA" maxLength={5}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:border-amber-400 focus:outline-none"/>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">CVV</label>
          <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,"").slice(0,4))}
            placeholder="•••" maxLength={4} type="password"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-mono focus:border-amber-400 focus:outline-none"/>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        🔒 Datos solo para verificación visual — no se almacenan
      </p>
    </div>
  )
}

// ── Modal principal ────────────────────────────────────────────────────────
export default function ModalCobro({ cita, onClose, onCobrado, accessToken }: {
  cita: CitaPendiente
  onClose: () => void
  onCobrado: (cobro: any) => void
  accessToken: string | null
}) {
  const [metodoPago, setMetodoPago]       = useState<string>("efectivo")
  const [codigoCupon, setCodigoCupon]     = useState("")
  const [descuento, setDescuento]         = useState(0)
  const [cuponMsg, setCuponMsg]           = useState<{ ok: boolean; texto: string } | null>(null)
  const [validandoCupon, setValidandoCupon] = useState(false)
  const [emitirFactura, setEmitirFactura] = useState(false)
  const [datosFiscales, setDatosFiscales] = useState("")
  const [procesando, setProcesando]       = useState(false)
  const [error, setError]                 = useState("")

  const precioBase = Number(cita.precio_servicio) || 0
  const montoFinal = Math.max(0, precioBase - descuento)

  const authH = () => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const validarCupon = async () => {
    if (!codigoCupon.trim()) return
    setValidandoCupon(true); setCuponMsg(null)
    try {
      const res = await fetch(
        `/api/cupones?codigo=${codigoCupon.trim()}&monto_base=${precioBase}&id_cliente=${cita.id_cliente_tabla}`,
        { headers: authH() }
      )
      if (res.status === 404) {
        setCuponMsg({ ok: false, texto: "Ruta de cupones no disponible" }); return
      }
      const d = await res.json()
      if (d.valido) {
        setDescuento(d.descuento_calculado)
        setCuponMsg({ ok: true, texto: `✓ ${d.message}` })
      } else {
        setDescuento(0)
        setCuponMsg({ ok: false, texto: d.message })
      }
    } catch {
      setCuponMsg({ ok: false, texto: "Error al validar cupón" })
    } finally { setValidandoCupon(false) }
  }

  const cobrar = async () => {
    setProcesando(true); setError("")
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          id_cita:            cita.id_cita,
          metodo_pago:        metodoPago,
          monto_cobrado:      montoFinal,
          descuento_aplicado: descuento,
          codigo_cupon:       codigoCupon.trim() || undefined,
          emitir_factura:     emitirFactura,
          datos_fiscales:     datosFiscales || cita.nombre_cliente,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.message); return }

      // Generar PDF si se emite factura
      if (emitirFactura || true) { // siempre generar recibo
        generarPDFRecibo({
          nroPago:        d.id_pago,
          nroFactura:     d.nro_factura,
          nombreCliente:  cita.nombre_cliente,
          nombreMascota:  cita.nombre_mascota,
          nombreServicio: cita.nombre_servicio,
          fechaServicio:  new Date(cita.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"long", year:"numeric" }),
          metodoPago,
          precioBase,
          descuento,
          montoFinal,
          datosFiscales:  datosFiscales || cita.nombre_cliente,
        })
      }

      onCobrado({ ...d, descuento_aplicado: descuento })
    } catch {
      setError("Error de conexión")
    } finally { setProcesando(false) }
  }

  const METODOS = [
    { key:"efectivo",        label:"Efectivo",      icon:<Banknote size={16}/> },
    { key:"qr",              label:"QR",             icon:<QrCode size={16}/> },
    { key:"transferencia",   label:"Transferencia",  icon:<ArrowRightLeft size={16}/> },
    { key:"tarjeta_credito", label:"T. Crédito",     icon:<CreditCard size={16}/> },
    { key:"tarjeta_debito",  label:"T. Débito",      icon:<CreditCard size={16}/> },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto pt-4 pb-10">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500"/>
            <h3 className="font-black text-gray-800">Punto de venta</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Resumen */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Detalle del servicio</p>
            <div className="space-y-1 text-sm">
              {[
                ["Cliente",  cita.nombre_cliente],
                ["Mascota",  `${cita.especie === "perro" ? "🐶" : cita.especie === "gato" ? "🐱" : "🐾"} ${cita.nombre_mascota}`],
                ["Servicio", cita.nombre_servicio],
                ["Fecha",    `${new Date(cita.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"short" })} ${cita.hora_programada?.slice(0,5)}`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-bold text-gray-800">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
                <span className="font-bold text-gray-700">Precio base</span>
                <span className="font-black text-amber-600 text-base">Bs. {precioBase.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Selector de método */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Método de pago</p>
            <div className="grid grid-cols-5 gap-1.5">
              {METODOS.map(({ key, label, icon }) => (
                <button key={key} onClick={() => setMetodoPago(key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-[10px] font-bold transition-all ${
                    metodoPago === key
                      ? "border-amber-500 bg-amber-50 text-amber-700 scale-[1.03]"
                      : "border-gray-200 text-gray-500 hover:border-amber-300"
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Panel dinámico por método */}
          {metodoPago === "efectivo"        && <PanelEfectivo montoFinal={montoFinal} />}
          {metodoPago === "qr"              && <PanelQR montoFinal={montoFinal} />}
          {metodoPago === "transferencia"   && <PanelTransferencia montoFinal={montoFinal} />}
          {metodoPago === "tarjeta_credito" && <PanelTarjeta tipo="tarjeta_credito" />}
          {metodoPago === "tarjeta_debito"  && <PanelTarjeta tipo="tarjeta_debito" />}

          {/* Cupón */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Tag size={13}/> Cupón de descuento</p>
            <div className="flex gap-2">
              <input
                value={codigoCupon}
                onChange={e => { setCodigoCupon(e.target.value.toUpperCase()); setCuponMsg(null); setDescuento(0) }}
                onKeyDown={e => e.key === "Enter" && validarCupon()}
                placeholder="Ej: BIENVENIDO10"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase focus:border-amber-400 focus:outline-none"
              />
              <button onClick={validarCupon} disabled={validandoCupon || !codigoCupon.trim()}
                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold rounded-xl text-sm disabled:opacity-40 whitespace-nowrap">
                {validandoCupon ? <Loader2 size={14} className="animate-spin"/> : "Validar"}
              </button>
            </div>
            {cuponMsg && (
              <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 ${cuponMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {cuponMsg.ok ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                {cuponMsg.texto}
              </p>
            )}
          </div>

          {/* Factura */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={emitirFactura} onChange={e => setEmitirFactura(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded"/>
              <span className="text-sm font-bold text-gray-700">Emitir factura fiscal</span>
            </label>
            {emitirFactura && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre o razón social / NIT</label>
                <input value={datosFiscales} onChange={e => setDatosFiscales(e.target.value)}
                  placeholder={cita.nombre_cliente}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"/>
              </div>
            )}
          </div>

          {/* Resumen total */}
          <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>Bs. {precioBase.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento</span>
                <span className="font-bold">- Bs. {descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base border-t border-amber-100 pt-2 mt-1">
              <span>Total a cobrar</span>
              <span className="text-amber-600 text-xl">Bs. {montoFinal.toFixed(2)}</span>
            </div>
          </div>

          {/* Nota sobre PDF */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600 font-semibold">
            <Download size={13}/>
            Al confirmar se descargará automáticamente el recibo en formato HTML
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
          <button onClick={cobrar} disabled={procesando || montoFinal <= 0}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {procesando ? <Loader2 size={15} className="animate-spin"/> : <Receipt size={15}/>}
            {procesando ? "Procesando..." : `Cobrar Bs. ${montoFinal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}