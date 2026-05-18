"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import {
  Users, UserPlus, Shield, LogOut, Bell,
  Activity, Lock, CheckCircle, XCircle,
  PawPrint, Eye, EyeOff,
  Search, Filter, RefreshCw, ChevronLeft, ChevronRight
} from "lucide-react"

type Rol = "recepcionista" | "cajero" | "groomer" | "cliente"

interface UsuarioLista {
  id_usuario: number
  nombre: string
  apellido: string
  email: string
  rol: string
  estado: string
  fecha_registro: string
}

interface LogEntry {
  id_log: number
  accion: string
  entidad: string | null
  entidad_id: number | null
  detalle: string | null
  ip: string | null
  created_at: string
  admin_nombre: string | null
  admin_email: string | null
}

interface FormState {
  rol: Rol
  ci: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  password: string
  fecha_nacimiento: string
  fecha_contrato: string
  direccion: string
  seguro_salud: string
  asegurado: boolean
  turno_recepcion: string
  especialidad: string
  anos_experiencia: string
  certificaciones: string
  turno_cajero: string
  limite_descuento: string
}

const FORM_INICIAL: FormState = {
  rol: "recepcionista",
  ci: "", nombre: "", apellido: "", telefono: "", email: "", password: "",
  fecha_nacimiento: "", fecha_contrato: "", direccion: "",
  seguro_salud: "", asegurado: false, turno_recepcion: "mañana",
  especialidad: "", anos_experiencia: "0", certificaciones: "",
  turno_cajero: "mañana", limite_descuento: "0",
}

const ROL_COLORES: Record<string, string> = {
  admin:         "bg-purple-100 text-purple-700",
  recepcionista: "bg-teal-100 text-teal-700",
  cajero:        "bg-amber-100 text-amber-700",
  groomer:       "bg-rose-100 text-rose-700",
  cliente:       "bg-blue-100 text-blue-700",
}

const ESTADO_COLORES: Record<string, string> = {
  activo:   "bg-green-100 text-green-700",
  inactivo: "bg-gray-100 text-gray-600",
  bloqueado:"bg-red-100 text-red-700",
}

const ACCION_COLORES: Record<string, string> = {
  CREAR_USUARIO:    "bg-green-100 text-green-700",
  BLOQUEAR_USUARIO: "bg-red-100 text-red-700",
  ACTIVAR_USUARIO:  "bg-blue-100 text-blue-700",
  LOGIN:            "bg-purple-100 text-purple-700",
}

const ACCION_ICONOS: Record<string, string> = {
  CREAR_USUARIO:    "👤",
  BLOQUEAR_USUARIO: "🔒",
  ACTIVAR_USUARIO:  "✅",
  LOGIN:            "🔑",
}

const inputCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none transition-colors"
const selectCls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none bg-white transition-colors"

