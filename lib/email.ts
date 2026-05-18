import nodemailer from 'nodemailer'

// Configuración del transporter de Nodemailer
// Usa las variables de entorno definidas en .env.local
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true solo para port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Contraseña de Aplicación de Google
  },
})

// Verificar configuración al cargar el módulo (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify().then(() => {
    console.log('[Email] Servidor de email conectado correctamente')
  }).catch((err) => {
    console.error('[Email] Error al conectar servidor de email:', err.message)
    console.error('[Email] Verifica EMAIL_HOST, EMAIL_USER y EMAIL_PASS en .env.local')
  })
}

interface EmailOptions {
  to: string
  subject: string
  html: string
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"SPA Mascotas" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    console.log('[Email] Mensaje enviado:', info.messageId)
    return true
  } catch (error) {
    console.error('[Email] Error al enviar email:', error)
    return false
  }
}

// Template del email de verificación
export async function sendVerificationEmail(
  email: string,
  nombre: string,
  token: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifica tu cuenta - SPA Mascotas</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="background:#7c3aed;padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🐾 SPA Mascotas</h1>
                  <p style="margin:8px 0 0;color:#ddd6fe;font-size:14px;">Verificación de cuenta</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <p style="margin:0 0 16px;color:#3f3f46;font-size:16px;">Hola <strong>${nombre}</strong>,</p>
                  <p style="margin:0 0 24px;color:#71717a;font-size:15px;line-height:1.6;">
                    Gracias por registrarte. Usa el siguiente código para verificar tu cuenta:
                  </p>
                  <!-- Token -->
                  <div style="background:#f5f3ff;border:2px dashed #8b5cf6;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                    <p style="margin:0 0 8px;color:#7c3aed;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Código de verificación</p>
                    <p style="margin:0;color:#4c1d95;font-size:42px;font-weight:700;letter-spacing:12px;font-family:monospace;">${token}</p>
                  </div>
                  <p style="margin:0 0 24px;color:#71717a;font-size:14px;">
                    ⏰ Este código expira en <strong>15 minutos</strong>.
                  </p>
                  <p style="margin:0;color:#a1a1aa;font-size:13px;">
                    Si no creaste esta cuenta, puedes ignorar este correo.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                    © ${new Date().getFullYear()} SPA Mascotas · Este es un correo automático, no respondas.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: '🐾 Verifica tu cuenta en SPA Mascotas',
    html,
  })
}

// Template del email de recuperación de contraseña (para uso futuro)
export async function sendPasswordResetEmail(
  email: string,
  nombre: string,
  token: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="background:#7c3aed;padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;">🐾 SPA Mascotas</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;">
                  <p style="color:#3f3f46;">Hola <strong>${nombre}</strong>,</p>
                  <p style="color:#71717a;">Usa este código para restablecer tu contraseña:</p>
                  <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:12px;padding:24px;text-align:center;">
                    <p style="margin:0;color:#92400e;font-size:42px;font-weight:700;letter-spacing:12px;font-family:monospace;">${token}</p>
                  </div>
                  <p style="color:#71717a;font-size:14px;margin-top:20px;">Expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: '🔑 Recupera tu contraseña - SPA Mascotas',
    html,
  })
}
