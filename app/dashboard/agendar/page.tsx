"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Calendar, Clock, ChevronLeft, ChevronRight,
  PawPrint, CheckCircle, Scissors, Bath, Heart, Sparkles, AlertCircle, Loader2
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Servicio {
  id_servicio: number
  nombre: string
  descripcion: string
  duracion_min: number
  duracion_ajustada: number | null
  precio_base: number
  categoria: string
}

interface Mascota {
  id_mascota: number
  nombre: string
  especie: string
  raza: string
  tamanio: string
  foto_url: string | null
}

interface Slot {
  hora_inicio: string
  hora_fin: string
  disponible: boolean
  razon?: string
}

const ICONOS_SERVICIO: Record<string, React.ElementType> = {
  grooming: Scissors,
  estetica: Bath,
  medico: Heart,
  otros: Sparkles,
}

const PASOS = ["Mascota", "Servicio", "Fecha", "Hora", "Confirmar"]

// ── Helpers ────────────────────────────────────────────────────────────────
function formatFecha(d: Date) {
  return d.toISOString().split("T")[0]
}
function formatFechaLegible(s: string) {
  const d = new Date(s + "T00:00:00")
  return d.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}


// ── Componente calendario con navegación de meses ─────────────────────────
function CalendarioSelector({
  fechaSeleccionada,
  onSelect,
}: {
  fechaSeleccionada: string
  onSelect: (f: string) => void
}) {
  const hoy = new Date()
  const [mesVista, setMesVista] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

  const anio = mesVista.getFullYear()
  const mes  = mesVista.getMonth()

  // Primer día del mes y cantidad de días
  const primerDia     = new Date(anio, mes, 1).getDay()   // 0=Dom
  const diasEnMes     = new Date(anio, mes + 1, 0).getDate()
  const diasAnteriores = primerDia                         // celdas vacías al inicio

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  const diasSemana = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]

  const irMesAnterior = () => setMesVista(new Date(anio, mes - 1, 1))
  const irMesSiguiente = () => setMesVista(new Date(anio, mes + 1, 1))

  // No permitir navegar a meses anteriores al actual
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth()

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
      {/* Cabecera mes/año */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={irMesAnterior}
          disabled={esMesActual}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 text-gray-500 hover:bg-violet-50 hover:border-violet-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-black text-gray-800 text-base">
          {meses[mes]} {anio}
        </span>
        <button
          onClick={irMesSiguiente}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 text-gray-500 hover:bg-violet-50 hover:border-violet-300 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Encabezados días semana */}
      <div className="grid grid-cols-7 mb-1">
        {diasSemana.map(d => (
          <div key={d} className={`text-center text-[11px] font-bold py-1 ${d === "Dom" ? "text-red-400" : "text-gray-400"}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {/* Celdas vacías antes del día 1 */}
        {Array.from({ length: diasAnteriores }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Días reales */}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
          const fechaDia  = new Date(anio, mes, dia)
          const fStr      = formatFecha(fechaDia)
          const diaSemana = fechaDia.getDay()
          //const esDomingo = diaSemana === 0
          const esPasado  = fechaDia < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
          const esHoy     = fStr === formatFecha(hoy)
          const seleccionado = fStr === fechaSeleccionada
          //const deshabilitado = esDomingo || esPasado
          const deshabilitado = esPasado

          return (
            <button
              key={fStr}
              disabled={deshabilitado}
              onClick={() => onSelect(fStr)}
              className={`
                aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all
                ${deshabilitado
                  ? "text-gray-200 cursor-not-allowed"
                  : seleccionado
                    ? "bg-violet-600 text-white shadow-lg scale-105"
                    : esHoy
                      ? "border-2 border-violet-400 text-violet-700 hover:bg-violet-50"
                      : "text-gray-700 hover:bg-violet-50 hover:text-violet-700"
                }
                
              `}
            >
              {dia}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <span className="w-3 h-3 rounded-full bg-violet-600 inline-block" /> Seleccionado
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-violet-400 inline-block" /> Hoy
        </span>      
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AgendarPage() {
  const { user, accessToken, isLoading } = useAuth()

  // Helper: fetch autenticado con token en header (igual que el resto de la app)
  const authFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })
  const router = useRouter()

  // Wizard state
  const [paso, setPaso] = useState(0)
  const [mascotas, setMascotas] = useState<Mascota[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [slots, setSlots] = useState<Slot[]>([])

  const [idMascota, setIdMascota] = useState<number | null>(null)
  const [idServicio, setIdServicio] = useState<number | null>(null)
  const [fecha, setFecha] = useState<string>("")
  const [horaSlot, setHoraSlot] = useState<Slot | null>(null)
  const [notas, setNotas] = useState("")

  // Estado para el sub-formulario de registro de mascota
  const [mostrarFormMascota, setMostrarFormMascota] = useState(false)
  const [guardandoMascota, setGuardandoMascota] = useState(false)
  const [formMascota, setFormMascota] = useState({
    nombre: "",
    especie: "perro",
    raza: "",
    tamanio: "mediano",
    fecha_nacimiento: "",
    peso_kg: "",
    color_pelaje: "",
    temperamento: "tranquilo",
    observaciones_medicas: "",
  })

  const [cargando, setCargando] = useState(false)
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState<{ id_cita: number; estado: string } | null>(null)

  const hoy = new Date()

  // Redirigir si no autenticado
  useEffect(() => {
    if (!isLoading && !user) router.push("/login")
  }, [user, isLoading, router])

  // Cargar mascotas del cliente
  useEffect(() => {
    if (!user) return
    authFetch("/api/mascotas")
      .then(r => r.json())
      .then(d => setMascotas(d.mascotas || []))
      .catch(() => setError("No se pudieron cargar las mascotas"))
  }, [user])

  // Cargar servicios cuando se selecciona mascota
  useEffect(() => {
    if (!idMascota) return
    const mascota = mascotas.find(m => m.id_mascota === idMascota)
    if (!mascota) return
    authFetch(`/api/servicios?tamanio=${mascota.tamanio}`)
      .then(r => r.json())
      .then(d => setServicios(d.servicios || []))
      .catch(() => setError("No se pudieron cargar los servicios"))
  }, [idMascota, mascotas])

  // Cargar slots cuando se selecciona fecha + servicio + mascota
  const cargarSlots = useCallback(async (f: string) => {
    if (!idServicio || !idMascota) return
    setCargandoSlots(true)
    setSlots([])
    setHoraSlot(null)
    try {
      const res = await authFetch(
        `/api/slots?fecha=${f}&id_servicio=${idServicio}&id_mascota=${idMascota}`
      )
      const d = await res.json()
      // Normalizar HH:MM:SS → HH:MM por si PG devuelve con segundos
      const slotsNorm = (d.slots || []).map((s: Slot) => ({
        ...s,
        hora_inicio: s.hora_inicio?.slice(0, 5),
        hora_fin:    s.hora_fin?.slice(0, 5),
      }))
      setSlots(slotsNorm)
    } catch {
      setError("Error al cargar horarios disponibles")
    } finally {
      setCargandoSlots(false)
    }
  }, [idServicio, idMascota])

  useEffect(() => {
    if (fecha && paso === 3) cargarSlots(fecha)
  }, [fecha, paso, cargarSlots])

  // Registrar mascota nueva
  const registrarMascota = async () => {
    if (!formMascota.nombre || !formMascota.especie || !formMascota.tamanio) {
      setError("Completa nombre, especie y tamaño")
      return
    }
    setGuardandoMascota(true)
    setError("")
    try {
      const res = await authFetch("/api/mascotas", {
        method: "POST",
        body: JSON.stringify(formMascota),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || "Error al registrar mascota")
      // Recargar lista y seleccionar la nueva mascota
      const listRes = await authFetch("/api/mascotas")
      const listData = await listRes.json()
      setMascotas(listData.mascotas || [])
      setIdMascota(d.mascota.id_mascota)
      setMostrarFormMascota(false)
      setFormMascota({ nombre: "", especie: "perro", raza: "", tamanio: "mediano",
        fecha_nacimiento: "", peso_kg: "", color_pelaje: "", temperamento: "tranquilo",
        observaciones_medicas: "" })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardandoMascota(false)
    }
  }

  // Confirmar cita
  const confirmarCita = async () => {
    if (!idMascota || !idServicio || !fecha || !horaSlot) return
    setCargando(true)
    setError("")
    try {
      const res = await authFetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_mascota: idMascota,
          id_servicio: idServicio,
          fecha_programada: fecha,
          hora_programada: horaSlot.hora_inicio?.slice(0, 5),
          notas,
          canal_reserva: "web",
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || "Error al crear la cita")
      setExito({ id_cita: d.id_cita, estado: d.estado })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-violet-50">
        <PawPrint className="w-10 h-10 text-violet-400 animate-bounce" />
      </div>
    )
  }

  // ── Pantalla de éxito ─────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="min-h-screen bg-[#f8f7ff] flex items-center justify-center p-4"
        style={{ fontFamily: "'Nunito', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-xl border-2 border-violet-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">¡Cita solicitada! 🐾</h2>
          <p className="text-gray-500 mb-1">
            Tu cita #{exito.id_cita} fue enviada exitosamente.
          </p>
          {exito.estado === "pendiente" && (
            <p className="text-amber-600 text-sm bg-amber-50 rounded-xl px-4 py-2 mb-6">
              Recepción confirmará tu cita pronto.
            </p>
          )}
          <div className="bg-violet-50 rounded-2xl p-4 text-left mb-6 space-y-1">
            <p className="text-sm text-gray-600">
              <span className="font-bold">Mascota:</span> {mascotas.find(m => m.id_mascota === idMascota)?.nombre}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-bold">Servicio:</span> {servicios.find(s => s.id_servicio === idServicio)?.nombre}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-bold">Fecha:</span> {formatFechaLegible(fecha)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-bold">Hora:</span> {horaSlot?.hora_inicio} – {horaSlot?.hora_fin}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl hover:opacity-90 transition"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const mascotaSeleccionada = mascotas.find(m => m.id_mascota === idMascota)
  const servicioSeleccionado = servicios.find(s => s.id_servicio === idServicio)

  return (
    <div className="min-h-screen bg-[#f8f7ff]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 to-purple-800 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")}
            className="text-white/70 hover:text-white transition">
            <ChevronLeft size={22} />
          </button>
          <PawPrint className="w-5 h-5 text-purple-300" />
          <span className="text-white font-black text-lg">Agendar cita</span>
        </div>
      </header>

      {/* Barra de progreso */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            {PASOS.map((p, i) => (
              <div key={p} className="flex items-center">
                <div className={`flex flex-col items-center gap-0.5`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < paso ? "bg-green-500 text-white" : i === paso ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {i < paso ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold hidden sm:block ${i === paso ? "text-violet-600" : "text-gray-400"}`}>{p}</span>
                </div>
                {i < PASOS.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-14 mx-1 rounded ${i < paso ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Error global */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── PASO 0: Elegir mascota ── */}
        {paso === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-gray-800">¿Para cuál mascota? 🐾</h2>
            {mascotas.length === 0 && !mostrarFormMascota ? (
              <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-violet-200">
                <PawPrint className="w-10 h-10 text-violet-300 mx-auto mb-3" />
                <p className="text-gray-600 font-bold">Aún no tienes mascotas registradas</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">Registra a tu mascota para poder agendar</p>
                <button
                  onClick={() => setMostrarFormMascota(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl hover:opacity-90 transition text-sm"
                >
                  + Registrar mi mascota
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mascotas.map(m => (
                  <button key={m.id_mascota}
                    onClick={() => { setIdMascota(m.id_mascota); setIdServicio(null); setHoraSlot(null) }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] ${idMascota === m.id_mascota ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-white hover:border-violet-300"}`}
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center text-2xl shrink-0">
                      {m.especie === "perro" ? "🐶" : m.especie === "gato" ? "🐱" : "🐾"}
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{m.nombre}</p>
                      <p className="text-xs text-gray-500 capitalize">{m.especie} · {m.raza || "Sin raza"}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${m.tamanio === "pequeño" ? "bg-blue-100 text-blue-600" : m.tamanio === "mediano" ? "bg-green-100 text-green-600" : m.tamanio === "grande" ? "bg-orange-100 text-orange-600" : "bg-red-100 text-red-600"}`}>
                        {m.tamanio}
                      </span>
                    </div>
                    {idMascota === m.id_mascota && <CheckCircle className="text-violet-500 ml-auto" size={20} />}
                  </button>
                ))}
              </div>
            )}
            {/* Botón para agregar otra mascota (cuando ya hay al menos una) */}
            {mascotas.length > 0 && !mostrarFormMascota && (
              <button
                onClick={() => setMostrarFormMascota(true)}
                className="w-full py-3 border-2 border-dashed border-violet-300 text-violet-600 font-bold rounded-2xl hover:bg-violet-50 transition text-sm flex items-center justify-center gap-2"
              >
                <PawPrint size={16} /> + Registrar otra mascota
              </button>
            )}

            {/* ── FORMULARIO INLINE DE REGISTRO ── */}
            {mostrarFormMascota && (
              <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-violet-800 text-base">🐾 Nueva mascota</h3>
                  <button onClick={() => { setMostrarFormMascota(false); setError("") }}
                    className="text-gray-400 hover:text-gray-600 text-sm font-semibold">Cancelar</button>
                </div>

                {/* Fila 1: nombre + especie */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Nombre *</label>
                    <input type="text" placeholder="Ej: Max"
                      value={formMascota.nombre}
                      onChange={e => setFormMascota(p => ({ ...p, nombre: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Especie *</label>
                    <select value={formMascota.especie}
                      onChange={e => setFormMascota(p => ({ ...p, especie: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm bg-white">
                      <option value="perro">🐶 Perro</option>
                      <option value="gato">🐱 Gato</option>
                      <option value="otro">🐾 Otro</option>
                    </select>
                  </div>
                </div>

                {/* Fila 2: raza + tamaño */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Raza</label>
                    <input type="text" placeholder="Ej: Labrador"
                      value={formMascota.raza}
                      onChange={e => setFormMascota(p => ({ ...p, raza: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Tamaño *</label>
                    <select value={formMascota.tamanio}
                      onChange={e => setFormMascota(p => ({ ...p, tamanio: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm bg-white">
                      <option value="pequenio">Pequeño</option>
                      <option value="mediano">Mediano</option>
                      <option value="grande">Grande</option>
                      <option value="gigante">Gigante</option>
                    </select>
                  </div>
                </div>

                {/* Fila 3: fecha nacimiento + peso */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Fecha de nacimiento</label>
                    <input type="date"
                      value={formMascota.fecha_nacimiento}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={e => setFormMascota(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Peso (kg)</label>
                    <input type="number" placeholder="Ej: 5.5" min="0" step="0.1"
                      value={formMascota.peso_kg}
                      onChange={e => setFormMascota(p => ({ ...p, peso_kg: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Fila 4: color + temperamento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Color de pelaje</label>
                    <input type="text" placeholder="Ej: Negro con blanco"
                      value={formMascota.color_pelaje}
                      onChange={e => setFormMascota(p => ({ ...p, color_pelaje: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Temperamento</label>
                    <select value={formMascota.temperamento}
                      onChange={e => setFormMascota(p => ({ ...p, temperamento: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm bg-white">
                      <option value="tranquilo">😌 Tranquilo</option>
                      <option value="nervioso">😰 Nervioso</option>
                      <option value="agresivo">😤 Agresivo</option>
                      <option value="inquieto">🐾 Inquieto</option>
                    </select>
                  </div>
                </div>

                {/* Alergias / observaciones médicas */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Alergias / observaciones médicas
                  </label>
                  <textarea rows={2} placeholder="Ej: Alérgico al shampoo con fragancia..."
                    value={formMascota.observaciones_medicas}
                    onChange={e => setFormMascota(p => ({ ...p, observaciones_medicas: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm resize-none"
                  />
                </div>

                <button
                  onClick={registrarMascota}
                  disabled={guardandoMascota || !formMascota.nombre}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2 text-sm"
                >
                  {guardandoMascota
                    ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                    : <><PawPrint size={16} /> Guardar mascota</>
                  }
                </button>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button disabled={!idMascota}
                onClick={() => { setPaso(1); setError("") }}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2">
                Siguiente <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 1: Elegir servicio ── */}
        {paso === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-gray-800">¿Qué servicio necesita? ✂️</h2>
            {mascotaSeleccionada && (
              <p className="text-sm text-gray-500">
                Duraciones ajustadas para <span className="font-bold text-violet-600">{mascotaSeleccionada.nombre}</span> ({mascotaSeleccionada.tamanio})
              </p>
            )}
            {servicios.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {servicios.map(s => {
                  const Icon = ICONOS_SERVICIO[s.categoria] || Sparkles
                  return (
                    <button key={s.id_servicio}
                      onClick={() => { setIdServicio(s.id_servicio); setHoraSlot(null) }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.01] ${idServicio === s.id_servicio ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-white hover:border-violet-300"}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${idServicio === s.id_servicio ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500"}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-gray-800">{s.nombre}</p>
                        <p className="text-xs text-gray-500">{s.descripcion}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={11} /> {s.duracion_ajustada ?? s.duracion_min} min
                          </span>
                          <span className="text-xs font-bold text-violet-600">Bs. {Number(s.precio_base || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      {idServicio === s.id_servicio && <CheckCircle className="text-violet-500 shrink-0" size={20} />}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={() => setPaso(0)}
                className="px-6 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button disabled={!idServicio}
                onClick={() => { setPaso(2); setError("") }}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2">
                Siguiente <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Elegir fecha ── */}
        {paso === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-gray-800">¿Qué día? 📅</h2>
            <CalendarioSelector
              fechaSeleccionada={fecha}
              onSelect={(f) => setFecha(f)}
            />
            <div className="flex justify-between pt-2">
              <button onClick={() => setPaso(1)}
                className="px-6 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button disabled={!fecha}
                onClick={() => { setPaso(3); setError("") }}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2">
                Ver horarios <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Elegir hora ── */}
        {paso === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-gray-800">¿A qué hora? 🕐</h2>
              <p className="text-sm text-gray-500">{formatFechaLegible(fecha)}</p>
            </div>
            {cargandoSlots ? (
              <div className="flex items-center justify-center py-12 gap-3 text-violet-500">
                <Loader2 className="animate-spin" size={24} />
                <span className="font-semibold">Verificando disponibilidad...</span>
              </div>
            ) : (
              <>
                {slots.filter(s => s.disponible).length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold">Sin horarios disponibles</p>
                    <p className="text-gray-400 text-sm mt-1">Elige otro día</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s, idx) => (
                      <button key={`${s.hora_inicio}-${idx}`}
                        disabled={!s.disponible}
                        onClick={() => setHoraSlot(s)}
                        className={`py-3 px-2 rounded-xl border-2 text-center text-sm font-bold transition-all ${!s.disponible ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" : horaSlot?.hora_inicio === s.hora_inicio ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:scale-105"}`}
                      >
                        {s.hora_inicio}
                        {!s.disponible && <p className="text-[9px] text-gray-300 font-normal leading-tight">{s.razon}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={() => setPaso(2)}
                className="px-6 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button disabled={!horaSlot}
                onClick={() => { setPaso(4); setError("") }}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2">
                Revisar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: Confirmar ── */}
        {paso === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-black text-gray-800">Confirmar cita 🐾</h2>

            <div className="bg-white rounded-2xl border-2 border-violet-100 p-5 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Mascota</span>
                <span className="font-bold text-gray-800">{mascotaSeleccionada?.nombre} {mascotaSeleccionada?.especie === "perro" ? "🐶" : "🐱"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Servicio</span>
                <span className="font-bold text-gray-800">{servicioSeleccionado?.nombre}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Fecha</span>
                <span className="font-bold text-gray-800 capitalize">{formatFechaLegible(fecha)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Hora</span>
                <span className="font-bold text-gray-800">{horaSlot?.hora_inicio} – {horaSlot?.hora_fin}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Duración</span>
                <span className="font-bold text-gray-800">{servicioSeleccionado?.duracion_ajustada ?? servicioSeleccionado?.duracion_min} min</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500 text-sm">Precio</span>
                <span className="font-black text-violet-700 text-lg">Bs. {Number(servicioSeleccionado?.precio_base || 0).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Notas adicionales (opcional)</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
                placeholder="Alergias, comportamiento especial, instrucciones..."
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm resize-none text-gray-700"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
              ⏳ Tu cita quedará <strong>pendiente</strong> hasta que recepción la confirme.
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setPaso(3)}
                className="px-6 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition flex items-center gap-2">
                <ChevronLeft size={18} /> Atrás
              </button>
              <button
                disabled={cargando}
                onClick={confirmarCita}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
              >
                {cargando ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <>✓ Confirmar cita</>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}