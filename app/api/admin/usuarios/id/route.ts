// app/api/admin/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken } from "@/lib/auth"
import { registrarLog, getIP } from "@/lib/logger"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

async function verificarAdmin(request: NextRequest) {
  const tokenCookie = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const tokenHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const token = tokenCookie ?? tokenHeader
  if (!token) return null
  const payload = await verifyAccessToken(token)
  if (!payload || payload.rol !== "admin") return null
  return payload
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await verificarAdmin(request)
  if (!admin) return NextResponse.json({ message: "No autorizado" }, { status: 403 })

  try {
    const { estado } = await request.json()
    if (!["activo", "bloqueado", "inactivo"].includes(estado))
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })

    const id = Number(params.id)

    // Obtener nombre del usuario afectado para el log
    const usuarioRes = await pool.query(
      "SELECT nombre, apellido, rol FROM usuario WHERE id_usuario = $1",
      [id]
    )
    const usuarioAfectado = usuarioRes.rows[0]

    await pool.query(
      "UPDATE usuario SET estado = $1 WHERE id_usuario = $2",
      [estado, id]
    )

    // Log de la acción
    const accion = estado === "bloqueado" ? "BLOQUEAR_USUARIO" : "ACTIVAR_USUARIO"
    await registrarLog({
      id_usuario: Number(admin.userId),
      accion,
      entidad: "usuario",
      entidad_id: id,
      detalle: usuarioAfectado
        ? `${accion === "BLOQUEAR_USUARIO" ? "Bloqueó" : "Activó"} cuenta de ${usuarioAfectado.rol}: ${usuarioAfectado.nombre} ${usuarioAfectado.apellido}`
        : `Cambió estado a "${estado}" del usuario id=${id}`,
      ip: getIP(request),
    })

    return NextResponse.json({ message: "Estado actualizado." }, { status: 200 })
  } catch (error) {
    console.error("[admin/usuarios PATCH]", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}