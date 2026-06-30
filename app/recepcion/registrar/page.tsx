"use client"
// app/recepcion/registrar/page.tsx

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ChevronLeft, Users, PawPrint, CheckCircle,
  AlertCircle, Loader2, Plus, UserPlus
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface FormCliente {
  ci: string; nombre: string; apellido: string
  telefono: string; email: string; acepta_notificaciones: boolean
}

interface FormMascota {
  nombre: string; especie: string; raza: string; tamanio: string
  fecha_nacimiento: string; peso_kg: string; color_pelaje: string
  temperamento: string; observaciones_medicas: string
}

const FORM_CLIENTE_INICIAL: FormCliente = {
  ci: "", nombre: "", apellido: "",
  telefono: "", email: "", acepta_notificaciones: true
}

const FORM_MASCOTA_INICIAL: FormMascota = {
  nombre: "", especie: "perro", raza: "", tamanio: "mediano",
  fecha_nacimiento: "", peso_kg: "", color_pelaje: "",
  temperamento: "tranquilo", observaciones_medicas: ""
}

// ── Input reutilizable ─────────────────────────────────────────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
const selectCls = `${inputCls} bg-white`

// ── Página ─────────────────────────────────────────────────────────────────
export default function RegistrarPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()

  const [cliente, setCliente] = useState<FormCliente>(FORM_CLIENTE_INICIAL)
  const [mascota, setMascota] = useState<FormMascota>(FORM_MASCOTA_INICIAL)
  const [agregarMascota, setAgregarMascota] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<{
    cliente: { nombre: string; apellido: string; email: string; password_temporal: string }
    mascota: { nombre: string; especie: string } | null
  } | null>(null)

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const handleRegistrar = async () => {
    if (!cliente.ci || !cliente.nombre || !cliente.apellido || !cliente.email) {
      setError("CI, nombre, apellido y email son obligatorios"); return
    }
    if (agregarMascota && (!mascota.nombre || !mascota.especie || !mascota.tamanio)) {
      setError("Completa nombre, especie y tamaño de la mascota"); return
    }

    setGuardando(true); setError("")
    try {
      const body: any = { cliente }
      if (agregarMascota) body.mascota = mascota

      const res = await fetch("/api/recepcion/registrar", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)

      setResultado({ cliente: d.cliente, mascota: d.mascota })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleNuevoRegistro = () => {
    setResultado(null)
    setCliente(FORM_CLIENTE_INICIAL)
    setMascota(FORM_MASCOTA_INICIAL)
    setAgregarMascota(false)
    setError("")
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <PawPrint className="w-10 h-10 text-teal-400 animate-bounce" />
    </div>
  )

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (resultado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
        style={{ fontFamily: "'Nunito', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border-2 border-teal-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-black text-gray-800 text-center mb-1">¡Cliente registrado!</h2>
          <p className="text-gray-500 text-sm text-center mb-5">El cliente puede acceder con estas credenciales</p>

          <div className="bg-teal-50 rounded-2xl p-4 space-y-2 mb-4">
            <p className="text-sm"><span className="font-bold text-gray-700">Nombre:</span> {resultado.cliente.nombre} {resultado.cliente.apellido}</p>
            <p className="text-sm"><span className="font-bold text-gray-700">Email:</span> {resultado.cliente.email}</p>
            <p className="text-sm flex items-center gap-2">
              <span className="font-bold text-gray-700">Contraseña temporal:</span>
              <span className="bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-lg text-sm">
                {resultado.cliente.password_temporal}
              </span>
            </p>
            <p className="text-xs text-gray-400">⚠️ La contraseña temporal es el CI del cliente. Pídele que la cambie al primer ingreso.</p>
          </div>

          {resultado.mascota && (
            <div className="bg-violet-50 rounded-2xl p-4 mb-5">
              <p className="text-sm font-bold text-gray-700 mb-1">Mascota registrada:</p>
              <p className="text-sm text-gray-600">
                {resultado.mascota.especie === "perro" ? "🐶" : resultado.mascota.especie === "gato" ? "🐱" : "🐾"} {resultado.mascota.nombre}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleNuevoRegistro}
              className="flex-1 py-2.5 border-2 border-teal-300 text-teal-700 font-bold rounded-xl text-sm hover:bg-teal-50 transition flex items-center justify-center gap-2">
              <Plus size={15} /> Otro cliente
            </button>
            <button onClick={() => router.push("/recepcion")}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition">
              Volver al panel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-teal-600 to-emerald-700 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => router.push("/recepcion")} className="text-white/70 hover:text-white transition">
            <ChevronLeft size={22} />
          </button>
          <UserPlus className="w-5 h-5 text-teal-200" />
          <span className="text-white font-black text-lg">Registrar cliente</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400">✕</button>
          </div>
        )}

        {/* ── Datos del cliente ── */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
          <h2 className="font-black text-gray-800 flex items-center gap-2">
            <Users size={18} className="text-teal-600" /> Datos del cliente
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CI / Documento" required>
              <input type="text" placeholder="Ej: 12345678"
                value={cliente.ci}
                onChange={e => setCliente(p => ({ ...p, ci: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="Teléfono">
              <input type="tel" placeholder="Ej: 70000000"
                value={cliente.telefono}
                onChange={e => setCliente(p => ({ ...p, telefono: e.target.value }))}
                className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <input type="text" placeholder="Nombre"
                value={cliente.nombre}
                onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="Apellido" required>
              <input type="text" placeholder="Apellido"
                value={cliente.apellido}
                onChange={e => setCliente(p => ({ ...p, apellido: e.target.value }))}
                className={inputCls} />
            </Field>
          </div>

          <Field label="Email" required>
            <input type="email" placeholder="correo@ejemplo.com"
              value={cliente.email}
              onChange={e => setCliente(p => ({ ...p, email: e.target.value }))}
              className={inputCls} />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cliente.acepta_notificaciones}
              onChange={e => setCliente(p => ({ ...p, acepta_notificaciones: e.target.checked }))}
              className="accent-teal-600" />
            <span className="text-sm text-gray-600 font-semibold">Acepta recibir notificaciones</span>
          </label>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            🔑 La contraseña temporal será el <strong>CI del cliente</strong>. Infórmale que debe cambiarla al primer ingreso.
          </div>
        </div>

        {/* ── Mascota (opcional) ── */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-gray-800 flex items-center gap-2">
              <PawPrint size={18} className="text-violet-600" /> Mascota
              <span className="text-gray-400 font-normal text-sm">(opcional)</span>
            </h2>
            <button
              onClick={() => setAgregarMascota(!agregarMascota)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${agregarMascota ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-gray-100 text-gray-500 border-gray-200 hover:border-violet-300"}`}
            >
              {agregarMascota ? "✓ Agregar mascota" : "+ Agregar mascota"}
            </button>
          </div>

          {agregarMascota && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" required>
                  <input type="text" placeholder="Ej: Max"
                    value={mascota.nombre}
                    onChange={e => setMascota(p => ({ ...p, nombre: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Especie" required>
                  <select value={mascota.especie}
                    onChange={e => setMascota(p => ({ ...p, especie: e.target.value }))}
                    className={selectCls}>
                    <option value="perro">🐶 Perro</option>
                    <option value="gato">🐱 Gato</option>
                    <option value="otro">🐾 Otro</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Raza">
                  <input type="text" placeholder="Ej: Labrador"
                    value={mascota.raza}
                    onChange={e => setMascota(p => ({ ...p, raza: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Tamaño" required>
                  <select value={mascota.tamanio}
                    onChange={e => setMascota(p => ({ ...p, tamanio: e.target.value }))}
                    className={selectCls}>
                    <option value="pequenio">Pequeño</option>
                    <option value="mediano">Mediano</option>
                    <option value="grande">Grande</option>
                    <option value="gigante">Gigante</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <input type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={mascota.fecha_nacimiento}
                    onChange={e => setMascota(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Peso (kg)">
                  <input type="number" min="0" step="0.1" placeholder="Ej: 8.5"
                    value={mascota.peso_kg}
                    onChange={e => setMascota(p => ({ ...p, peso_kg: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Color de pelaje">
                  <input type="text" placeholder="Ej: Dorado"
                    value={mascota.color_pelaje}
                    onChange={e => setMascota(p => ({ ...p, color_pelaje: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Temperamento">
                  <select value={mascota.temperamento}
                    onChange={e => setMascota(p => ({ ...p, temperamento: e.target.value }))}
                    className={selectCls}>
                    <option value="tranquilo">😌 Tranquilo</option>
                    <option value="nervioso">😰 Nervioso</option>
                    <option value="agresivo">😤 Agresivo</option>
                    <option value="inquieto">🐾 Inquieto</option>
                  </select>
                </Field>
              </div>

              <Field label="Alergias / observaciones médicas">
                <textarea rows={2} placeholder="Ej: Alérgico al shampoo con fragancia..."
                  value={mascota.observaciones_medicas}
                  onChange={e => setMascota(p => ({ ...p, observaciones_medicas: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </Field>
            </div>
          )}
        </div>

        {/* Botón registrar */}
        <button
          onClick={handleRegistrar}
          disabled={guardando}
          className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-700 text-white font-black rounded-2xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-base shadow-lg"
        >
          {guardando
            ? <><Loader2 size={20} className="animate-spin" /> Registrando...</>
            : <><UserPlus size={20} /> Registrar cliente</>
          }
        </button>
      </main>
    </div>
  )
}