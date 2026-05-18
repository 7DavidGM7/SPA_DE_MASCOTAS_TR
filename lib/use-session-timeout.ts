"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
const AVISO_MS   = 60 * 1000       // aviso 1 minuto antes

// Eventos que se consideran "actividad del usuario"
const EVENTOS_ACTIVIDAD = [
  "mousemove", "mousedown", "keydown",
  "touchstart", "scroll", "click",
]

interface UseSessionTimeoutOptions {
  onAviso?: () => void    // callback 1 min antes de expirar
  onExpirado?: () => void // callback al expirar
}

export function useSessionTimeout({
  onAviso,
  onExpirado,
}: UseSessionTimeoutOptions = {}) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const timerExpiracion = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerAviso      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpiarTimers = useCallback(() => {
    if (timerExpiracion.current) clearTimeout(timerExpiracion.current)
    if (timerAviso.current)      clearTimeout(timerAviso.current)
  }, [])

  const iniciarTimers = useCallback(() => {
    limpiarTimers()

    // Aviso 1 minuto antes
    timerAviso.current = setTimeout(() => {
      onAviso?.()
    }, TIMEOUT_MS - AVISO_MS)

    // Cierre de sesión
    timerExpiracion.current = setTimeout(() => {
      onExpirado?.()
      logout()
      router.replace("/login?razon=inactividad")
    }, TIMEOUT_MS)
  }, [limpiarTimers, logout, router, onAviso, onExpirado])

  const resetearTimer = useCallback(() => {
    if (user) iniciarTimers()
  }, [user, iniciarTimers])

  useEffect(() => {
    if (!user) return // Solo correr si hay sesión activa

    // Arrancar timers al montar
    iniciarTimers()

    // Reiniciar en cada evento de actividad
    EVENTOS_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, resetearTimer, { passive: true })
    )

    return () => {
      limpiarTimers()
      EVENTOS_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, resetearTimer)
      )
    }
  }, [user, iniciarTimers, resetearTimer, limpiarTimers])
}
