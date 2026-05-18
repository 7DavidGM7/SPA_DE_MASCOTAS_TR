"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Rol } from "@/lib/auth"

export type { Rol }

export const DASHBOARD_POR_ROL: Record<Rol, string> = {
  admin:          "/admin",
  recepcionista:  "/recepcion",
  cajero:         "/cajero",
  groomer:        "/groomer",
  cliente:        "/dashboard",
}

interface User {
  id: string
  email: string
  nombre: string
  apellido: string
  rol: Rol
}

interface LoginResult {
  success: boolean
  message: string
  user?: User
  needsVerification?: boolean
  bloqueado?: boolean
  minutosRestantes?: number
  intentosRestantes?: number
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ── Helpers para cookie del accessToken ──────────────────────────────────────
function setTokenCookie(token: string) {
  // 15 minutos — igual que la expiración del JWT
  const expires = new Date(Date.now() + 15 * 60 * 1000).toUTCString()
  document.cookie = `accessToken=${token}; path=/; expires=${expires}; SameSite=Lax`
}

function clearTokenCookie() {
  document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem("refreshToken")
    clearTokenCookie()
  }, [])

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem("refreshToken")
    if (!refreshToken) return false
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      if (!response.ok) { logout(); return false }
      const data = await response.json()
      setAccessToken(data.accessToken)
      setUser(data.user)
      setTokenCookie(data.accessToken) // ← renovar cookie también
      return true
    } catch {
      logout()
      return false
    }
  }, [logout])

  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = localStorage.getItem("refreshToken")
      if (refreshToken) await refreshAccessToken()
      setIsLoading(false)
    }
    initAuth()
  }, [refreshAccessToken])

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403 && data.needsVerification) {
          return { success: false, message: data.message, needsVerification: true }
        }
        return {
          success: false,
          message: data.message || "Error al iniciar sesión",
          bloqueado: data.bloqueado,
          minutosRestantes: data.minutosRestantes,
          intentosRestantes: data.intentosRestantes,
        }
      }

      setAccessToken(data.accessToken)
      setUser(data.user)
      localStorage.setItem("refreshToken", data.refreshToken)
      setTokenCookie(data.accessToken) // ← guardar en cookie para el middleware

      return { success: true, message: "Inicio de sesión exitoso", user: data.user }
    } catch {
      return { success: false, message: "Error de conexión. Intenta de nuevo." }
    }
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return context
}