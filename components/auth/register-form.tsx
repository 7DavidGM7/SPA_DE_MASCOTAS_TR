"use client"

import { useState, type FormEvent, useRef, KeyboardEvent, ClipboardEvent } from "react"
import Link from "next/link"
import { FormInput } from "./form-input"
import { SubmitButton } from "./submit-button"
import { AlertMessage } from "./alert-message"
import { cn } from "@/lib/utils"
import { CheckCircle2, Mail, RefreshCw, X, ArrowRight, Check, X as XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

interface FormData {
  ci: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  password: string
  confirmPassword: string
  aceptaTerminos: boolean
}

interface FormErrors {
  ci?: string
  nombre?: string
  apellido?: string
  telefono?: string
  email?: string
  password?: string
  confirmPassword?: string
  aceptaTerminos?: string
}

// ─── Lógica del medidor de fuerza ─────────────────────────────────────────────
interface PasswordStrength {
  score: number        // 0 a 4
  label: string
  color: string
  barColor: string
}

interface PasswordRule {
  label: string
  test: (p: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "Mínimo 8 caracteres",              test: (p) => p.length >= 8 },
  { label: "Al menos una mayúscula (A-Z)",      test: (p) => /[A-Z]/.test(p) },
  { label: "Al menos una minúscula (a-z)",      test: (p) => /[a-z]/.test(p) },
  { label: "Al menos un número (0-9)",          test: (p) => /\d/.test(p) },
  { label: "Al menos un símbolo (*, #, !, @…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
]

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", color: "", barColor: "" }

  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length

  if (passed <= 1) return { score: 1, label: "Muy débil",  color: "text-red-600",    barColor: "bg-red-500" }
  if (passed === 2) return { score: 2, label: "Débil",     color: "text-orange-500", barColor: "bg-orange-400" }
  if (passed === 3) return { score: 3, label: "Regular",   color: "text-yellow-500", barColor: "bg-yellow-400" }
  if (passed === 4) return { score: 4, label: "Fuerte",    color: "text-green-500",  barColor: "bg-green-400" }
  return                { score: 5, label: "Muy fuerte", color: "text-green-600",  barColor: "bg-green-500" }
}

// ─── Componente medidor de fuerza ──────────────────────────────────────────────
function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null

  const strength = getPasswordStrength(password)

  return (
    <div className="mt-2 space-y-2">
      {/* Barras de progreso */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              strength.score >= level ? strength.barColor : "bg-gray-200 dark:bg-gray-700"
            )}
          />
        ))}
      </div>

      {/* Etiqueta de fuerza */}
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-semibold transition-colors", strength.color)}>
          {strength.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {PASSWORD_RULES.filter((r) => r.test(password)).length}/5 requisitos
        </span>
      </div>

      {/* Checklist de reglas */}
      <ul className="space-y-1 pt-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <li key={rule.label} className="flex items-center gap-2">
              {ok ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <XIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
              )}
              <span
                className={cn(
                  "text-xs transition-colors",
                  ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                )}
              >
                {rule.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Modal de verificación de código ──────────────────────────────────────────
function VerificationModal({
  email,
  onSuccess,
  onClose,
}: {
  email: string
  onSuccess: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [digits, setDigits] = useState(["", "", "", "", "", ""])
  const [alert, setAlert] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [verified, setVerified] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const code = digits.join("")

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)
    setAlert(null)
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      setDigits(pasted.split(""))
      inputsRef.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    if (code.length < 6) {
      setAlert({ type: "warning", message: "Ingresa los 6 dígitos del código." })
      return
    }
    setIsVerifying(true)
    setAlert(null)
    try {
      const response = await fetch("/api/auth/verificar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      })
      const data = await response.json()
      if (response.ok) {
        setVerified(true)
        setAlert({ type: "success", message: "¡Cuenta verificada! Redirigiendo al login..." })
        setTimeout(() => router.push("/login"), 2000)
      } else {
        setAlert({ type: "error", message: data.message || "Código incorrecto o expirado." })
        setDigits(["", "", "", "", "", ""])
        inputsRef.current[0]?.focus()
      }
    } catch {
      setAlert({ type: "error", message: "Error de conexión. Intenta de nuevo." })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setAlert(null)
    try {
      const response = await fetch("/api/auth/verificar-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (response.ok) {
        setAlert({ type: "success", message: "Nuevo código enviado. Revisa tu correo." })
        setDigits(["", "", "", "", "", ""])
        inputsRef.current[0]?.focus()
      } else {
        setAlert({ type: "error", message: data.message || "No se pudo reenviar el código." })
      }
    } catch {
      setAlert({ type: "error", message: "Error de conexión. Intenta de nuevo." })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200">
        {!verified && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        )}
        <div className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              {verified ? (
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-9 h-9 text-primary" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {verified ? "¡Cuenta verificada!" : "Verifica tu correo"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {verified
                  ? "Tu cuenta está activa. Redirigiendo..."
                  : <> Ingresa el código de 6 dígitos enviado a<br /><span className="font-medium text-foreground">{email}</span></>
                }
              </p>
            </div>
          </div>

          {alert && <AlertMessage type={alert.type} message={alert.message} />}

          {!verified && (
            <>
              <div className="flex justify-center gap-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    className={cn(
                      "w-12 h-14 text-center text-2xl font-bold rounded-xl border-2",
                      "bg-input text-foreground",
                      "transition-all duration-150",
                      "focus:outline-none focus:border-primary focus:shadow-md focus:shadow-primary/20",
                      digit ? "border-primary/60" : "border-border",
                      "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    )}
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={isVerifying || code.length < 6}
                className={cn(
                  "w-full py-3.5 px-6 rounded-xl font-semibold text-base",
                  "bg-primary text-primary-foreground",
                  "shadow-lg shadow-primary/25",
                  "transition-all duration-300 ease-out",
                  "hover:bg-[#2F5C8A] hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30",
                  "active:scale-[0.98]",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isVerifying ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Verificando...</>
                ) : (
                  <> Verificar cuenta <ArrowRight className="w-5 h-5" /></>
                )}
              </button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  ¿No recibiste el código?{" "}
                  <button
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-primary font-medium hover:text-[#2F5C8A] hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? "Enviando..." : "Reenviar código"}
                  </button>
                </p>
                <p className="text-xs text-muted-foreground mt-1">El código expira en 15 minutos</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Formulario de registro principal ─────────────────────────────────────────
export function RegisterForm() {
  const [formData, setFormData] = useState<FormData>({
    ci: "",
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    password: "",
    confirmPassword: "",
    aceptaTerminos: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.ci || formData.ci.length < 6) {
      newErrors.ci = "El CI debe tener al menos 6 caracteres"
    }
    if (!formData.nombre || formData.nombre.length < 2) {
      newErrors.nombre = "El nombre debe tener al menos 2 caracteres"
    }
    if (!formData.apellido || formData.apellido.length < 2) {
      newErrors.apellido = "El apellido debe tener al menos 2 caracteres"
    }
    if (!formData.telefono || !/^[0-9]{7,15}$/.test(formData.telefono.replace(/\s/g, ""))) {
      newErrors.telefono = "Ingresa un número de teléfono válido"
    }
    if (!formData.email) {
      newErrors.email = "El correo electrónico es requerido"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Ingresa un correo electrónico válido"
    }

    // Validación estricta de contraseña — todos los requisitos obligatorios
    if (!formData.password) {
      newErrors.password = "La contraseña es requerida"
    } else {
      const failedRules = PASSWORD_RULES.filter((r) => !r.test(formData.password))
      if (failedRules.length > 0) {
        newErrors.password = failedRules[0].label // muestra el primer requisito pendiente
      }
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden"
    }
    if (!formData.aceptaTerminos) {
      newErrors.aceptaTerminos = "Debes aceptar los términos y condiciones"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAlert(null)
    if (!validateForm()) return
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ci: formData.ci,
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono,
          email: formData.email,
          password: formData.password,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAlert({ type: "error", message: data.message || "Error al registrar" })
      } else {
        setRegisteredEmail(formData.email)
        setShowVerification(true)
        setFormData({
          ci: "", nombre: "", apellido: "", telefono: "",
          email: "", password: "", confirmPassword: "", aceptaTerminos: false,
        })
      }
    } catch {
      setAlert({ type: "error", message: "Error de conexión. Intenta de nuevo." })
    } finally {
      setIsLoading(false)
    }
  }

  // La contraseña cumple todos los requisitos
  const passwordIsValid = PASSWORD_RULES.every((r) => r.test(formData.password))

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {alert && <AlertMessage type={alert.type} message={alert.message} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            id="ci"
            label="Cédula de Identidad"
            placeholder="12345678"
            value={formData.ci}
            onChange={(value) => updateField("ci", value)}
            error={errors.ci}
            required
          />
          <FormInput
            id="telefono"
            label="Teléfono"
            type="tel"
            placeholder="09X XXX XXXX"
            value={formData.telefono}
            onChange={(value) => updateField("telefono", value)}
            error={errors.telefono}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            id="nombre"
            label="Nombre"
            placeholder="Juan"
            value={formData.nombre}
            onChange={(value) => updateField("nombre", value)}
            error={errors.nombre}
            required
            autoComplete="given-name"
          />
          <FormInput
            id="apellido"
            label="Apellido"
            placeholder="Pérez"
            value={formData.apellido}
            onChange={(value) => updateField("apellido", value)}
            error={errors.apellido}
            required
            autoComplete="family-name"
          />
        </div>

        <FormInput
          id="email"
          label="Correo electrónico"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          value={formData.email}
          onChange={(value) => updateField("email", value)}
          error={errors.email}
          required
          autoComplete="email"
        />

        {/* ── Campo contraseña + medidor de fuerza ── */}
        <div>
          <FormInput
            id="password"
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(value) => updateField("password", value)}
            error={errors.password}
            required
            autoComplete="new-password"
          />
          {/* El medidor aparece en cuanto el usuario empieza a escribir */}
          <PasswordStrengthMeter password={formData.password} />
        </div>

        {/* Campo confirmar contraseña — con indicador visual de coincidencia */}
        <div>
          <FormInput
            id="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(value) => updateField("confirmPassword", value)}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />
          {/* Indicador de coincidencia */}
          {formData.confirmPassword && (
            <p
              className={cn(
                "text-xs mt-1.5 flex items-center gap-1.5 transition-colors",
                formData.password === formData.confirmPassword
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-500"
              )}
            >
              {formData.password === formData.confirmPassword ? (
                <><Check className="w-3.5 h-3.5" /> Las contraseñas coinciden</>
              ) : (
                <><XIcon className="w-3.5 h-3.5" /> Las contraseñas no coinciden</>
              )}
            </p>
          )}
        </div>

        {/* Checkbox términos */}
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={formData.aceptaTerminos}
                onChange={(e) => updateField("aceptaTerminos", e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={cn(
                  "w-5 h-5 rounded-md border-2 transition-all duration-200",
                  "peer-focus:ring-2 peer-focus:ring-primary peer-focus:ring-offset-2",
                  formData.aceptaTerminos
                    ? "bg-primary border-primary"
                    : "bg-input border-border group-hover:border-primary/50",
                  errors.aceptaTerminos && "border-destructive"
                )}
              >
                {formData.aceptaTerminos && (
                  <svg
                    className="w-full h-full text-primary-foreground p-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              Acepto los{" "}
              <Link href="/terminos" className="text-primary hover:underline">
                términos y condiciones
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" className="text-primary hover:underline">
                política de privacidad
              </Link>
            </span>
          </label>
          {errors.aceptaTerminos && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <span className="inline-block w-1 h-1 bg-destructive rounded-full" />
              {errors.aceptaTerminos}
            </p>
          )}
        </div>

        {/* El botón se deshabilita si la contraseña no cumple todos los requisitos */}
        <SubmitButton isLoading={isLoading} disabled={!passwordIsValid && formData.password.length > 0}>
          Crear cuenta
        </SubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:text-[#2F5C8A] hover:underline transition-colors"
          >
            Inicia sesión
          </Link>
        </p>
      </form>

      {showVerification && (
        <VerificationModal
          email={registeredEmail}
          onSuccess={() => setShowVerification(false)}
          onClose={() => setShowVerification(false)}
        />
      )}
    </>
  )
}