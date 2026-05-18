"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormInput } from "./form-input"
import { SubmitButton } from "./submit-button"
import { AlertMessage } from "./alert-message"
import { useAuth } from "@/lib/auth-context"

export function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "warning"
    message: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Contador visual de intentos restantes
  const [intentosRestantes, setIntentosRestantes] = useState<number | null>(null)
  // Minutos de bloqueo cuando la cuenta queda bloqueada
  const [minutosBloqueado, setMinutosBloqueado] = useState<number | null>(null)

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}

    if (!email) {
      newErrors.email = "El correo electrónico es requerido"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Ingresa un correo electrónico válido"
    }

    if (!password) {
      newErrors.password = "La contraseña es requerida"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAlert(null)
    setIntentosRestantes(null)
    setMinutosBloqueado(null)

    if (!validateForm()) return

    setIsLoading(true)

    const result = await login(email, password)

    setIsLoading(false)

    if (result.success) {
      setAlert({ type: "success", message: result.message })
      setTimeout(() => {
      const destino = {
        admin: "/admin", recepcionista: "/recepcion",
        cajero: "/cajero", groomer: "/groomer", cliente: "/dashboard"
      }[result.user?.rol ?? "cliente"] ?? "/dashboard"
      router.replace(destino)
      }, 1000)
    } else if (result.needsVerification) {
      setAlert({ type: "warning", message: result.message })
    } else if (result.bloqueado) {
      // Cuenta bloqueada temporalmente
      setMinutosBloqueado(result.minutosRestantes ?? 15)
      setAlert({
        type: "error",
        message: result.message,
      })
    } else {
      // Credenciales inválidas — mostrar intentos restantes si vienen
      if (typeof result.intentosRestantes === "number") {
        setIntentosRestantes(result.intentosRestantes)
      }
      setAlert({ type: "error", message: result.message })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {alert && <AlertMessage type={alert.type} message={alert.message} />}

      {/* Barra de intentos restantes */}
      {intentosRestantes !== null && intentosRestantes > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Intentos restantes antes del bloqueo
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                  i < intentosRestantes
                    ? intentosRestantes <= 1
                      ? "bg-red-500"
                      : intentosRestantes === 2
                      ? "bg-orange-400"
                      : "bg-amber-400"
                    : "bg-amber-100"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-1.5">
            {intentosRestantes} intento{intentosRestantes !== 1 ? "s" : ""} restante
            {intentosRestantes !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Mensaje de cuenta bloqueada con temporizador visual */}
      {minutosBloqueado !== null && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-sm font-semibold text-red-800">Cuenta bloqueada</p>
          <p className="text-xs text-red-600 mt-1">
            Podrás volver a intentarlo en{" "}
            <span className="font-bold">{minutosBloqueado} minuto{minutosBloqueado !== 1 ? "s" : ""}</span>
          </p>
        </div>
      )}

      <div className="space-y-4">
        <FormInput
          id="email"
          label="Correo electrónico"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChange={(value) => {
            setEmail(value)
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
          }}
          error={errors.email}
          required
          autoComplete="email"
          disabled={minutosBloqueado !== null}
        />

        <FormInput
          id="password"
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          error={errors.password}
          required
          autoComplete="current-password"
          disabled={minutosBloqueado !== null}
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/recuperar-password"
          className="text-sm text-primary hover:text-[#2F5C8A] hover:underline transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <SubmitButton isLoading={isLoading} disabled={minutosBloqueado !== null}>
        Iniciar sesión
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes una cuenta?{" "}
        <Link
          href="/registro"
          className="text-primary font-medium hover:text-[#2F5C8A] hover:underline transition-colors"
        >
          Regístrate aquí
        </Link>
      </p>
    </form>
  )
}