function Campo({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function AdminPage() {
  const { user, logout, isLoading, accessToken } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<"usuarios" | "crear" | "logs">("usuarios")

  // Estados usuarios
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([])
  const [cargando, setCargando] = useState(false)
  const [avisoTimeout, setAvisoTimeout] = useState(false)

  // Estados formulario
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [showPassword, setShowPassword] = useState(false)
  const [formMsg, setFormMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [creando, setCreando] = useState(false)

  // Estados logs
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [cargandoLogs, setCargandoLogs] = useState(false)
  const [filtroAccion, setFiltroAccion] = useState("")
  const [filtroFecha, setFiltroFecha] = useState("")
  const [filtroBuscar, setFiltroBuscar] = useState("")
  const [paginaLogs, setPaginaLogs] = useState(1)
  const [totalPaginasLogs, setTotalPaginasLogs] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || user.rol !== "admin")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (tab === "usuarios") cargarUsuarios()
    if (tab === "logs") cargarLogs(1)
  }, [tab])

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const cargarUsuarios = async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/admin/usuarios", {
        headers: { "Authorization": `Bearer ${accessToken}` },
      })
      if (res.ok) setUsuarios((await res.json()).usuarios ?? [])
    } finally {
      setCargando(false)
    }
  }

  const cargarLogs = async (pagina = 1) => {
    setCargandoLogs(true)
    try {
      const params = new URLSearchParams()
      if (filtroAccion) params.set("accion", filtroAccion)
      if (filtroFecha)  params.set("fecha", filtroFecha)
      if (filtroBuscar) params.set("buscar", filtroBuscar)
      params.set("pagina", String(pagina))

      const res = await fetch(`/api/admin/logs?${params}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
        setTotalPaginasLogs(data.totalPaginas ?? 1)
        setTotalLogs(data.total ?? 0)
        setPaginaLogs(pagina)
      }
    } finally {
      setCargandoLogs(false)
    }
  }

  const crearCuenta = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormMsg(null)
    setCreando(true)
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setFormMsg({ tipo: "ok", texto: `Cuenta de ${form.rol} creada exitosamente.` })
        setForm(FORM_INICIAL)
      } else {
        setFormMsg({ tipo: "error", texto: data.message || "Error al crear la cuenta." })
      }
    } catch {
      setFormMsg({ tipo: "error", texto: "Error de conexión." })
    } finally {
      setCreando(false)
    }
  }

  const cambiarEstado = async (id: number, estado: string) => {
    const nuevoEstado = estado === "activo" ? "bloqueado" : "activo"
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    cargarUsuarios()
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <PawPrint className="w-10 h-10 text-purple-400 animate-bounce" />
      </div>
    )
  }

  const esTrabajador = form.rol !== "cliente"

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {/* Aviso inactividad */}
      {avisoTimeout && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18} />
          <span className="font-semibold text-sm">Tu sesión cerrará en 1 minuto por inactividad.</span>
          <button onClick={() => setAvisoTimeout(false)} className="ml-2 underline text-sm">Continuar</button>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-gradient-to-r from-purple-800 to-violet-900 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-white" />
            <span className="text-white font-black text-lg">Panel <span className="text-purple-300">Admin</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-400 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                {user.nombre.charAt(0)}
              </div>
              <span className="text-white text-sm font-semibold">{user.nombre}</span>
              <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">Admin</span>
            </div>
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 w-fit">
          {([
            { key: "usuarios", icon: Users,    label: "Usuarios" },
            { key: "crear",    icon: UserPlus,  label: "Crear cuenta" },
            { key: "logs",     icon: Activity,  label: "Logs" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === key ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* ── TAB USUARIOS ── */}
        {tab === "usuarios" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-gray-800">Todos los usuarios</h2>
              <button onClick={cargarUsuarios} className="text-sm text-purple-600 hover:underline">Actualizar</button>
            </div>
            {cargando ? (
              <div className="p-8 text-center text-gray-400">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      {["Nombre", "Email", "Rol", "Estado", "Registro", "Acciones"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {usuarios.map((u) => (
                      <tr key={u.id_usuario} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.nombre} {u.apellido}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_COLORES[u.rol] ?? "bg-gray-100 text-gray-600"}`}>
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLORES[u.estado] ?? ""}`}>
                            {u.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(u.fecha_registro).toLocaleDateString("es-BO")}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => cambiarEstado(u.id_usuario, u.estado)}
                            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              u.estado === "activo"
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}>
                            {u.estado === "activo" ? <><Lock size={12}/> Bloquear</> : <><CheckCircle size={12}/> Activar</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay usuarios registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CREAR CUENTA ── */}
        {tab === "crear" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-2xl">
            <h2 className="font-black text-gray-800 mb-1">Crear cuenta de personal</h2>
            <p className="text-sm text-gray-400 mb-6">Los campos cambian según el rol seleccionado.</p>

            {formMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl mb-5 text-sm font-medium ${
                formMsg.tipo === "ok"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {formMsg.tipo === "ok" ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                {formMsg.texto}
              </div>
            )}

            <form onSubmit={crearCuenta} className="space-y-5">
              <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3">Tipo de cuenta</p>
                <Campo label="Rol" required>
                  <select value={form.rol} onChange={e => set("rol", e.target.value as Rol)} className={selectCls}>
                    <option value="recepcionista">Recepcionista</option>
                    <option value="cajero">Cajero</option>
                    <option value="groomer">Groomer</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </Campo>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos personales</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nombre" required>
                    <input value={form.nombre} onChange={e => set("nombre", e.target.value)} className={inputCls} required />
                  </Campo>
                  <Campo label="Apellido" required>
                    <input value={form.apellido} onChange={e => set("apellido", e.target.value)} className={inputCls} required />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Cédula de Identidad (CI)" required>
                    <input value={form.ci} onChange={e => set("ci", e.target.value)} className={inputCls} required />
                  </Campo>
                  <Campo label="Teléfono">
                    <input value={form.telefono} onChange={e => set("telefono", e.target.value)} className={inputCls} />
                  </Campo>
                </div>
                <Campo label="Correo electrónico" required>
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} required />
                </Campo>
                <Campo label="Contraseña temporal" required>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => set("password", e.target.value)}
                      className={`${inputCls} pr-10`}
                      required minLength={8}
                    />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </Campo>
              </div>

              {esTrabajador && (
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-4">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Datos laborales</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Fecha de nacimiento">
                      <input type="date" value={form.fecha_nacimiento} onChange={e => set("fecha_nacimiento", e.target.value)} className={inputCls} />
                    </Campo>
                    <Campo label="Fecha de contrato" required>
                      <input type="date" value={form.fecha_contrato} onChange={e => set("fecha_contrato", e.target.value)} className={inputCls} required />
                    </Campo>
                  </div>
                  <Campo label="Dirección" required>
                    <input value={form.direccion} onChange={e => set("direccion", e.target.value)} className={inputCls} required placeholder="Calle, número, zona..." />
                  </Campo>
                </div>
              )}

              {form.rol === "recepcionista" && (
                <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 space-y-4">
                  <p className="text-xs font-bold text-teal-600 uppercase tracking-wider">Datos de recepcionista</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Seguro de salud">
                      <input value={form.seguro_salud} onChange={e => set("seguro_salud", e.target.value)} className={inputCls} placeholder="Ej: COSSMIL, CNS..." />
                    </Campo>
                    <Campo label="Turno" required>
                      <select value={form.turno_recepcion} onChange={e => set("turno_recepcion", e.target.value)} className={selectCls}>
                        <option value="mañana">Mañana</option>
                        <option value="tarde">Tarde</option>
                        <option value="noche">Noche</option>
                      </select>
                    </Campo>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.asegurado} onChange={e => set("asegurado", e.target.checked)} className="w-4 h-4 rounded accent-teal-600" />
                    <span className="text-sm text-gray-600 font-medium">Tiene seguro de salud activo</span>
                  </label>
                </div>
              )}

              {form.rol === "groomer" && (
                <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 space-y-4">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Datos de groomer</p>
                  <Campo label="Especialidad" required>
                    <input value={form.especialidad} onChange={e => set("especialidad", e.target.value)} className={inputCls} required placeholder="Ej: Corte canino, Baño especializado..." />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Años de experiencia">
                      <input type="number" min="0" value={form.anos_experiencia} onChange={e => set("anos_experiencia", e.target.value)} className={inputCls} />
                    </Campo>
                    <Campo label="Certificaciones">
                      <input value={form.certificaciones} onChange={e => set("certificaciones", e.target.value)} className={inputCls} placeholder="Ej: Curso internacional..." />
                    </Campo>
                  </div>
                </div>
              )}

              {form.rol === "cajero" && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-4">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Datos de cajero</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Turno" required>
                      <select value={form.turno_cajero} onChange={e => set("turno_cajero", e.target.value)} className={selectCls}>
                        <option value="mañana">Mañana</option>
                        <option value="tarde">Tarde</option>
                      </select>
                    </Campo>
                    <Campo label="Límite de descuento (%)">
                      <input type="number" min="0" max="100" step="0.01" value={form.limite_descuento} onChange={e => set("limite_descuento", e.target.value)} className={inputCls} placeholder="0.00" />
                    </Campo>
                  </div>
                </div>
              )}

              <button type="submit" disabled={creando}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                <UserPlus size={18}/>
                {creando ? "Creando cuenta..." : `Crear cuenta de ${form.rol}`}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB LOGS ── */}
        {tab === "logs" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Header con filtros */}
            <div className="px-6 py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-gray-800">Logs del sistema</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{totalLogs} registros encontrados</p>
                </div>
                <button
                  onClick={() => cargarLogs(1)}
                  className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-semibold"
                >
                  <RefreshCw size={14} /> Actualizar
                </button>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={filtroBuscar}
                    onChange={e => setFiltroBuscar(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && cargarLogs(1)}
                    placeholder="Buscar en detalle..."
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none w-52"
                  />
                </div>
                <select
                  value={filtroAccion}
                  onChange={e => { setFiltroAccion(e.target.value); cargarLogs(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-purple-400 focus:outline-none bg-white"
                >
                  <option value="">Todas las acciones</option>
                  <option value="CREAR_USUARIO">Crear usuario</option>
                  <option value="BLOQUEAR_USUARIO">Bloquear usuario</option>
                  <option value="ACTIVAR_USUARIO">Activar usuario</option>
                  <option value="LOGIN">Login</option>
                </select>
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={e => { setFiltroFecha(e.target.value); cargarLogs(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                />
                {(filtroAccion || filtroFecha || filtroBuscar) && (
                  <button
                    onClick={() => { setFiltroAccion(""); setFiltroFecha(""); setFiltroBuscar(""); cargarLogs(1) }}
                    className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <Filter size={14} /> Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Tabla */}
            {cargandoLogs ? (
              <div className="p-8 text-center text-gray-400">Cargando logs...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        {["Acción", "Detalle", "Admin", "IP", "Fecha y hora"].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.map((log) => (
                        <tr key={log.id_log} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ACCION_COLORES[log.accion] ?? "bg-gray-100 text-gray-600"}`}>
                              <span>{ACCION_ICONOS[log.accion] ?? "📋"}</span>
                              {log.accion.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">
                            <p className="truncate">{log.detalle ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-700 text-xs">{log.admin_nombre ?? "Sistema"}</p>
                            <p className="text-gray-400 text-xs">{log.admin_email ?? ""}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ip ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            <p>{new Date(log.created_at).toLocaleDateString("es-BO")}</p>
                            <p>{new Date(log.created_at).toLocaleTimeString("es-BO")}</p>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <Activity className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No hay logs registrados</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPaginasLogs > 1 && (
                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Página {paginaLogs} de {totalPaginasLogs}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => cargarLogs(paginaLogs - 1)}
                        disabled={paginaLogs === 1}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={14} /> Anterior
                      </button>
                      <button
                        onClick={() => cargarLogs(paginaLogs + 1)}
                        disabled={paginaLogs >= totalPaginasLogs}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Siguiente <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>
    </div>
  )
}