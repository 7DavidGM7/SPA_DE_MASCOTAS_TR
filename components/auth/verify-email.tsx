"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import { PawIcon } from "@/components/icons/paw-icon"

type VerificationStatus = "loading" | "success" | "error" | "no-token"

export function VerifyEmail() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [status, setStatus] = useState<VerificationStatus>("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("no-token")
      setMessage("No se encontró el token de verificación.")
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verificar-email?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          setMessage(data.message || "¡Tu cuenta ha sido verificada exitosamente!")
        } else {
          setStatus("error")
          setMessage(data.message || "Error al verificar el correo electrónico.")
        }
      } catch {
        setStatus("error")
        setMessage("Error de conexión. Por favor, intenta de nuevo.")
      }
    }

    verifyEmail()
  }, [token])

  return (
    <div className="text-center space-y-6">
      {status === "loading" && (
        <>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-secondary/30 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                <PawIcon size={24} className="text-primary" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Verificando tu cuenta...
            </h2>
            <p className="text-muted-foreground">
              Estamos procesando tu solicitud. Por favor, espera un momento.
            </p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-14 h-14 text-success" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                <PawIcon size={24} className="text-success" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              ¡Cuenta verificada!
            </h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:bg-[#2F5C8A] transition-all duration-300 hover:scale-[1.02]"
            >
              Iniciar sesión
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-14 h-14 text-destructive" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                <PawIcon size={24} className="text-destructive" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Error de verificación
            </h2>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/registro"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-secondary transition-colors"
              >
                Registrarse de nuevo
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:bg-[#2F5C8A] transition-all duration-300"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </>
      )}

      {status === "no-token" && (
        <>
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-warning/10 flex items-center justify-center">
                <Mail className="w-14 h-14 text-warning" />
              </div>
              <div className="absolute -bottom-1 -right-1">
                <PawIcon size={24} className="text-warning" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Token no encontrado
            </h2>
            <p className="text-muted-foreground mb-6">
              {message} Por favor, revisa el enlace en tu correo electrónico.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:bg-[#2F5C8A] transition-all duration-300"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
