// lib/whatsapp.ts
// Helper que llama al servicio WhatsApp local (puerto 3001).
// Next.js llama a estas funciones desde las rutas API.
// Si el servicio no está corriendo, loguea el error pero NO
// interrumpe el flujo principal — el pago/pedido se registra igual.

const WA_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3011"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface ResultadoWA {
  ok:    boolean
  error?: string
}

// ── Función base ───────────────────────────────────────────────────────────
async function llamarServicio(endpoint: string, body: object): Promise<ResultadoWA> {
  try {
    const res = await fetch(`${WA_URL}${endpoint}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      // Timeout de 8 segundos — si el servicio tarda más, continúa sin WA
      signal: AbortSignal.timeout(20_000),
    })
    const data = await res.json()
    if (!res.ok) {
      console.warn(`[WhatsApp] ${endpoint} →`, data.error || res.status)
    }
    return data
  } catch (err: any) {
    // El servicio no está corriendo o tardó demasiado — no bloquear el flujo
    if (err.name === "TimeoutError" || err.code === "ECONNREFUSED") {
      console.warn(`[WhatsApp] Servicio no disponible (${err.message}) — continuando sin WA`)
    } else {
      console.error(`[WhatsApp] Error inesperado:`, err.message)
    }
    return { ok: false, error: err.message }
  }
}

// ── Notificación de pago de cita ───────────────────────────────────────────
export async function notificarPagoWA(params: {
  telefono:        string | null
  nombre_cliente:  string
  nombre_mascota:  string | null
  nombre_servicio: string | null
  monto:           number
  metodo_pago:     string
  descuento?:      number
  nro_factura?:    string | null
}): Promise<ResultadoWA> {
  if (!params.telefono) {
    console.warn("[WhatsApp] Sin teléfono del cliente — omitiendo notificación de pago")
    return { ok: false, error: "Sin teléfono" }
  }
  return llamarServicio("/send/pago", params)
}

// ── Notificación de pedido de productos ───────────────────────────────────
export async function notificarPedidoWA(params: {
  telefono:       string | null
  nombre_cliente: string
  id_compra:      number
  items:          { nombre: string; cantidad: number; subtotal: number }[]
  total:          number
  descuento?:     number
}): Promise<ResultadoWA> {
  if (!params.telefono) {
    console.warn("[WhatsApp] Sin teléfono del cliente — omitiendo notificación de pedido")
    return { ok: false, error: "Sin teléfono" }
  }
  return llamarServicio("/send/pedido", params)
}

// ── Mensaje libre ──────────────────────────────────────────────────────────
export async function enviarMensajeWA(
  telefono: string,
  mensaje:  string
): Promise<ResultadoWA> {
  return llamarServicio("/send", { telefono, mensaje })
}