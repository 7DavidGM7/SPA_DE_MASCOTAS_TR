"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import {
  Users, UserPlus, Shield, LogOut, Bell,
  Activity, Lock, CheckCircle, XCircle,
  PawPrint, Eye, EyeOff,
  Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  Calendar, Clock, Scissors, Save, Plus, Trash2, AlertCircle, Loader2,
  BarChart3, TrendingUp, PieChart, FileText, Star, Download
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
  const [tab, setTab] = useState<"usuarios" | "crear" | "logs" | "agenda" | "reportes">("usuarios")
  const [avisoTimeout, setAvisoTimeout] = useState(false)

  // ── Estados usuarios ──────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([])
  const [cargando, setCargando] = useState(false)

  // ── Estados formulario ────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [showPassword, setShowPassword] = useState(false)
  const [formMsg, setFormMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
  const [creando, setCreando] = useState(false)

  // ── Estados logs ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [cargandoLogs, setCargandoLogs] = useState(false)
  const [filtroAccion, setFiltroAccion] = useState("")
  const [filtroFecha, setFiltroFecha] = useState("")
  const [filtroBuscar, setFiltroBuscar] = useState("")
  const [paginaLogs, setPaginaLogs] = useState(1)
  const [totalPaginasLogs, setTotalPaginasLogs] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)

  // ── Estados agenda ────────────────────────────────────────────────────────
  const [horario, setHorario]             = useState<any[]>([])
  const [groomers, setGroomers]           = useState<any[]>([])
  const [disponibilidades, setDisponibilidades] = useState<any[]>([])
  const [bloqueos, setBloqueos]           = useState<any[]>([])
  const [cargandoAgenda, setCargandoAgenda] = useState(false)
  const [guardandoAgenda, setGuardandoAgenda] = useState(false)
  const [exitoAgenda, setExitoAgenda]     = useState("")
  const [errorAgenda, setErrorAgenda]     = useState("")
  const [horarioEdit, setHorarioEdit]     = useState<Record<number, any>>({})
  const [formBloqueo, setFormBloqueo]     = useState({ fecha:"", hora_inicio:"", hora_fin:"", motivo:"mantenimiento", descripcion:"" })
  const [formDisp, setFormDisp]           = useState({ id_trabajador:"", dia_semana:"1", hora_inicio:"09:00", hora_fin:"18:00" })

  const DIAS       = ["","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

  // ── Estado reportes ───────────────────────────────────────────────────
  const [tipoReporte, setTipoReporte] = useState<"ventas"|"rentabilidad"|"ocupacion"|"insumos"|"nps">("ventas")
  const [reporteDesde, setReporteDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]
  })
  const [reporteHasta, setReporteHasta] = useState(new Date().toISOString().split("T")[0])
  const [reporteData, setReporteData] = useState<any>(null)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [errorReporte, setErrorReporte] = useState("")
  const DIAS_SHORT = ["","Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || user.rol !== "admin")) router.replace("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (tab === "usuarios") cargarUsuarios()
    if (tab === "logs")     cargarLogs(1)
    if (tab === "agenda")   cargarAgenda()
    if (tab === "reportes") cargarReporte()
  }, [tab])

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const authH = () => ({ "Authorization": `Bearer ${accessToken}` })
  const jsonH = () => ({ "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` })

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const cargarUsuarios = async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/admin/usuarios", { headers: authH() })
      if (res.ok) setUsuarios((await res.json()).usuarios ?? [])
    } finally { setCargando(false) }
  }

  const cambiarEstado = async (id: number, estado: string) => {
    const nuevoEstado = estado === "activo" ? "bloqueado" : "activo"
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: jsonH(),
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    cargarUsuarios()
  }

  // ── Logs ──────────────────────────────────────────────────────────────────
  const cargarLogs = async (pagina = 1) => {
    setCargandoLogs(true)
    try {
      const params = new URLSearchParams()
      if (filtroAccion) params.set("accion", filtroAccion)
      if (filtroFecha)  params.set("fecha", filtroFecha)
      if (filtroBuscar) params.set("buscar", filtroBuscar)
      params.set("pagina", String(pagina))
      const res = await fetch(`/api/admin/logs?${params}`, { headers: authH() })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
        setTotalPaginasLogs(data.totalPaginas ?? 1)
        setTotalLogs(data.total ?? 0)
        setPaginaLogs(pagina)
      }
    } finally { setCargandoLogs(false) }
  }

  const crearCuenta = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormMsg(null); setCreando(true)
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST", headers: jsonH(), body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) { setFormMsg({ tipo: "ok", texto: `Cuenta de ${form.rol} creada exitosamente.` }); setForm(FORM_INICIAL) }
      else setFormMsg({ tipo: "error", texto: data.message || "Error al crear la cuenta." })
    } catch { setFormMsg({ tipo: "error", texto: "Error de conexión." }) }
    finally { setCreando(false) }
  }

  // ── Agenda ────────────────────────────────────────────────────────────────
  const cargarReporte = async () => {
    setCargandoReporte(true); setErrorReporte(""); setReporteData(null)
    try {
      const params = new URLSearchParams({ tipo: tipoReporte, desde: reporteDesde, hasta: reporteHasta })
      const res = await fetch(`/api/admin/reportes?${params}`, { headers: authH() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setReporteData(d)
    } catch (e: any) { setErrorReporte(e.message || "Error al generar reporte") }
    finally { setCargandoReporte(false) }
  }

  const mostrarExitoAgenda = (msg: string) => { setExitoAgenda(msg); setTimeout(() => setExitoAgenda(""), 3000) }

  const cargarAgenda = async () => {
    setCargandoAgenda(true); setErrorAgenda("")
    try {
      const [r1,r2,r3,r4] = await Promise.all([
        fetch("/api/admin/horario",        { headers: authH() }),
        fetch("/api/groomers",             { headers: authH() }),
        fetch("/api/admin/disponibilidad", { headers: authH() }),
        fetch("/api/admin/bloqueos",       { headers: authH() }),
      ])
      const [d1,d2,d3,d4] = await Promise.all([r1.json(),r2.json(),r3.json(),r4.json()])
      setHorario(d1.horario || [])
      setGroomers(d2.groomers || [])
      setDisponibilidades(d3.disponibilidades || [])
      setBloqueos(d4.bloqueos || [])
      setHorarioEdit({})
    } catch { setErrorAgenda("Error al cargar datos de agenda") }
    finally { setCargandoAgenda(false) }
  }

  const guardarHorarioDia = async (dia: any) => {
    const val = { ...dia, ...(horarioEdit[dia.dia_semana]||{}) }
    setGuardandoAgenda(true)
    try {
      const res = await fetch("/api/admin/horario", {
        method: "POST", headers: jsonH(),
        body: JSON.stringify({ dia_semana:val.dia_semana, hora_inicio:val.hora_inicio, hora_fin:val.hora_fin, capacidad_max:Number(val.capacidad_max), activo:val.activo }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExitoAgenda(`Horario del ${DIAS[dia.dia_semana]} actualizado`)
      setHorarioEdit(prev => { const n={...prev}; delete n[dia.dia_semana]; return n })
      cargarAgenda()
    } catch (e:any) { setErrorAgenda(e.message) }
    finally { setGuardandoAgenda(false) }
  }

  const crearDisponibilidad = async () => {
    if (!formDisp.id_trabajador) { setErrorAgenda("Selecciona un groomer"); return }
    setGuardandoAgenda(true)
    try {
      const res = await fetch("/api/admin/disponibilidad", {
        method: "POST", headers: jsonH(),
        body: JSON.stringify({ id_trabajador:Number(formDisp.id_trabajador), dia_semana:Number(formDisp.dia_semana), hora_inicio:formDisp.hora_inicio, hora_fin:formDisp.hora_fin }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExitoAgenda("Horario asignado al groomer")
      setFormDisp({ id_trabajador:"", dia_semana:"1", hora_inicio:"09:00", hora_fin:"18:00" })
      cargarAgenda()
    } catch (e:any) { setErrorAgenda(e.message) }
    finally { setGuardandoAgenda(false) }
  }

  const eliminarDisponibilidad = async (id: number) => {
    if (!confirm("¿Eliminar este horario?")) return
    try {
      await fetch(`/api/admin/disponibilidad/${id}`, { method:"DELETE", headers: authH() })
      mostrarExitoAgenda("Horario eliminado"); cargarAgenda()
    } catch { setErrorAgenda("Error al eliminar") }
  }

  const crearBloqueo = async () => {
    if (!formBloqueo.fecha) { setErrorAgenda("La fecha es requerida"); return }
    setGuardandoAgenda(true)
    try {
      const res = await fetch("/api/admin/bloqueos", {
        method: "POST", headers: jsonH(),
        body: JSON.stringify({ ...formBloqueo, hora_inicio:formBloqueo.hora_inicio||null, hora_fin:formBloqueo.hora_fin||null }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExitoAgenda("Bloqueo registrado")
      setFormBloqueo({ fecha:"", hora_inicio:"", hora_fin:"", motivo:"mantenimiento", descripcion:"" })
      cargarAgenda()
    } catch (e:any) { setErrorAgenda(e.message) }
    finally { setGuardandoAgenda(false) }
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
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 w-fit flex-wrap">
          {([
            { key: "usuarios", icon: Users,    label: "Usuarios" },
            { key: "crear",    icon: UserPlus,  label: "Crear cuenta" },
            { key: "logs",     icon: Activity,  label: "Logs" },
            { key: "agenda",   icon: Calendar,  label: "Agenda" },
            { key: "reportes", icon: BarChart3,  label: "Reportes" },
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
                formMsg.tipo === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
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
                  <Campo label="Nombre" required><input value={form.nombre} onChange={e => set("nombre", e.target.value)} className={inputCls} required /></Campo>
                  <Campo label="Apellido" required><input value={form.apellido} onChange={e => set("apellido", e.target.value)} className={inputCls} required /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Cédula de Identidad (CI)" required><input value={form.ci} onChange={e => set("ci", e.target.value)} className={inputCls} required /></Campo>
                  <Campo label="Teléfono"><input value={form.telefono} onChange={e => set("telefono", e.target.value)} className={inputCls} /></Campo>
                </div>
                <Campo label="Correo electrónico" required><input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} required /></Campo>
                <Campo label="Contraseña temporal" required>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} className={`${inputCls} pr-10`} required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </Campo>
              </div>
              {esTrabajador && (
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-4">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Datos laborales</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Fecha de nacimiento"><input type="date" value={form.fecha_nacimiento} onChange={e => set("fecha_nacimiento", e.target.value)} className={inputCls} /></Campo>
                    <Campo label="Fecha de contrato" required><input type="date" value={form.fecha_contrato} onChange={e => set("fecha_contrato", e.target.value)} className={inputCls} required /></Campo>
                  </div>
                  <Campo label="Dirección" required><input value={form.direccion} onChange={e => set("direccion", e.target.value)} className={inputCls} required placeholder="Calle, número, zona..." /></Campo>
                </div>
              )}
              {form.rol === "recepcionista" && (
                <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 space-y-4">
                  <p className="text-xs font-bold text-teal-600 uppercase tracking-wider">Datos de recepcionista</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Seguro de salud"><input value={form.seguro_salud} onChange={e => set("seguro_salud", e.target.value)} className={inputCls} placeholder="Ej: COSSMIL, CNS..." /></Campo>
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
                  <Campo label="Especialidad" required><input value={form.especialidad} onChange={e => set("especialidad", e.target.value)} className={inputCls} required placeholder="Ej: Corte canino, Baño especializado..." /></Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Años de experiencia"><input type="number" min="0" value={form.anos_experiencia} onChange={e => set("anos_experiencia", e.target.value)} className={inputCls} /></Campo>
                    <Campo label="Certificaciones"><input value={form.certificaciones} onChange={e => set("certificaciones", e.target.value)} className={inputCls} placeholder="Ej: Curso internacional..." /></Campo>
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
                    <Campo label="Límite de descuento (%)"><input type="number" min="0" max="100" step="0.01" value={form.limite_descuento} onChange={e => set("limite_descuento", e.target.value)} className={inputCls} placeholder="0.00" /></Campo>
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
            <div className="px-6 py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-gray-800">Logs del sistema</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{totalLogs} registros encontrados</p>
                </div>
                <button onClick={() => cargarLogs(1)} className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-semibold">
                  <RefreshCw size={14} /> Actualizar
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={filtroBuscar} onChange={e => setFiltroBuscar(e.target.value)} onKeyDown={e => e.key === "Enter" && cargarLogs(1)}
                    placeholder="Buscar en detalle..." className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none w-52" />
                </div>
                <select value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); cargarLogs(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-purple-400 focus:outline-none bg-white">
                  <option value="">Todas las acciones</option>
                  <option value="CREAR_USUARIO">Crear usuario</option>
                  <option value="BLOQUEAR_USUARIO">Bloquear usuario</option>
                  <option value="ACTIVAR_USUARIO">Activar usuario</option>
                  <option value="LOGIN">Login</option>
                </select>
                <input type="date" value={filtroFecha} onChange={e => { setFiltroFecha(e.target.value); cargarLogs(1) }}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" />
                {(filtroAccion || filtroFecha || filtroBuscar) && (
                  <button onClick={() => { setFiltroAccion(""); setFiltroFecha(""); setFiltroBuscar(""); cargarLogs(1) }}
                    className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Filter size={14} /> Limpiar
                  </button>
                )}
              </div>
            </div>
            {cargandoLogs ? (
              <div className="p-8 text-center text-gray-400">Cargando logs...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>{["Acción","Detalle","Admin","IP","Fecha y hora"].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.map(log => (
                        <tr key={log.id_log} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ACCION_COLORES[log.accion] ?? "bg-gray-100 text-gray-600"}`}>
                              {ACCION_ICONOS[log.accion] ?? "📋"} {log.accion.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs"><p className="truncate">{log.detalle ?? "—"}</p></td>
                          <td className="px-4 py-3"><p className="font-medium text-gray-700 text-xs">{log.admin_nombre ?? "Sistema"}</p><p className="text-gray-400 text-xs">{log.admin_email ?? ""}</p></td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ip ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            <p>{new Date(log.created_at).toLocaleDateString("es-BO")}</p>
                            <p>{new Date(log.created_at).toLocaleTimeString("es-BO")}</p>
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-12 text-center"><Activity className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">No hay logs registrados</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPaginasLogs > 1 && (
                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400">Página {paginaLogs} de {totalPaginasLogs}</p>
                    <div className="flex gap-2">
                      <button onClick={() => cargarLogs(paginaLogs - 1)} disabled={paginaLogs === 1}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft size={14} /> Anterior
                      </button>
                      <button onClick={() => cargarLogs(paginaLogs + 1)} disabled={paginaLogs >= totalPaginasLogs}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        Siguiente <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB AGENDA ── */}
        {tab === "agenda" && (
          <div className="space-y-6">
            {errorAgenda && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16}/>{errorAgenda}
                <button onClick={()=>setErrorAgenda("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
            {exitoAgenda && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2">
                <CheckCircle size={16}/>{exitoAgenda}
              </div>
            )}

            {cargandoAgenda ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-purple-500" size={28}/></div>
            ) : (<>

              {/* HORARIO LABORAL */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2"><Clock size={18} className="text-purple-600"/>Horario laboral del spa</h3>
                <p className="text-xs text-gray-400 mb-4">Activa sábados o domingos para casos excepcionales. Define horarios y capacidad máxima de servicios por día.</p>
                <div className="space-y-3">
                  {horario.map(dia => {
                    const edit = horarioEdit[dia.dia_semana] || {}
                    const val  = { ...dia, ...edit }
                    const mod  = Object.keys(edit).length > 0
                    const esFinde = dia.dia_semana >= 6
                    return (
                      <div key={dia.dia_semana} className={`rounded-xl border-2 p-4 transition-all ${mod ? "border-purple-300 bg-purple-50" : esFinde ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`w-12 h-8 rounded-lg flex items-center justify-center text-xs font-black ${val.activo ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                            {DIAS_SHORT[dia.dia_semana]}
                          </span>
                          <span className="font-bold text-gray-800">{DIAS[dia.dia_semana]}</span>
                          {esFinde && <span className="text-[10px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold">Fin de semana</span>}
                          <button
                            onClick={() => setHorarioEdit(prev => ({ ...prev, [dia.dia_semana]: { ...(prev[dia.dia_semana]||{}), activo: !val.activo } }))}
                            className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold border-2 transition ${val.activo ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200 hover:border-purple-300"}`}>
                            {val.activo ? "✓ Abierto" : "✗ Cerrado"}
                          </button>
                        </div>
                        {val.activo && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1">Apertura</label>
                              <input type="time" value={String(val.hora_inicio).slice(0,5)}
                                onChange={e => setHorarioEdit(prev => ({ ...prev, [dia.dia_semana]: { ...(prev[dia.dia_semana]||{}), hora_inicio: e.target.value } }))}
                                className="w-full px-2 py-1.5 rounded-lg border-2 border-gray-200 focus:border-purple-400 outline-none text-sm"/>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1">Cierre</label>
                              <input type="time" value={String(val.hora_fin).slice(0,5)}
                                onChange={e => setHorarioEdit(prev => ({ ...prev, [dia.dia_semana]: { ...(prev[dia.dia_semana]||{}), hora_fin: e.target.value } }))}
                                className="w-full px-2 py-1.5 rounded-lg border-2 border-gray-200 focus:border-purple-400 outline-none text-sm"/>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 mb-1">Máx. servicios/día</label>
                              <input type="number" min={1} max={30} value={val.capacidad_max}
                                onChange={e => setHorarioEdit(prev => ({ ...prev, [dia.dia_semana]: { ...(prev[dia.dia_semana]||{}), capacidad_max: Number(e.target.value) } }))}
                                className="w-full px-2 py-1.5 rounded-lg border-2 border-gray-200 focus:border-purple-400 outline-none text-sm"/>
                            </div>
                          </div>
                        )}
                        {mod && (
                          <button onClick={() => guardarHorarioDia(dia)} disabled={guardandoAgenda}
                            className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                            {guardandoAgenda ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar {DIAS[dia.dia_semana]}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* DISPONIBILIDAD GROOMERS */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2"><Scissors size={18} className="text-rose-500"/>Horarios de groomers</h3>
                <p className="text-xs text-gray-400 mb-4">Define qué días y horarios trabaja cada groomer.</p>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Groomer</label>
                      <select value={formDisp.id_trabajador} onChange={e => setFormDisp(p => ({...p, id_trabajador: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                        <option value="">Selecciona groomer</option>
                        {groomers.map(g => <option key={g.id_trabajador} value={g.id_trabajador}>{g.nombre} {g.apellido}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Día</label>
                      <select value={formDisp.dia_semana} onChange={e => setFormDisp(p => ({...p, dia_semana: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm bg-white">
                        {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{DIAS[d]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Hora inicio</label>
                      <input type="time" value={formDisp.hora_inicio} onChange={e => setFormDisp(p => ({...p, hora_inicio: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm"/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Hora fin</label>
                      <input type="time" value={formDisp.hora_fin} onChange={e => setFormDisp(p => ({...p, hora_fin: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-400 outline-none text-sm"/>
                    </div>
                  </div>
                  <button onClick={crearDisponibilidad} disabled={guardandoAgenda || !formDisp.id_trabajador}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition">
                    {guardandoAgenda ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Asignar horario
                  </button>
                </div>
                {groomers.map(g => {
                  const disps = disponibilidades.filter((d:any) => d.id_trabajador === g.id_trabajador)
                  if (!disps.length) return null
                  return (
                    <div key={g.id_trabajador} className="mb-3 border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                        <Scissors size={13} className="text-rose-400"/>
                        <span className="font-bold text-gray-700 text-sm">{g.nombre} {g.apellido}</span>
                        <span className="text-xs text-gray-400">— {g.especialidad}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {disps.map((d:any) => (
                          <div key={d.id_disponibilidad} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="w-10 text-xs font-black text-purple-600">{DIAS_SHORT[d.dia_semana]}</span>
                              <span className="text-sm text-gray-700">{String(d.hora_inicio).slice(0,5)} — {String(d.hora_fin).slice(0,5)}</span>
                            </div>
                            <button onClick={() => eliminarDisponibilidad(d.id_disponibilidad)}
                              className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition"><Trash2 size={14}/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {disponibilidades.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">Sin horarios asignados a groomers</div>
                )}
              </div>

              {/* BLOQUEOS */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-black text-gray-800 mb-1 flex items-center gap-2"><Lock size={18} className="text-orange-500"/>Bloqueos de horario</h3>
                <p className="text-xs text-gray-400 mb-4">Cierra días o franjas horarias por feriados, mantenimiento o emergencias.</p>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Fecha *</label>
                      <input type="date" value={formBloqueo.fecha} onChange={e => setFormBloqueo(p => ({...p, fecha: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Motivo *</label>
                      <select value={formBloqueo.motivo} onChange={e => setFormBloqueo(p => ({...p, motivo: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm bg-white">
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="ausencia">Ausencia</option>
                        <option value="emergencia">Emergencia</option>
                        <option value="feriado">Feriado</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Hora inicio <span className="font-normal text-gray-300">(vacío = día completo)</span></label>
                      <input type="time" value={formBloqueo.hora_inicio} onChange={e => setFormBloqueo(p => ({...p, hora_inicio: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">Hora fin</label>
                      <input type="time" value={formBloqueo.hora_fin} onChange={e => setFormBloqueo(p => ({...p, hora_fin: e.target.value}))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"/>
                    </div>
                  </div>
                  <input type="text" placeholder="Descripción opcional" value={formBloqueo.descripcion}
                    onChange={e => setFormBloqueo(p => ({...p, descripcion: e.target.value}))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none text-sm"/>
                  <button onClick={crearBloqueo} disabled={guardandoAgenda || !formBloqueo.fecha}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition">
                    {guardandoAgenda ? <Loader2 size={14} className="animate-spin"/> : <Lock size={14}/>} Crear bloqueo
                  </button>
                </div>
                <div className="space-y-2">
                  {bloqueos.length === 0
                    ? <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">Sin bloqueos activos</div>
                    : bloqueos.map((b:any) => (
                      <div key={b.id_bloqueo} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                        <div>
                          <p className="font-bold text-gray-800 text-sm capitalize">{b.motivo}
                            {b.descripcion && <span className="text-gray-400 font-normal text-xs ml-2">— {b.descripcion}</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(b.fecha+"T00:00:00").toLocaleDateString("es-BO",{weekday:"short",day:"numeric",month:"short"})}
                            {b.hora_inicio ? ` · ${String(b.hora_inicio).slice(0,5)} – ${String(b.hora_fin).slice(0,5)}` : " · Día completo"}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-orange-200 text-orange-700 rounded-full capitalize">{b.motivo}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </>)}
          </div>
        )}


        {/* ── TAB REPORTES ── */}
        {tab === "reportes" && (
          <div className="space-y-5">

            {/* Selector tipo + fechas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-600"/> Reportes del sistema
              </h3>

              {/* Selector tipo */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                {[
                  { key:"ventas",        icon:"💰", label:"Ventas" },
                  { key:"rentabilidad",  icon:"📈", label:"Rentabilidad" },
                  { key:"ocupacion",     icon:"📅", label:"Ocupación" },
                  { key:"insumos",       icon:"🧴", label:"Insumos" },
                  { key:"nps",           icon:"⭐", label:"NPS" },
                ].map(t => (
                  <button key={t.key}
                    onClick={() => setTipoReporte(t.key as any)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${tipoReporte === t.key ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300"}`}>
                    <span className="text-xl">{t.icon}</span>
                    <span className={`text-xs font-bold ${tipoReporte === t.key ? "text-purple-700" : "text-gray-600"}`}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Rango fechas */}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Desde</label>
                  <input type="date" value={reporteDesde} onChange={e => setReporteDesde(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 focus:border-purple-400 rounded-xl outline-none text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Hasta</label>
                  <input type="date" value={reporteHasta} onChange={e => setReporteHasta(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="px-3 py-2 border-2 border-gray-200 focus:border-purple-400 rounded-xl outline-none text-sm"/>
                </div>
                <button onClick={cargarReporte} disabled={cargandoReporte}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition">
                  {cargandoReporte ? <Loader2 size={15} className="animate-spin"/> : <BarChart3 size={15}/>}
                  Generar reporte
                </button>
                {/* Accesos rápidos */}
                <div className="flex gap-2 ml-auto">
                  {[
                    { label:"Hoy",      desde: new Date().toISOString().split("T")[0], hasta: new Date().toISOString().split("T")[0] },
                    { label:"Esta semana", desde: (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().split("T")[0] })(), hasta: new Date().toISOString().split("T")[0] },
                    { label:"Este mes", desde: (() => { const d=new Date(); d.setDate(1); return d.toISOString().split("T")[0] })(), hasta: new Date().toISOString().split("T")[0] },
                  ].map(r => (
                    <button key={r.label}
                      onClick={() => { setReporteDesde(r.desde); setReporteHasta(r.hasta) }}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-purple-300 hover:text-purple-600 font-semibold transition">
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {errorReporte && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16}/>{errorReporte}
              </div>
            )}

            {cargandoReporte && (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-purple-500" size={28}/></div>
            )}

            {/* ── Resultado: VENTAS ── */}
            {reporteData?.tipo === "ventas" && (
              <div className="space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label:"Total servicios",  val:`Bs. ${Number(reporteData.resumen.total_servicios).toFixed(2)}`,  color:"bg-green-50 text-green-700 border-green-200" },
                    { label:"Nro. cobros",       val:reporteData.resumen.cantidad_servicios,                           color:"bg-teal-50 text-teal-700 border-teal-200" },
                    { label:"Total productos",   val:`Bs. ${Number(reporteData.resumen.total_productos).toFixed(2)}`,  color:"bg-blue-50 text-blue-700 border-blue-200" },
                    { label:"TOTAL GENERAL",     val:`Bs. ${Number(reporteData.resumen.total_general).toFixed(2)}`,    color:"bg-purple-100 text-purple-800 border-purple-300" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`border-2 ${color} rounded-2xl p-4`}>
                      <p className="text-xs font-bold opacity-70 mb-1">{label}</p>
                      <p className="text-xl font-black">{val}</p>
                    </div>
                  ))}
                </div>
                {/* Por método de pago */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm">Por método de pago</h4>
                  {reporteData.por_metodo.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Sin datos en este período</p>
                    : <div className="space-y-2">
                        {reporteData.por_metodo.map((m: any) => (
                          <div key={m.metodo_pago} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{m.metodo_pago==="qr"?"📱":m.metodo_pago==="efectivo"?"💵":m.metodo_pago==="transferencia"?"🏦":"💳"}</span>
                              <span className="font-semibold text-gray-700 capitalize text-sm">{m.metodo_pago.replace("_"," ")}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-gray-800">Bs. {Number(m.total).toFixed(2)}</p>
                              <p className="text-xs text-gray-400">{m.cantidad} cobros</p>
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            )}

            {/* ── Resultado: RENTABILIDAD ── */}
            {reporteData?.tipo === "rentabilidad" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm flex items-center gap-2"><TrendingUp size={15} className="text-green-600"/> Top servicios</h4>
                  {reporteData.servicios.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
                    : reporteData.servicios.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i===0?"bg-amber-400 text-white":i===1?"bg-gray-300 text-gray-700":i===2?"bg-orange-300 text-white":"bg-gray-100 text-gray-500"}`}>{i+1}</span>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{s.nombre}</p>
                            <p className="text-xs text-gray-400">{s.veces_vendido} veces</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-green-700">Bs. {Number(s.ingresos_total).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Prom: Bs. {Number(s.precio_promedio).toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm flex items-center gap-2"><TrendingUp size={15} className="text-blue-600"/> Top productos</h4>
                  {reporteData.productos.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
                    : reporteData.productos.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i===0?"bg-amber-400 text-white":i===1?"bg-gray-300 text-gray-700":i===2?"bg-orange-300 text-white":"bg-gray-100 text-gray-500"}`}>{i+1}</span>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{p.nombre}</p>
                            <p className="text-xs text-gray-400">{p.veces_vendido} unidades</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-blue-700">Bs. {Number(p.margen_total).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Margen</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ── Resultado: OCUPACIÓN ── */}
            {reporteData?.tipo === "ocupacion" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label:"Total citas",     val:reporteData.resumen.total_citas,         color:"bg-blue-50 text-blue-700 border-blue-200" },
                    { label:"Atendidas",       val:reporteData.resumen.atendidas,            color:"bg-green-50 text-green-700 border-green-200" },
                    { label:"Canceladas",      val:reporteData.resumen.canceladas,           color:"bg-red-50 text-red-700 border-red-200" },
                    { label:"% Ocupación",     val:`${reporteData.resumen.pct_ocupacion_global ?? 0}%`, color:"bg-purple-100 text-purple-800 border-purple-300" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`border-2 ${color} rounded-2xl p-4`}>
                      <p className="text-xs font-bold opacity-70 mb-1">{label}</p>
                      <p className="text-2xl font-black">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm">Ocupación por groomer</h4>
                  {reporteData.por_groomer.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
                    : reporteData.por_groomer.map((g: any, i: number) => (
                      <div key={i} className="py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-800 text-sm">✂️ {g.groomer}</span>
                          <span className="font-black text-purple-700">{g.tasa_completado ?? 0}%</span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>{g.citas_asignadas} asignadas</span>
                          <span>{g.completadas} completadas</span>
                        </div>
                        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width:`${g.tasa_completado ?? 0}%` }}/>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* ── Resultado: INSUMOS ── */}
            {reporteData?.tipo === "insumos" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm">Auditoría de insumos</h4>
                  {reporteData.auditoria.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-4">Sin datos</p>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>{["Producto","Entregado","Usado","Devuelto","Desperdicio","Stock"].map(h=><th key={h} className="px-3 py-2 text-left text-gray-500 font-bold">{h}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {reporteData.auditoria.map((r: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-semibold text-gray-800">{r.producto}<br/><span className="text-gray-400 font-normal capitalize">{r.categoria}</span></td>
                                <td className="px-3 py-2 font-bold text-blue-600">{r.total_entregado}</td>
                                <td className="px-3 py-2 font-bold text-green-600">{r.total_usado}</td>
                                <td className="px-3 py-2 font-bold text-teal-600">{r.total_devuelto}</td>
                                <td className="px-3 py-2 font-bold text-red-500">{r.total_desperdicio}</td>
                                <td className="px-3 py-2 font-bold text-gray-700">{r.stock_actual ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </div>
              </div>
            )}

            {/* ── Resultado: NPS ── */}
            {reporteData?.tipo === "nps" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label:"NPS Score",      val:reporteData.resumen.nps_score,            color: Number(reporteData.resumen.nps_score)>=50?"bg-green-100 text-green-800 border-green-300":Number(reporteData.resumen.nps_score)>=0?"bg-amber-100 text-amber-800 border-amber-300":"bg-red-100 text-red-800 border-red-300" },
                    { label:"Promedio",        val:`${reporteData.resumen.promedio}⭐`,       color:"bg-blue-50 text-blue-700 border-blue-200" },
                    { label:"Calificaciones",  val:reporteData.resumen.total_calificaciones, color:"bg-gray-50 text-gray-700 border-gray-200" },
                    { label:"Promotores",      val:reporteData.resumen.promotores,           color:"bg-green-50 text-green-700 border-green-200" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`border-2 ${color} rounded-2xl p-4`}>
                      <p className="text-xs font-bold opacity-70 mb-1">{label}</p>
                      <p className="text-2xl font-black">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="font-black text-gray-800 mb-3 text-sm">Distribución de puntuaciones</h4>
                  {reporteData.distribucion.map((d: any) => (
                    <div key={d.puntuacion} className="flex items-center gap-3 mb-2">
                      <span className="w-16 text-sm font-bold text-gray-700">{"⭐".repeat(Number(d.puntuacion))}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${Number(d.puntuacion)>=4?"bg-green-400":Number(d.puntuacion)===3?"bg-amber-400":"bg-red-400"}`}
                          style={{ width:`${d.porcentaje}%` }}/>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{d.cantidad} ({d.porcentaje}%)</span>
                    </div>
                  ))}
                </div>
                {reporteData.comentarios.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h4 className="font-black text-gray-800 mb-3 text-sm">Comentarios recientes</h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {reporteData.comentarios.map((c: any, i: number) => (
                        <div key={i} className={`rounded-xl p-3 border ${Number(c.puntuacion)>=4?"border-green-100 bg-green-50":Number(c.puntuacion)===3?"border-amber-100 bg-amber-50":"border-red-100 bg-red-50"}`}>
                          <p className="text-xs font-black mb-1">{"⭐".repeat(Number(c.puntuacion))}</p>
                          <p className="text-xs text-gray-700">{c.comentario}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sin datos aún */}
            {!cargandoReporte && !reporteData && !errorReporte && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold">Selecciona un tipo de reporte y haz clic en "Generar"</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}