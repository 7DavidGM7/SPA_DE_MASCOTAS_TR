// lib/notificaciones.ts
// Servicio central de notificaciones — app + WhatsApp
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// ── Tipos ──────────────────────────────────────────────────────────────────
export type TipoNotificacion =
  | "cita_solicitada"
  | "cita_confirmada"
  | "cita_cancelada"
  | "recordatorio_24h"
  | "recordatorio_2h"
  | "grooming_listo"
  | "pago_registrado"
  | "bajo_stock"

interface CrearNotificacionOpts {
  id_usuario:  number
  tipo:        TipoNotificacion
  titulo:      string
  mensaje:     string
  canal?:      "app" | "whatsapp" | "ambos"
  entidad?:    string
  entidad_id?: number
  telefono?:   string   // requerido si canal incluye whatsapp
}

// ── Enviar WhatsApp (texto libre — modo prueba) ────────────────────────────
async function enviarWhatsApp(telefono: string, mensaje: string): Promise<{ ok: boolean; error?: string }> {
  const token    = process.env.WHATSAPP_TOKEN
  const phoneId  = process.env.WHATSAPP_PHONE_ID
  const version  = process.env.WHATSAPP_VERSION || "v25.0"

  if (!token || !phoneId) {
    return { ok: false, error: "Credenciales de WhatsApp no configuradas" }
  }

  // Formatear teléfono — asegurar que tenga código de país sin '+'
  const telFormateado = telefono.replace(/\D/g, "")

  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to:   telFormateado,
          type: "text",
          text: { body: mensaje },
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      const errMsg = data?.error?.message || "Error desconocido de WhatsApp"
      console.error("[WhatsApp]", errMsg)
      return { ok: false, error: errMsg }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || "Error de red" }
  }
}

// ── Función principal — crear notificación y enviar WhatsApp si aplica ─────
export async function crearNotificacion(opts: CrearNotificacionOpts): Promise<number | null> {
  const canal = opts.canal ?? "ambos"

  let whatsappEnviado = false
  let whatsappError:  string | null = null

  // Intentar enviar WhatsApp si aplica
  if ((canal === "whatsapp" || canal === "ambos") && opts.telefono) {
    const resultado = await enviarWhatsApp(opts.telefono, opts.mensaje)
    whatsappEnviado = resultado.ok
    whatsappError   = resultado.error ?? null
  }

  // Guardar en BD siempre
  try {
    const res = await pool.query(
      `INSERT INTO notificacion
         (id_usuario, tipo, titulo, mensaje, canal, whatsapp_enviado, whatsapp_error, entidad, entidad_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id_notificacion`,
      [
        opts.id_usuario,
        opts.tipo,
        opts.titulo,
        opts.mensaje,
        canal,
        whatsappEnviado,
        whatsappError,
        opts.entidad   ?? null,
        opts.entidad_id ?? null,
      ]
    )
    return res.rows[0].id_notificacion
  } catch (err) {
    console.error("[crearNotificacion BD]", err)
    return null
  }
}

// ── Helpers por tipo de evento ─────────────────────────────────────────────

// Al solicitar una cita
export async function notifCitaSolicitada(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; fecha: string; hora: string; servicio: string; id_cita: number
}) {
  const titulo  = "🐾 Solicitud recibida"
  const mensaje =
    `Hola ${opts.nombre_cliente}! Tu solicitud de cita para ${opts.nombre_mascota} ` +
    `fue recibida.\n📅 ${opts.fecha} a las ${opts.hora}\n✂️ Servicio: ${opts.servicio}\n` +
    `Pronto la recepción la confirmará. ¡Gracias por confiar en SPA Mascotas!`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "cita_solicitada",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Al confirmar una cita (recepción)
export async function notifCitaConfirmada(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; fecha: string; hora: string; servicio: string; id_cita: number
}) {
  const titulo  = "✅ Cita confirmada"
  const mensaje =
    `¡Hola ${opts.nombre_cliente}! Tu cita fue CONFIRMADA.\n` +
    `🐶 Mascota: ${opts.nombre_mascota}\n📅 ${opts.fecha} a las ${opts.hora}\n` +
    `✂️ ${opts.servicio}\nTe esperamos en SPA Mascotas. 🐾`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "cita_confirmada",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Al cancelar una cita
export async function notifCitaCancelada(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; fecha: string; id_cita: number
}) {
  const titulo  = "❌ Cita cancelada"
  const mensaje =
    `Hola ${opts.nombre_cliente}, tu cita del ${opts.fecha} para ${opts.nombre_mascota} ` +
    `fue cancelada. Si deseas reagendar, puedes hacerlo desde la app. SPA Mascotas 🐾`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "cita_cancelada",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Recordatorio 24h antes
export async function notifRecordatorio24h(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; fecha: string; hora: string; id_cita: number
}) {
  const titulo  = "⏰ Recordatorio — mañana es tu cita"
  const mensaje =
    `¡Hola ${opts.nombre_cliente}! Te recordamos que mañana tienes cita en SPA Mascotas.\n` +
    `🐾 ${opts.nombre_mascota} · 📅 ${opts.fecha} a las ${opts.hora}\n` +
    `Por favor llega 5 minutos antes. ¡Nos vemos! 🛁`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "recordatorio_24h",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Recordatorio 2h antes
export async function notifRecordatorio2h(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; hora: string; id_cita: number
}) {
  const titulo  = "🔔 Tu cita es en 2 horas"
  const mensaje =
    `¡Hola ${opts.nombre_cliente}! En 2 horas tienes tu cita para ${opts.nombre_mascota} ` +
    `a las ${opts.hora}. ¡Te esperamos en SPA Mascotas! 🐾`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "recordatorio_2h",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Al cerrar ficha de grooming
export async function notifGroomingListo(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  nombre_mascota: string; id_cita: number
}) {
  const titulo  = "🎉 ¡Tu mascota está lista!"
  const mensaje =
    `¡Hola ${opts.nombre_cliente}! ${opts.nombre_mascota} ya terminó su sesión de grooming ` +
    `y está lista para ser recogida. 🐾✨ ¡Quedó hermosa! — SPA Mascotas`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "grooming_listo",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "cita", entidad_id: opts.id_cita,
  })
}

// Al registrar pago
export async function notifPagoRegistrado(opts: {
  id_usuario: number; nombre_cliente: string; telefono: string
  total: number; id_compra: number
}) {
  const titulo  = "💳 Pago registrado"
  const mensaje =
    `¡Hola ${opts.nombre_cliente}! Tu pago de Bs. ${Number(opts.total).toFixed(2)} ` +
    `fue registrado correctamente (Pedido #${opts.id_compra}). ¡Gracias por tu compra! — SPA Mascotas 🐾`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "pago_registrado",
    titulo, mensaje, canal: "ambos", telefono: opts.telefono,
    entidad: "compra", entidad_id: opts.id_compra,
  })
}

// Bajo stock — para admin/recepción
export async function notifBajoStock(opts: {
  id_usuario: number; nombre_producto: string; stock_actual: number; stock_minimo: number
}) {
  const titulo  = "⚠️ Bajo stock"
  const mensaje =
    `Alerta de inventario: "${opts.nombre_producto}" tiene solo ${opts.stock_actual} unidades ` +
    `(mínimo: ${opts.stock_minimo}). Se recomienda reabastecer pronto. — SPA Mascotas`

  return crearNotificacion({
    id_usuario: opts.id_usuario, tipo: "bajo_stock",
    titulo, mensaje, canal: "app",   // solo app para admin, sin WhatsApp
    entidad: "inventario",
  })
}