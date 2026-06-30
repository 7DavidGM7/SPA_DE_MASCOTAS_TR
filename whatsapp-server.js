// whatsapp-server.js
// Servidor Express en puerto 3001 que usa whatsapp-web.js
// para enviar mensajes desde tu número personal.
//
// USO:
//   1. npm install whatsapp-web.js qrcode-terminal express cors
//   2. node whatsapp-server.js
//   3. Escanea el QR con tu celular (WhatsApp > Dispositivos vinculados)
//   4. Listo — Next.js ya puede enviarle mensajes

const express    = require("express")
const cors       = require("cors")
const { Client, LocalAuth } = require("whatsapp-web.js")
const qrcode     = require("qrcode-terminal")

const app  = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// ── Estado del cliente WA ─────────────────────────────────────────────────
let clienteListo = false
let ultimoQR     = null

const wa = new Client({
  authStrategy: new LocalAuth({ clientId: "spa-mascotas" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
})

// ── Eventos WhatsApp ──────────────────────────────────────────────────────
wa.on("qr", (qr) => {
  ultimoQR = qr
  console.log("\n📱 Escanea este QR con tu celular (WhatsApp > Dispositivos vinculados):\n")
  qrcode.generate(qr, { small: true })
  console.log("\nO abre http://localhost:3001/qr en el navegador\n")
})

wa.on("ready", () => {
  clienteListo = true
  ultimoQR     = null
  console.log("✅ WhatsApp conectado y listo para enviar mensajes")
})

wa.on("authenticated", () => {
  console.log("🔐 Autenticado — sesión guardada en .wwebjs_auth/")
})

wa.on("auth_failure", (msg) => {
  clienteListo = false
  console.error("❌ Error de autenticación:", msg)
})

wa.on("disconnected", (reason) => {
  clienteListo = false
  console.warn("⚠️  WhatsApp desconectado:", reason)
  // Reconectar automáticamente después de 5 segundos
  setTimeout(() => {
    console.log("🔄 Intentando reconectar...")
    wa.initialize()
  }, 5000)
})

wa.initialize()

// ── Helper: formatear número boliviano ────────────────────────────────────
// Acepta: "72345678", "+59172345678", "59172345678"
// Devuelve: "59172345678@c.us"  (formato requerido por whatsapp-web.js)
function formatearNumero(tel) {
  if (!tel) return null
  // Quitar espacios, guiones, paréntesis
  let num = String(tel).replace(/[\s\-\(\)]/g, "")
  // Quitar el + si viene
  if (num.startsWith("+")) num = num.slice(1)
  // Si es número boliviano de 8 dígitos, agregar prefijo país
  if (num.length === 8) num = "591" + num
  // Si no tiene @c.us, agregarlo
  if (!num.includes("@")) num = num + "@c.us"
  return num
}

// ── Helper: enviar mensaje con reintentos ─────────────────────────────────
async function enviarMensaje(telefono, mensaje) {
  if (!clienteListo) {
    throw new Error("WhatsApp no está conectado aún. Escanea el QR primero.")
  }
  const numero = formatearNumero(telefono)
  if (!numero) throw new Error("Número de teléfono inválido")

  // Verificar que el número existe en WhatsApp
  const existe = await wa.isRegisteredUser(numero)
  if (!existe) {
    throw new Error(`El número ${telefono} no tiene WhatsApp registrado`)
  }

  await wa.sendMessage(numero, mensaje)
  return true
}

// ══════════════════════════════════════════════════════════════════════════
// ── RUTAS API ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

// ── GET /status — verificar si está conectado ─────────────────────────────
app.get("/status", (req, res) => {
  res.json({
    conectado: clienteListo,
    tieneQR:   !!ultimoQR,
  })
})

// ── GET /qr — ver QR en el navegador ─────────────────────────────────────
app.get("/qr", (req, res) => {
  if (clienteListo) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2 style="color:green">✅ WhatsApp ya está conectado</h2>
        <p>El servidor está listo para enviar mensajes.</p>
      </body></html>
    `)
  }
  if (!ultimoQR) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>⏳ Generando QR...</h2>
        <p>Espera unos segundos y recarga la página.</p>
        <script>setTimeout(()=>location.reload(), 3000)</script>
      </body></html>
    `)
  }
  // Mostrar QR como imagen usando qrserver.com
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ultimoQR)}`
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0">
      <h2>📱 Escanea este QR con WhatsApp</h2>
      <p style="color:#666">WhatsApp > Dispositivos vinculados > Vincular dispositivo</p>
      <img src="${qrUrl}" style="border:8px solid white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.2)" />
      <p style="color:#999;margin-top:16px">El QR expira en ~60 segundos. Si expira, recarga la página.</p>
      <script>setTimeout(()=>location.reload(), 30000)</script>
    </body></html>
  `)
})

