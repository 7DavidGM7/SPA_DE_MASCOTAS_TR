import { NextRequest, NextResponse } from "next/server"
import { verifyAccessTokenEdge } from "@/lib/auth-edge"
import type { Rol } from "@/lib/auth-edge"

const RUTAS_PUBLICAS = [
  "/",
  "/login",
  "/registro",
  "/recuperar-password",
  "/api/auth/login",
  "/api/auth/registrar",
  "/api/auth/refresh",
  "/api/auth/verificar-email",
]

const PERMISOS: Record<string, Rol[]> = {
  "/admin":     ["admin"],
  "/recepcion": ["admin", "recepcionista"],
  "/cajero":    ["admin", "cajero"],
  "/groomer":   ["admin", "groomer"],
  "/dashboard": ["admin", "cliente"],
}

const DASHBOARD_POR_ROL: Record<Rol, string> = {
  admin:         "/admin",
  recepcionista: "/recepcion",
  cajero:        "/cajero",
  groomer:       "/groomer",
  cliente:       "/dashboard",
}

// ← nombre cambiado a "proxy" como exige Next.js 16
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    RUTAS_PUBLICAS.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get("accessToken")?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const payload = await verifyAccessTokenEdge(token)

  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const rol = payload.rol as Rol

  const rutaProtegida = Object.keys(PERMISOS).find((r) => pathname.startsWith(r))

  if (rutaProtegida) {
    const rolesPermitidos = PERMISOS[rutaProtegida]
    if (!rolesPermitidos.includes(rol)) {
      const destino = DASHBOARD_POR_ROL[rol] ?? "/dashboard"
      return NextResponse.redirect(new URL(destino, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}