// ── POST /send — mensaje libre ────────────────────────────────────────────
app.post("/send", async (req, res) => {
  const { telefono, mensaje } = req.body
  if (!telefono || !mensaje)
    return res.status(400).json({ ok: false, error: "telefono y mensaje son requeridos" })

  try {
    await enviarMensaje(telefono, mensaje)
    res.json({ ok: true })
  } catch (err) {
    console.error("[/send]", err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /send/pedido — notificación de pedido de productos ───────────────
app.post("/send/pedido", async (req, res) => {
  const { telefono, nombre_cliente, id_compra, items, total, descuento } = req.body

  if (!telefono || !items?.length)
    return res.status(400).json({ ok: false, error: "Faltan datos del pedido" })

  // Armar lista de productos
  const listaItems = items
    .map(i => `  • ${i.nombre} x${i.cantidad} — Bs. ${Number(i.subtotal).toFixed(2)}`)
    .join("\n")

  const descuentoLinea = descuento > 0
    ? `\n🏷️ *Descuento aplicado:* - Bs. ${Number(descuento).toFixed(2)}`
    : ""

  const mensaje = `🛍️ *¡Pedido recibido, ${nombre_cliente || "estimado cliente"}!*

Tu pedido *#${id_compra}* en *SPA Mascotas* ha sido registrado correctamente.

📦 *Productos:*
${listaItems}${descuentoLinea}

💰 *Total a pagar:* Bs. ${Number(total).toFixed(2)}

⏳ Tu pedido está *pendiente de pago*. Acércate a caja para cancelarlo y retirar tus productos.

¡Gracias por confiar en nosotros! 🐾`

  try {
    await enviarMensaje(telefono, mensaje)
    console.log(`✅ [Pedido #${id_compra}] WA enviado a ${telefono}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`❌ [Pedido #${id_compra}]`, err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /send/pago — confirmación de pago ────────────────────────────────
app.post("/send/pago", async (req, res) => {
  const {
    telefono, nombre_cliente, nombre_mascota,
    nombre_servicio, monto, metodo_pago, descuento, nro_factura
  } = req.body

  if (!telefono)
    return res.status(400).json({ ok: false, error: "Falta teléfono" })

  const metodosLabel = {
    efectivo:        "Efectivo 💵",
    qr:              "QR 📲",
    transferencia:   "Transferencia 🏦",
    tarjeta_credito: "Tarjeta de Crédito 💳",
    tarjeta_debito:  "Tarjeta de Débito 💳",
  }

  const descuentoLinea = descuento > 0
    ? `\n🏷️ *Descuento:* - Bs. ${Number(descuento).toFixed(2)}`
    : ""

  const facturaLinea = nro_factura
    ? `\n🧾 *Factura:* ${nro_factura}`
    : ""

  const mensaje = `✅ *¡Pago confirmado, ${nombre_cliente || "estimado cliente"}!*

Tu pago en *SPA Mascotas* fue registrado exitosamente.

🐾 *Mascota:* ${nombre_mascota || "—"}
✂️ *Servicio:* ${nombre_servicio || "—"}${descuentoLinea}
💰 *Total pagado:* Bs. ${Number(monto).toFixed(2)}
💳 *Método:* ${metodosLabel[metodo_pago] || metodo_pago}${facturaLinea}

¡Gracias por visitarnos! Tu mascota quedó en buenas manos. 🐾`

  try {
    await enviarMensaje(telefono, mensaje)
    console.log(`✅ [Pago WA] enviado a ${telefono}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`❌ [Pago WA]`, err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /send/cita-confirmada ────────────────────────────────────────────
app.post("/send/cita-confirmada", async (req, res) => {
  const { telefono, nombre_cliente, nombre_mascota, fecha, hora, servicio, id_cita } = req.body

  if (!telefono)
    return res.status(400).json({ ok: false, error: "Falta teléfono" })

  const mensaje = `📅 *¡Cita confirmada!*

Hola *${nombre_cliente || "estimado cliente"}*, tu cita en *SPA Mascotas* ha sido confirmada. 🎉

🐾 *Mascota:* ${nombre_mascota || "—"}
✂️ *Servicio:* ${servicio || "—"}
📆 *Fecha:* ${fecha}
🕐 *Hora:* ${hora}

Por favor llega 5 minutos antes. Si necesitas cancelar, hazlo con al menos 24 horas de anticipación.

¡Esperamos verte pronto! 🐾`

  try {
    await enviarMensaje(telefono, mensaje)
    console.log(`✅ [Cita #${id_cita}] WA confirmación enviado a ${telefono}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`❌ [Cita #${id_cita}]`, err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /send/cita-cancelada ─────────────────────────────────────────────
app.post("/send/cita-cancelada", async (req, res) => {
  const { telefono, nombre_cliente, nombre_mascota, fecha, id_cita } = req.body

  if (!telefono)
    return res.status(400).json({ ok: false, error: "Falta teléfono" })

  const mensaje = `❌ *Cita cancelada*

Hola *${nombre_cliente || "estimado cliente"}*, lamentamos informarte que tu cita en *SPA Mascotas* fue cancelada.

🐾 *Mascota:* ${nombre_mascota || "—"}
📆 *Fecha:* ${fecha}

Si deseas reagendar, visítanos o comunícate con nosotros. ¡Esperamos verte pronto! 🐾`

  try {
    await enviarMensaje(telefono, mensaje)
    console.log(`✅ [Cita #${id_cita}] WA cancelación enviado a ${telefono}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`❌ [Cita #${id_cita}]`, err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Iniciar servidor ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor WhatsApp corriendo en http://localhost:${PORT}`)
  console.log(`📱 Abre http://localhost:${PORT}/qr para escanear el QR\n`)
})