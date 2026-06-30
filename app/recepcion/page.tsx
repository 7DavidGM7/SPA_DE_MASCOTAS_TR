"use client"
// app/recepcion/page.tsx
// Panel de recepción con:
// - Calendario maestro (drag & drop para reprogramar)
// - Modal de detalle/confirmación/reprogramación
// - Modal de crear nueva cita desde recepción

import { useEffect, useState, useCallback, useRef } from "react"

import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useSessionTimeout } from "@/lib/use-session-timeout"
import {
  Calendar, Users, ClipboardList, LogOut, Bell, PawPrint,
  ChevronRight, ChevronLeft, CheckCircle, XCircle,
  Loader2, AlertCircle, RefreshCw, Plus, UserCheck, Lock,
  CalendarPlus, Clock, Move, FileText, Download, Printer, TrendingDown, AlertOctagon,
  PackageX, PackageSearch, Phone, Mail,
  ChevronDown, ChevronUp, DollarSign, Package
} from "lucide-react"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Cita {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
  nombre_cliente: string
  telefono_cliente: string
  nombre_mascota: string
  especie: string
  tamanio: string
  nombre_servicio: string
  id_servicio: number | null
  id_mascota: number | null
  duracion_ajustada: number
  precio_calculado: number
  nombre_groomer: string | null
  id_trabajador_groomer: number | null
  notas: string | null
  id_cliente: number | null
}

interface Groomer { id_trabajador: number; nombre: string; apellido: string; especialidad: string }
interface Servicio { id_servicio: number; nombre: string; duracion_base: number; precio: number }
interface Mascota { id_mascota: number; nombre: string; especie: string; tamanio: string }
interface Cliente { id_usuario: number; nombre: string; apellido: string; email: string }

const ESTADO_COLORES: Record<string, string> = {
  pendiente:    "bg-amber-100 text-amber-700 border-amber-200",
  confirmada:   "bg-green-100 text-green-700 border-green-200",
  completada:   "bg-blue-100 text-blue-700 border-blue-200",
  cancelada:    "bg-red-100 text-red-700 border-red-200",
  no_asistio:   "bg-gray-100 text-gray-600 border-gray-200",
  reprogramada: "bg-purple-100 text-purple-700 border-purple-200",
  en_proceso:   "bg-cyan-100 text-cyan-700 border-cyan-200",
}

const ESTADO_DOT: Record<string, string> = {
  pendiente: "bg-amber-400", confirmada: "bg-green-500",
  completada: "bg-blue-500", cancelada: "bg-red-400",
  en_proceso: "bg-cyan-500", reprogramada: "bg-purple-400",
}

function formatFecha(d: Date) { return d.toISOString().split("T")[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── Calendario con drag & drop ─────────────────────────────────────────────
function CalendarioMaestro({
  fechaSeleccionada, onSelect, citasPorFecha,
  onDropCita,
}: {
  fechaSeleccionada: string
  onSelect: (f: string) => void
  citasPorFecha: Record<string, number>
  onDropCita: (idCita: number, nuevaFecha: string) => void
}) {
  const hoy = new Date()
  const [mesVista, setMesVista] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [draggingOver, setDraggingOver] = useState<string | null>(null)

  const anio = mesVista.getFullYear()
  const mes  = mesVista.getMonth()
  const primerDia = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth()

  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  const DIAS  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]

  const handleDragOver = (e: React.DragEvent, fecha: string, esDom: boolean) => {
    if (esDom) return
    e.preventDefault()
    setDraggingOver(fecha)
  }

  const handleDrop = (e: React.DragEvent, fecha: string, esDom: boolean) => {
    if (esDom) return
    e.preventDefault()
    setDraggingOver(null)
    const idCita = Number(e.dataTransfer.getData("idCita"))
    if (idCita) onDropCita(idCita, fecha)
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMesVista(new Date(anio, mes - 1, 1))} disabled={esMesActual}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 text-gray-500 hover:bg-teal-50 hover:border-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <h3 className="font-black text-gray-800">{MESES[mes]} {anio}</h3>
          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-center gap-1">
            <Move size={10} /> Arrastra citas al calendario para reprogramar
          </p>
        </div>
        <button onClick={() => setMesVista(new Date(anio, mes + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-200 text-gray-500 hover:bg-teal-50 hover:border-teal-300 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(d => (
          <div key={d} className={`text-center text-[11px] font-bold py-1 ${d === "Dom" ? "text-red-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: primerDia }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map(dia => {
          const fechaDia  = new Date(anio, mes, dia)
          const fStr      = formatFecha(fechaDia)
          const esDomingo = fechaDia.getDay() === 0
          const esPasado  = fechaDia < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
          const esHoy     = fStr === formatFecha(hoy)
          const selec     = fStr === fechaSeleccionada
          const nCitas    = citasPorFecha[fStr] || 0
          const isDragOver = draggingOver === fStr

          return (
            <button key={fStr}
              onClick={() => onSelect(fStr)}
              disabled={esDomingo}
              onDragOver={(e) => handleDragOver(e, fStr, esDomingo)}
              onDragLeave={() => setDraggingOver(null)}
              onDrop={(e) => handleDrop(e, fStr, esDomingo)}
              className={`
                relative flex flex-col items-center justify-center rounded-xl p-1 min-h-[44px] transition-all
                ${esDomingo ? "cursor-not-allowed opacity-30" : "hover:bg-teal-50"}
                ${selec ? "bg-teal-500 text-white shadow-md scale-105" : esHoy ? "border-2 border-teal-400" : ""}
                ${esPasado && !selec ? "opacity-50" : ""}
                ${isDragOver ? "bg-teal-200 border-2 border-teal-500 scale-110" : ""}
              `}
            >
              <span className={`text-sm font-bold ${selec ? "text-white" : esHoy ? "text-teal-700" : "text-gray-700"}`}>{dia}</span>
              {nCitas > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[32px]">
                  {Array.from({ length: Math.min(nCitas, 3) }).map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${selec ? "bg-white" : "bg-teal-500"}`} />
                  ))}
                  {nCitas > 3 && <span className={`text-[9px] font-bold ${selec ? "text-white" : "text-teal-600"}`}>+{nCitas - 3}</span>}
                </div>
              )}
              {isDragOver && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-white text-[8px] font-black">+</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> Citas</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-teal-400" /> Hoy</span>
        <span className="flex items-center gap-1"><Move size={10} /> Arrastra para mover</span>
      </div>
    </div>
  )
}



// ── Tipos ──────────────────────────────────────────────────────────────────
interface CitaCronograma {
  id_cita: number
  hora_programada: string
  estado_reserva: string
  notas: string | null
  nombre_cliente: string
  telefono_cliente: string | null
  nombre_mascota: string | null
  especie: string | null
  tamanio: string | null
  temperamento: string | null
  nombre_servicio: string | null
  duracion_base: number | null
  precio_servicio: number | null
  nombre_groomer: string | null
  estado_pago: string
  monto_cobrado: number | null
  metodo_pago: string | null
}
 
interface ResumenCronograma {
  total: number
  pendientes: number
  confirmadas: number
  en_proceso: number
  completadas: number
  ingresos_esperados: number
}
 
interface CitaCancelada {
  id_cita: number
  fecha_programada: string
  hora_programada: string
  estado_reserva: string
  nombre_cliente: string
  telefono_cliente: string | null
  email_cliente: string | null
  nombre_mascota: string | null
  especie: string | null
  nombre_servicio: string | null
  precio_servicio: number | null
  motivo_cambio: string | null
}
 
interface StatsCanceladas {
  total_canceladas: number
  total_no_show: number
  clientes_afectados: number
  ingresos_perdidos: number
}
 
interface ProductoCritico {
  id_producto: number
  nombre: string
  categoria: string
  precio_venta: number
  precio_costo: number
  marca: string | null
  presentacion: string | null
  stock_actual: number
  stock_minimo: number
  estado_stock: string
  proveedor_sugerido: string | null
  telefono_proveedor: string | null
  email_proveedor: string | null
  ventas_30_dias: number
  cantidad_a_pedir: number
}
 
interface InsumoGrooming {
  id_producto: number
  nombre: string
  categoria: string
  especie_aplicable: string
  stock_actual: number
  stock_minimo: number
  estado_stock: string
  consumo_30_dias: number
}
 
// ── Helpers ────────────────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
  pendiente:  "bg-amber-100 text-amber-700",
  confirmada: "bg-green-100 text-green-700",
  en_proceso: "bg-cyan-100 text-cyan-700",
  completada: "bg-blue-100 text-blue-700",
  cancelada:  "bg-red-100 text-red-700",
  no_asistio: "bg-gray-100 text-gray-500",
}
 
const PAGO_COLOR: Record<string, string> = {
  pagado:          "bg-green-100 text-green-700",
  pendiente_pago:  "bg-amber-100 text-amber-700",
  sin_cobro:       "bg-gray-100 text-gray-400",
}
 
const STOCK_COLOR: Record<string, string> = {
  agotado:    "bg-red-100 text-red-700 border-red-300",
  bajo:       "bg-amber-100 text-amber-700 border-amber-300",
  disponible: "bg-green-100 text-green-700 border-green-300",
}
 
function formatFechaES(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-BO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })
}
 
// ── Botón descargar PDF del cronograma ────────────────────────────────────
async function generarPDFCronograma(
  fecha: string,
  resumen: ResumenCronograma,
  citas: CitaCronograma[]
) {
  if (!(window as any).jspdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script")
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
      s.onload = () => resolve()
      s.onerror = () => reject()
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = (window as any).jspdf
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const W = doc.internal.pageSize.getWidth()
  let y = 14
 
  // Encabezado
  doc.setFillColor(13, 148, 136) // teal-600
  doc.rect(0, 0, W, 22, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14); doc.setFont("helvetica", "bold")
  doc.text("SPA MASCOTAS — Cronograma Diario de Citas", 10, 10)
  doc.setFontSize(9); doc.setFont("helvetica", "normal")
  doc.text(formatFechaES(fecha), 10, 17)
  doc.text(`Generado: ${new Date().toLocaleString("es-BO")}`, W - 10, 17, { align: "right" })
  y = 30
 
  // Resumen
  doc.setFontSize(8); doc.setTextColor(55, 65, 81)
  const cols = [
    ["Total citas", resumen.total],
    ["Pendientes", resumen.pendientes],
    ["Confirmadas", resumen.confirmadas],
    ["En proceso", resumen.en_proceso],
    ["Completadas", resumen.completadas],
    ["Ingresos esperados", `Bs. ${Number(resumen.ingresos_esperados).toFixed(2)}`],
  ]
  const colW = (W - 20) / cols.length
  cols.forEach(([label, val], i) => {
    const x = 10 + i * colW
    doc.setFillColor(240, 253, 250)
    doc.roundedRect(x, y - 4, colW - 2, 14, 2, 2, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(13, 148, 136)
    doc.text(String(val), x + (colW - 2) / 2, y + 4, { align: "center" })
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(107, 114, 128)
    doc.text(String(label), x + (colW - 2) / 2, y + 9, { align: "center" })
  })
  y += 20
 
  // Tabla
  const headers = ["Hora", "Cliente", "Mascota", "Servicio", "Groomer", "Estado", "Pago", "Monto"]
  const colWidths = [16, 38, 30, 38, 32, 22, 24, 20]
  let x = 10
  doc.setFillColor(13, 148, 136)
  doc.rect(10, y - 4, W - 20, 8, "F")
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold")
  headers.forEach((h, i) => { doc.text(h, x + 2, y + 1); x += colWidths[i] })
  y += 7
 
  citas.forEach((c, idx) => {
    if (y > 185) { doc.addPage(); y = 14 }
    if (idx % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(10, y - 3, W - 20, 7, "F") }
    doc.setTextColor(31, 41, 55); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
    let cx = 10
    const row = [
      c.hora_programada?.slice(0, 5) || "—",
      c.nombre_cliente,
      `${c.nombre_mascota || "—"} (${c.tamanio || "?"})`,
      c.nombre_servicio || "—",
      c.nombre_groomer || "Sin asignar",
      c.estado_reserva,
      c.estado_pago === "pagado" ? "✓ Pagado" : c.estado_pago === "pendiente_pago" ? "Pendiente" : "—",
      c.monto_cobrado ? `Bs.${Number(c.monto_cobrado).toFixed(0)}` : `Bs.${Number(c.precio_servicio || 0).toFixed(0)}`,
    ]
    row.forEach((val, i) => {
      const maxW = colWidths[i] - 3
      const txt = doc.splitTextToSize(String(val), maxW)[0]
      doc.text(txt, cx + 2, y + 1)
      cx += colWidths[i]
    })
    y += 7
  })
 
  doc.save(`cronograma-${fecha}.pdf`)
}
 
// ── Componente principal ───────────────────────────────────────────────────
export function TabReportes({ authHeaders }: {
  authHeaders: () => Record<string, string>
}) {
  const [subTab, setSubTab] = useState<"cronograma" | "canceladas" | "inventario">("cronograma")
 
  // ── Cronograma ──
  const [fechaCron, setFechaCron]       = useState(new Date().toISOString().split("T")[0])
  const [cargCron, setCargCron]         = useState(false)
  const [dataCron, setDataCron]         = useState<{ resumen: ResumenCronograma; citas: CitaCronograma[] } | null>(null)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [expandidosCron, setExpandidosCron] = useState<Set<number>>(new Set())
 
  // ── Canceladas ──
  const [fechaIniCan, setFechaIniCan] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]
  })
  const [fechaFinCan, setFechaFinCan] = useState(new Date().toISOString().split("T")[0])
  const [cargCan, setCargCan]         = useState(false)
  const [dataCan, setDataCan]         = useState<{
    stats: StatsCanceladas; citas: CitaCancelada[]
    top_cancelaciones: { nombre_cliente: string; telefono: string; cancelaciones: number; no_shows: number }[]
  } | null>(null)
 
  // ── Inventario ──
  const [cargInv, setCargInv]   = useState(false)
  const [dataInv, setDataInv]   = useState<{
    resumen: { productos_agotados: number; productos_bajo_stock: number; inversion_requerida: number }
    productos_venta: ProductoCritico[]
    insumos_grooming: InsumoGrooming[]
  } | null>(null)
  const [tabInv, setTabInv]     = useState<"venta" | "insumos">("venta")
 
  const [error, setError] = useState("")
 
  const cargarCronograma = async () => {
    setCargCron(true); setError("")
    try {
      const res = await fetch(`/api/reportes/recepcion?tipo=cronograma&fecha=${fechaCron}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDataCron({ resumen: d.resumen, citas: d.citas })
    } catch (e: any) { setError(e.message) }
    finally { setCargCron(false) }
  }
 
  const cargarCanceladas = async () => {
    setCargCan(true); setError("")
    try {
      const res = await fetch(
        `/api/reportes/recepcion?tipo=canceladas&fecha=${fechaIniCan}&fecha_fin=${fechaFinCan}`,
        { headers: authHeaders() }
      )
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDataCan({ stats: d.stats, citas: d.citas, top_cancelaciones: d.top_cancelaciones })
    } catch (e: any) { setError(e.message) }
    finally { setCargCan(false) }
  }
 
  const cargarInventario = async () => {
    setCargInv(true); setError("")
    try {
      const res = await fetch(`/api/reportes/recepcion?tipo=inventario_critico`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDataInv({ resumen: d.resumen, productos_venta: d.productos_venta, insumos_grooming: d.insumos_grooming })
    } catch (e: any) { setError(e.message) }
    finally { setCargInv(false) }
  }
 
  const toggleExpandido = (id: number) => {
    setExpandidosCron(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
 
  return (
    <div className="space-y-5">
 
      {/* Header del módulo */}
      <div className="bg-gradient-to-br from-teal-600 to-emerald-700 rounded-3xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-6 h-6" />
          <h2 className="text-xl font-black">Reportes de Recepción</h2>
        </div>
        <p className="text-teal-100 text-sm">Cronograma diario, cancelaciones e inventario crítico.</p>
      </div>
 
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-white rounded-2xl p-1.5 border border-gray-100 shadow-sm flex-wrap">
        {([
          { key: "cronograma", label: "📋 Cronograma diario",   desc: "Lista de citas del día con estado de pago" },
          { key: "canceladas", label: "🚫 Canceladas / No-show", desc: "Registro de ausencias por período" },
          { key: "inventario", label: "📦 Inventario crítico",   desc: "Productos e insumos bajo mínimo" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setSubTab(key); setError("") }}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              subTab === key ? "bg-teal-600 text-white shadow" : "text-gray-500 hover:bg-gray-50"
            }`}>
            {label}
          </button>
        ))}
      </div>
 
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError("")} className="ml-auto"><XCircle size={14} /></button>
        </div>
      )}
 
      {/* ════════ CRONOGRAMA DIARIO ════════ */}
      {subTab === "cronograma" && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-teal-500" />
              <input type="date" value={fechaCron} onChange={e => setFechaCron(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-teal-400 focus:outline-none" />
            </div>
            <button onClick={cargarCronograma} disabled={cargCron}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition">
              {cargCron ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Generar
            </button>
            {dataCron && (
              <button
                onClick={async () => {
                  setGenerandoPDF(true)
                  try { await generarPDFCronograma(fechaCron, dataCron.resumen, dataCron.citas) }
                  finally { setGenerandoPDF(false) }
                }}
                disabled={generandoPDF}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition ml-auto"
              >
                {generandoPDF ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Descargar PDF
              </button>
            )}
          </div>
 
          {cargCron && (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal-400" size={28} /></div>
          )}
 
          {dataCron && !cargCron && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: "Total",        val: dataCron.resumen.total,           color: "bg-gray-50 text-gray-700" },
                  { label: "Pendientes",   val: dataCron.resumen.pendientes,       color: "bg-amber-50 text-amber-700" },
                  { label: "Confirmadas",  val: dataCron.resumen.confirmadas,      color: "bg-green-50 text-green-700" },
                  { label: "En proceso",   val: dataCron.resumen.en_proceso,       color: "bg-cyan-50 text-cyan-700" },
                  { label: "Completadas",  val: dataCron.resumen.completadas,      color: "bg-blue-50 text-blue-700" },
                  { label: "Ingresos esp.", val: `Bs. ${Number(dataCron.resumen.ingresos_esperados).toFixed(0)}`, color: "bg-teal-50 text-teal-700" },
                ].map(({ label, val, color }) => (
                  <div key={label} className={`${color} rounded-2xl p-3 text-center border border-current/10`}>
                    <p className="text-xl font-black">{val}</p>
                    <p className="text-[11px] font-semibold opacity-70">{label}</p>
                  </div>
                ))}
              </div>
 
              {/* Lista de citas */}
              {dataCron.citas.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 font-semibold">Sin citas activas para esta fecha</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <Clock size={15} className="text-teal-500" />
                    <h3 className="font-black text-gray-800">
                      {formatFechaES(fechaCron)}
                      <span className="text-gray-400 font-normal text-sm ml-2">· {dataCron.citas.length} citas</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {dataCron.citas.map(c => (
                      <div key={c.id_cita}>
                        <div
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleExpandido(c.id_cita)}
                        >
                          {/* Hora */}
                          <div className="w-12 shrink-0 text-center">
                            <p className="font-black text-teal-700 text-sm">{c.hora_programada?.slice(0, 5)}</p>
                            {c.duracion_base && <p className="text-[10px] text-gray-400">{c.duracion_base}m</p>}
                          </div>
 
                          {/* Especie emoji */}
                          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-lg shrink-0">
                            {c.especie === "perro" ? "🐶" : c.especie === "gato" ? "🐱" : "🐾"}
                          </div>
 
                          {/* Info principal */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">
                              {c.nombre_mascota || "—"}
                              <span className="text-gray-400 font-normal ml-1">· {c.nombre_cliente}</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {c.nombre_servicio} · {c.tamanio}
                              {c.temperamento && c.temperamento !== "tranquilo" && (
                                <span className="ml-1 text-orange-500 font-semibold">⚠ {c.temperamento}</span>
                              )}
                            </p>
                          </div>
 
                          {/* Groomer */}
                          <div className="hidden sm:block shrink-0 text-xs text-gray-500 w-28 text-right">
                            {c.nombre_groomer
                              ? <span className="text-teal-600 font-semibold">✂ {c.nombre_groomer}</span>
                              : <span className="text-amber-500">Sin groomer</span>
                            }
                          </div>
 
                          {/* Estado cita */}
                          <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${ESTADO_COLOR[c.estado_reserva] || "bg-gray-100 text-gray-500"}`}>
                            {c.estado_reserva}
                          </span>
 
                          {/* Estado pago */}
                          <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${PAGO_COLOR[c.estado_pago] || "bg-gray-100 text-gray-400"}`}>
                            {c.estado_pago === "pagado" ? "✓ Pagado" : c.estado_pago === "pendiente_pago" ? "$ Pendiente" : "—"}
                          </span>
 
                          {/* Precio */}
                          <div className="shrink-0 text-right w-20">
                            {c.monto_cobrado
                              ? <p className="font-black text-green-600 text-sm">Bs. {Number(c.monto_cobrado).toFixed(2)}</p>
                              : <p className="font-black text-gray-400 text-sm">Bs. {Number(c.precio_servicio || 0).toFixed(2)}</p>
                            }
                          </div>
 
                          {/* Expand toggle */}
                          <div className="shrink-0 text-gray-300">
                            {expandidosCron.has(c.id_cita) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
 
                        {/* Fila expandida */}
                        {expandidosCron.has(c.id_cita) && (
                          <div className="px-5 pb-3 bg-teal-50/40 border-t border-teal-100">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                              {[
                                ["Teléfono", c.telefono_cliente || "—"],
                                ["Temperamento", c.temperamento || "tranquilo"],
                                ["Método pago", c.metodo_pago?.replace("_"," ") || "—"],
                                ["Notas", c.notas || "Sin notas"],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <p className="text-gray-400 font-semibold">{label}</p>
                                  <p className="font-bold text-gray-700">{val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
 
      {/* ════════ CANCELADAS / NO-SHOW ════════ */}
      {subTab === "canceladas" && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 font-semibold">
              <Calendar size={15} className="text-red-400" />
              Desde
            </div>
            <input type="date" value={fechaIniCan} onChange={e => setFechaIniCan(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
            <span className="text-gray-400 text-sm">hasta</span>
            <input type="date" value={fechaFinCan} onChange={e => setFechaFinCan(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
            <button onClick={cargarCanceladas} disabled={cargCan}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition">
              {cargCan ? <Loader2 size={14} className="animate-spin" /> : <TrendingDown size={14} />}
              Consultar
            </button>
          </div>
 
          {cargCan && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-400" size={28} /></div>}
 
          {dataCan && !cargCan && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: XCircle,     label: "Canceladas",       val: dataCan.stats.total_canceladas,  color: "bg-red-50   text-red-700" },
                  { icon: AlertOctagon,label: "No-show",           val: dataCan.stats.total_no_show,     color: "bg-orange-50 text-orange-700" },
                  { icon: Users,       label: "Clientes afectados",val: dataCan.stats.clientes_afectados,color: "bg-gray-50   text-gray-700" },
                  { icon: DollarSign,  label: "Ingresos perdidos", val: `Bs. ${Number(dataCan.stats.ingresos_perdidos).toFixed(2)}`, color: "bg-rose-50 text-rose-700" },
                ].map(({ icon: Icon, label, val, color }) => (
                  <div key={label} className={`${color} rounded-2xl p-4 border border-current/10`}>
                    <Icon size={18} className="mb-2 opacity-60" />
                    <p className="text-xl font-black">{val}</p>
                    <p className="text-[11px] font-semibold opacity-70">{label}</p>
                  </div>
                ))}
              </div>
 
              {/* Top reincidentes */}
              {dataCan.top_cancelaciones.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                  <h3 className="font-black text-orange-800 text-sm mb-3 flex items-center gap-2">
                    <AlertOctagon size={15} /> Clientes con múltiples ausencias
                  </h3>
                  <div className="space-y-2">
                    {dataCan.top_cancelaciones.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 text-sm">
                        <div>
                          <p className="font-bold text-gray-800">{c.nombre_cliente}</p>
                          {c.telefono && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{c.telefono}</p>}
                        </div>
                        <div className="flex gap-2">
                          {c.cancelaciones > 0 && (
                            <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">{c.cancelaciones} cancel.</span>
                          )}
                          {c.no_shows > 0 && (
                            <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-0.5 rounded-full">{c.no_shows} no-show</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
 
              {/* Lista */}
              {dataCan.citas.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                  <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
                  <p className="text-gray-400 font-semibold">Sin cancelaciones ni no-shows en el período</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="font-black text-gray-800 text-sm">
                      Detalle — {dataCan.citas.length} registro{dataCan.citas.length !== 1 ? "s" : ""}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {dataCan.citas.map(c => (
                      <div key={c.id_cita} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                        <div className="shrink-0">
                          <span className={`text-xs font-black px-2 py-1 rounded-lg ${c.estado_reserva === "cancelada" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                            {c.estado_reserva === "cancelada" ? "❌ Cancelada" : "👻 No-show"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">
                            {c.nombre_cliente}
                            {c.nombre_mascota && <span className="text-gray-400 font-normal"> · {c.nombre_mascota}</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(c.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { day:"numeric", month:"short" })}
                            {" "}{c.hora_programada?.slice(0, 5)} · {c.nombre_servicio || "—"}
                          </p>
                          {c.motivo_cambio && (
                            <p className="text-xs text-gray-400 italic mt-0.5">"{c.motivo_cambio}"</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-rose-500 font-semibold">
                            - Bs. {Number(c.precio_servicio || 0).toFixed(2)}
                          </p>
                          {c.telefono_cliente && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-0.5 justify-end mt-0.5">
                              <Phone size={9} />{c.telefono_cliente}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
 
      {/* ════════ INVENTARIO CRÍTICO ════════ */}
      {subTab === "inventario" && (
        <div className="space-y-4">
          {/* Control */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <Package size={16} className="text-amber-500" />
            <span className="text-sm text-gray-600">Productos e insumos bajo mínimo en este momento</span>
            <button onClick={cargarInventario} disabled={cargInv}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition ml-auto">
              {cargInv ? <Loader2 size={14} className="animate-spin" /> : <PackageSearch size={14} />}
              Consultar
            </button>
          </div>
 
          {cargInv && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-amber-400" size={28} /></div>}
 
          {dataInv && !cargInv && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Agotados",    val: dataInv.resumen.productos_agotados,   color: "bg-red-50 text-red-700",    icon: PackageX },
                  { label: "Bajo stock",  val: dataInv.resumen.productos_bajo_stock, color: "bg-amber-50 text-amber-700", icon: AlertOctagon },
                  { label: "Inversión requerida", val: `Bs. ${Number(dataInv.resumen.inversion_requerida).toFixed(2)}`, color: "bg-purple-50 text-purple-700", icon: DollarSign },
                ].map(({ label, val, color, icon: Icon }) => (
                  <div key={label} className={`${color} rounded-2xl p-4 border border-current/10`}>
                    <Icon size={18} className="mb-2 opacity-60" />
                    <p className="text-xl font-black">{val}</p>
                    <p className="text-[11px] font-semibold opacity-70">{label}</p>
                  </div>
                ))}
              </div>
 
              {/* Sub-tabs venta / insumos */}
              <div className="flex gap-2">
                {[
                  { key: "venta",   label: `🛍 Venta (${dataInv.productos_venta.length})` },
                  { key: "insumos", label: `🧴 Grooming (${dataInv.insumos_grooming.length})` },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setTabInv(key as "venta" | "insumos")}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tabInv === key ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:border-amber-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
 
              {/* Productos de venta */}
              {tabInv === "venta" && (
                dataInv.productos_venta.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                    <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-semibold">Todos los productos de venta tienen stock suficiente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dataInv.productos_venta.map(p => (
                      <div key={p.id_producto}
                        className={`rounded-2xl border-2 p-4 ${STOCK_COLOR[p.estado_stock] || "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-gray-800">{p.nombre}</p>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${p.estado_stock === "agotado" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"}`}>
                                {p.estado_stock === "agotado" ? "🔴 AGOTADO" : "🟡 BAJO STOCK"}
                              </span>
                            </div>
                            {p.marca && <p className="text-xs text-gray-500">{p.marca} · {p.presentacion}</p>}
                            <div className="flex flex-wrap gap-3 mt-2 text-xs">
                              <span>Stock actual: <strong className={p.estado_stock === "agotado" ? "text-red-700" : "text-amber-700"}>{p.stock_actual}</strong></span>
                              <span>Mínimo: <strong>{p.stock_minimo}</strong></span>
                              <span>Pedir: <strong className="text-purple-700">{p.cantidad_a_pedir}</strong></span>
                              <span>Ventas 30d: <strong>{p.ventas_30_dias}</strong></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-gray-700 text-sm">Bs. {Number(p.precio_venta).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">costo: Bs. {Number(p.precio_costo).toFixed(2)}</p>
                          </div>
                        </div>
                        {p.proveedor_sugerido && (
                          <div className="mt-3 bg-white/70 rounded-xl p-2.5 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-gray-700">📦 {p.proveedor_sugerido}</p>
                              <div className="flex gap-3 mt-0.5">
                                {p.telefono_proveedor && <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone size={9}/>{p.telefono_proveedor}</p>}
                                {p.email_proveedor && <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><Mail size={9}/>{p.email_proveedor}</p>}
                              </div>
                            </div>
                            <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">
                              Pedir {p.cantidad_a_pedir} ud.
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
 
              {/* Insumos grooming */}
              {tabInv === "insumos" && (
                dataInv.insumos_grooming.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                    <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-semibold">Todos los insumos tienen stock suficiente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dataInv.insumos_grooming.map(p => (
                      <div key={p.id_producto}
                        className={`rounded-2xl border-2 p-4 ${STOCK_COLOR[p.estado_stock] || "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-gray-800">{p.nombre}</p>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${p.estado_stock === "agotado" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"}`}>
                                {p.estado_stock === "agotado" ? "🔴 AGOTADO" : "🟡 BAJO STOCK"}
                              </span>
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.especie_aplicable}</span>
                            </div>
                            <p className="text-xs text-gray-500 capitalize mt-0.5">{p.categoria}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs">
                              <span>Stock: <strong className={p.estado_stock === "agotado" ? "text-red-700" : "text-amber-700"}>{p.stock_actual}</strong></span>
                              <span>Mínimo: <strong>{p.stock_minimo}</strong></span>
                              <span>Consumo 30d: <strong>{Number(p.consumo_30_dias).toFixed(1)}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function RecepcionPage() {
  const { user, logout, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [avisoTimeout, setAvisoTimeout] = useState(false)
  const [tabPrincipal, setTabPrincipal] = useState<"citas"|"reportes">("citas")

  const [fechaSeleccionada, setFechaSeleccionada] = useState(formatFecha(new Date()))
  const [citas, setCitas] = useState<Cita[]>([])
  const [citasPorFecha, setCitasPorFecha] = useState<Record<string, number>>({})
  const [groomers, setGroomers] = useState<Groomer[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")

  // Modales
  const [citaDetalle, setCitaDetalle] = useState<Cita | null>(null)
  const [accionando, setAccionando] = useState<number | null>(null)
  const [groomerSeleccionado, setGroomerSeleccionado] = useState<number | "">("")
  const [filtroEstado, setFiltroEstado] = useState("todos")

  // Modal reprogramar
  const [modalReprogramar, setModalReprogramar] = useState(false)
  const [nuevaFechaRep, setNuevaFechaRep] = useState("")
  const [nuevaHoraRep, setNuevaHoraRep] = useState("")
  const [groomerRep, setGroomerRep] = useState<number | "">("")
  const [slotsRep, setSlotsRep] = useState<any[]>([])
  const [cargandoSlots, setCargandoSlots] = useState(false)

  // Modal crear cita (recepción)
  const [modalCrear, setModalCrear] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState("")
  const [clientesFound, setClientesFound] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [mascotasCliente, setMascotasCliente] = useState<Mascota[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [formCita, setFormCita] = useState({
    id_mascota: "", id_servicio: "", fecha: "", hora: "", id_groomer: "", notas: ""
  })
  const [slotsCrear, setSlotsCrear] = useState<any[]>([])
  const [creando, setCreando] = useState(false)

  useSessionTimeout({
    onAviso: () => setAvisoTimeout(true),
    onExpirado: () => { logout(); router.replace("/login?razon=inactividad") },
  })

  useEffect(() => {
    if (!isLoading && (!user || !["admin", "recepcionista"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const mostrarExito = (msg: string) => { setExito(msg); setTimeout(() => setExito(""), 3000) }

  // Cargar groomers y servicios al montar
  useEffect(() => {
    if (!user) return
    fetch("/api/groomers", { headers: authHeaders() })
      .then(r => r.json()).then(d => setGroomers(d.groomers || [])).catch(() => {})
    fetch("/api/servicios", { headers: authHeaders() })
      .then(r => r.json()).then(d => setServicios(d.servicios || [])).catch(() => {})
  }, [user, authHeaders])

  // Cargar TODAS las citas (para calendario)
  const cargarTodasCitas = useCallback(async () => {
    try {
      const res = await fetch("/api/citas", { headers: authHeaders() })
      const d = await res.json()
      const conteo: Record<string, number> = {}
      ;(d.citas || []).forEach((c: Cita) => {
        if (!["cancelada", "no_asistio"].includes(c.estado_reserva)) {
          const f = c.fecha_programada.slice(0, 10)
          conteo[f] = (conteo[f] || 0) + 1
        }
      })
      setCitasPorFecha(conteo)
    } catch {}
  }, [authHeaders])

  // Cargar citas del día
  const cargarCitas = useCallback(async (fecha: string) => {
    setCargando(true); setError("")
    try {
      const res = await fetch(`/api/citas?fecha=${fecha}`, { headers: authHeaders() })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setCitas(d.citas || [])
    } catch (e: any) { setError(e.message || "Error al cargar citas") }
    finally { setCargando(false) }
  }, [authHeaders])

  useEffect(() => { if (user) { cargarTodasCitas(); cargarCitas(fechaSeleccionada) } }, [user])
  useEffect(() => { if (user) cargarCitas(fechaSeleccionada) }, [fechaSeleccionada])

  const refrescar = async () => { await cargarCitas(fechaSeleccionada); await cargarTodasCitas() }

  // ── Cambiar estado ─────────────────────────────────────────────────────
  const cambiarEstado = async (idCita: number, nuevoEstado: string, extra?: any) => {
    setAccionando(idCita); setError("")
    try {
      const body: any = { estado_reserva: nuevoEstado, ...extra }
      if (nuevoEstado === "confirmada" && groomerSeleccionado) body.id_groomer = groomerSeleccionado
      const res = await fetch(`/api/citas/${idCita}`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      mostrarExito(d.message)
      await refrescar()
      setCitaDetalle(null); setGroomerSeleccionado(""); setModalReprogramar(false)
    } catch (e: any) { setError(e.message) }
    finally { setAccionando(null) }
  }

  // ── Drag & drop — reprogramar ──────────────────────────────────────────
  const handleDropCita = async (idCita: number, nuevaFecha: string) => {
    const cita = citas.find(c => c.id_cita === idCita)
    if (!cita) return
    if (cita.fecha_programada.slice(0, 10) === nuevaFecha) return
    // Abrir modal de reprogramar con nueva fecha ya fijada
    setCitaDetalle(cita)
    setNuevaFechaRep(nuevaFecha)
    setNuevaHoraRep("")
    setModalReprogramar(true)
    cargarSlotsRep(nuevaFecha, cita)
  }

  const cargarSlotsRep = async (fecha: string, cita: Cita) => {
    if (!cita) return
    // Necesitamos id_servicio e id_mascota — si no están en la cita, no podemos cargar slots
    const idServicio = cita.id_servicio
    const idMascota  = cita.id_mascota
    if (!idServicio || !idMascota) {
      setSlotsRep([])
      return
    }
    setCargandoSlots(true); setSlotsRep([])
    try {
      const res = await fetch(
        `/api/slots?fecha=${fecha}&id_servicio=${idServicio}&id_mascota=${idMascota}`,
        { headers: authHeaders() }
      )
      const d = await res.json()
      setSlotsRep((d.slots || []).map((s: any) => ({
        ...s, hora_inicio: s.hora_inicio?.slice(0,5), hora_fin: s.hora_fin?.slice(0,5)
      })))
    } catch {}
    finally { setCargandoSlots(false) }
  }

  // ── Buscar cliente para crear cita ────────────────────────────────────
  const buscarClientes = async (q: string) => {
    if (q.length < 2) { setClientesFound([]); return }
    try {
      const res = await fetch(`/api/admin/clientes?q=${q}`, { headers: authHeaders() })
      const d = await res.json()
      setClientesFound(d.clientes || [])
    } catch {}
  }

  const seleccionarCliente = async (c: Cliente) => {
    setClienteSeleccionado(c); setClientesFound([])
    setBusquedaCliente(`${c.nombre} ${c.apellido}`)
    // Cargar mascotas
    try {
      const res = await fetch(`/api/mascotas?id_cliente=${c.id_usuario}`, { headers: authHeaders() })
      const d = await res.json()
      setMascotasCliente(d.mascotas || [])
    } catch {}
  }

  const cargarSlotsCrear = async (fecha: string, idServicio: string, idMascota: string) => {
    if (!fecha || !idServicio || !idMascota) return
    try {
      const res = await fetch(
        `/api/slots?fecha=${fecha}&id_servicio=${idServicio}&id_mascota=${idMascota}`,
        { headers: authHeaders() }
      )
      const d = await res.json()
      setSlotsCrear((d.slots || []).map((s: any) => ({
        ...s, hora_inicio: s.hora_inicio?.slice(0,5), hora_fin: s.hora_fin?.slice(0,5)
      })))
    } catch {}
  }

  const crearCita = async () => {
    const { id_mascota, id_servicio, fecha, hora, id_groomer, notas } = formCita
    if (!id_mascota || !id_servicio || !fecha || !hora) {
      setError("Completa mascota, servicio, fecha y hora"); return
    }
    setCreando(true); setError("")
    try {
      const res = await fetch("/api/citas", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          id_mascota: Number(id_mascota),
          id_servicio: Number(id_servicio),
          fecha_programada: fecha,
          hora_programada: hora,
          canal_reserva: "presencial",
          notas,
          id_cliente: clienteSeleccionado?.id_usuario,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)

      // Si hay groomer, asignar directo
      if (id_groomer && d.id_cita) {
        await fetch(`/api/citas/${d.id_cita}`, {
          method: "PATCH", headers: authHeaders(),
          body: JSON.stringify({ estado_reserva: "confirmada", id_groomer: Number(id_groomer) }),
        })
      }

      mostrarExito("Cita creada y confirmada exitosamente")
      setModalCrear(false)
      setFormCita({ id_mascota: "", id_servicio: "", fecha: "", hora: "", id_groomer: "", notas: "" })
      setClienteSeleccionado(null); setBusquedaCliente(""); setMascotasCliente([])
      await refrescar()
    } catch (e: any) { setError(e.message) }
    finally { setCreando(false) }
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <PawPrint className="w-10 h-10 text-teal-400 animate-bounce" />
    </div>
  )

  const citasFiltradas = filtroEstado === "todos" ? citas : citas.filter(c => c.estado_reserva === filtroEstado)
  const pendientes  = citas.filter(c => c.estado_reserva === "pendiente").length
  const confirmadas = citas.filter(c => c.estado_reserva === "confirmada").length

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');`}</style>

      {/* Aviso timeout */}
      {avisoTimeout && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Bell size={18} />
          <span className="font-semibold text-sm">Sesión expirará en 1 minuto.</span>
          <button onClick={() => setAvisoTimeout(false)} className="underline text-sm">Continuar</button>
        </div>
      )}

      {/* ── Modal reprogramar ── */}
      {modalReprogramar && citaDetalle && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-800">Reprogramar cita #{citaDetalle.id_cita}</h3>
              <button onClick={() => { setModalReprogramar(false); setCitaDetalle(null); setGroomerRep("") }} className="text-gray-400 hover:text-gray-600"><XCircle size={22} /></button>
            </div>
            <div className="bg-violet-50 rounded-xl p-3 text-sm">
              <p className="font-bold text-gray-800">{citaDetalle.nombre_mascota} · {citaDetalle.nombre_servicio}</p>
              <p className="text-gray-500 text-xs">Fecha actual: {citaDetalle.fecha_programada?.slice(0,10)} {citaDetalle.hora_programada?.slice(0,5)}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nueva fecha</label>
              <input type="date" value={nuevaFechaRep}
                min={formatFecha(new Date())}
                onChange={e => { setNuevaFechaRep(e.target.value); setNuevaHoraRep(""); cargarSlotsRep(e.target.value, citaDetalle) }}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm"
              />
            </div>

            {nuevaFechaRep && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Nueva hora</label>
                {cargandoSlots ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                    {slotsRep.filter(s => s.disponible).map((s, i) => (
                      <button key={i}
                        onClick={() => setNuevaHoraRep(s.hora_inicio)}
                        className={`py-2 rounded-xl text-xs font-bold border-2 transition ${nuevaHoraRep === s.hora_inicio ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 hover:border-violet-300 text-gray-700"}`}
                      >
                        {s.hora_inicio}
                      </button>
                    ))}
                    {slotsRep.filter(s => s.disponible).length === 0 && !cargandoSlots && (
                      <p className="col-span-4 text-center text-gray-400 text-xs py-3">Sin horarios disponibles</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selector de groomer */}
            {nuevaHoraRep && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
                  <UserCheck size={12} /> Asignar groomer
                  <span className="text-gray-400 font-normal">(si no asignas quedará pendiente)</span>
                </label>
                <select value={groomerRep}
                  onChange={e => setGroomerRep(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none text-sm bg-white">
                  <option value="">Sin asignar — quedará pendiente</option>
                  {groomers.map(g => (
                    <option key={g.id_trabajador} value={g.id_trabajador}>
                      {g.nombre} {g.apellido} — {g.especialidad}
                    </option>
                  ))}
                </select>
                {groomerRep ? (
                  <p className="text-xs text-green-600 font-semibold mt-1">✓ Se confirmará y asignará el groomer</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Sin groomer, quedará en estado pendiente para confirmar luego</p>
                )}
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs flex items-center gap-2"><AlertCircle size={13}/>{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => { setModalReprogramar(false); setCitaDetalle(null); setGroomerRep("") }}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button
                disabled={!nuevaFechaRep || !nuevaHoraRep || !!accionando}
                onClick={() => {
                  const estadoFinal = groomerRep ? "confirmada" : "pendiente"
                  cambiarEstado(citaDetalle.id_cita, estadoFinal, {
                    nueva_fecha: nuevaFechaRep,
                    nueva_hora:  nuevaHoraRep,
                    ...(groomerRep ? { id_groomer: groomerRep } : {}),
                  })
                  setGroomerRep("")
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {accionando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {groomerRep ? "Reprogramar y confirmar" : "Reprogramar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear cita ── */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl my-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-800 flex items-center gap-2"><CalendarPlus size={18} className="text-teal-600" /> Nueva cita</h3>
              <button onClick={() => { setModalCrear(false); setError("") }} className="text-gray-400 hover:text-gray-600"><XCircle size={22} /></button>              
            </div>

            {/* Buscar cliente */}
            <div className="relative">
              <label className="block text-xs font-bold text-gray-600 mb-1">Buscar cliente *</label>
              <input type="text" placeholder="Nombre, apellido o email..."
                value={busquedaCliente}
                onChange={e => { setBusquedaCliente(e.target.value); buscarClientes(e.target.value) }}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
              />
              {clientesFound.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border-2 border-gray-200 rounded-xl mt-1 shadow-lg max-h-40 overflow-y-auto">
                  {clientesFound.map(c => (
                    <button key={c.id_usuario} onClick={() => seleccionarCliente(c)}
                      className="w-full px-3 py-2 text-left hover:bg-teal-50 text-sm font-semibold text-gray-700 border-b border-gray-100 last:border-0">
                      {c.nombre} {c.apellido} <span className="text-gray-400 font-normal">· {c.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteSeleccionado && (
                <p className="text-xs text-teal-600 font-semibold mt-1">✓ {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</p>
              )}
            </div>

            {/* Mascota */}
            {mascotasCliente.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Mascota *</label>
                <select value={formCita.id_mascota}
                  onChange={e => {
                    setFormCita(p => ({ ...p, id_mascota: e.target.value, hora: "" }))
                    if (formCita.id_servicio && formCita.fecha)
                      cargarSlotsCrear(formCita.fecha, formCita.id_servicio, e.target.value)
                  }}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm bg-white">
                  <option value="">Selecciona mascota</option>
                  {mascotasCliente.map(m => (
                    <option key={m.id_mascota} value={m.id_mascota}>
                      {m.especie === "perro" ? "🐶" : m.especie === "gato" ? "🐱" : "🐾"} {m.nombre} ({m.tamanio})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Servicio */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Servicio *</label>
              <select value={formCita.id_servicio}
                onChange={e => {
                    setFormCita(p => ({ ...p, id_servicio: e.target.value, hora: "" }))
                    setSlotsCrear([])
                    if (formCita.id_mascota && formCita.fecha)
                      cargarSlotsCrear(formCita.fecha, e.target.value, formCita.id_mascota)
                  }}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm bg-white">
                <option value="">Selecciona servicio</option>
                {servicios.map(s => (
                  <option key={s.id_servicio} value={s.id_servicio}>{s.nombre} ({s.duracion_base}min) — Bs.{s.precio}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={formCita.fecha}
                min={formatFecha(new Date())}
                onChange={e => {
                  setFormCita(p => ({ ...p, fecha: e.target.value, hora: "" }))
                  if (formCita.id_servicio && formCita.id_mascota)
                    cargarSlotsCrear(e.target.value, formCita.id_servicio, formCita.id_mascota)
                }}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm"
              />
            </div>

            {/* Slots */}
            {slotsCrear.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Hora disponible *</label>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                  {slotsCrear.filter(s => s.disponible).map((s, i) => (
                    <button key={i}
                      onClick={() => setFormCita(p => ({ ...p, hora: s.hora_inicio }))}
                      className={`py-2 rounded-xl text-xs font-bold border-2 transition ${formCita.hora === s.hora_inicio ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 hover:border-teal-300 text-gray-700"}`}
                    >
                      {s.hora_inicio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Groomer */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
                <UserCheck size={12} /> Asignar groomer (opcional)
              </label>
              <select value={formCita.id_groomer}
                onChange={e => setFormCita(p => ({ ...p, id_groomer: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm bg-white">
                <option value="">Sin asignar por ahora</option>
                {groomers.map(g => (
                  <option key={g.id_trabajador} value={g.id_trabajador}>{g.nombre} {g.apellido}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Notas</label>
              <textarea rows={2} placeholder="Observaciones adicionales..."
                value={formCita.notas}
                onChange={e => setFormCita(p => ({ ...p, notas: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setModalCrear(false); setError("") }}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={crearCita} disabled={creando}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition flex items-center justify-center gap-2">
                {creando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Crear y confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle de cita ── */}
      {citaDetalle && !modalReprogramar && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-gray-800 text-lg">Cita #{citaDetalle.id_cita}</h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${ESTADO_COLORES[citaDetalle.estado_reserva] || "bg-gray-100 text-gray-500"}`}>
                  {citaDetalle.estado_reserva}
                </span>
              </div>
              <button onClick={() => { setCitaDetalle(null); setGroomerSeleccionado("") }} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              {[
                ["Cliente",  citaDetalle.nombre_cliente],
                ["Teléfono", citaDetalle.telefono_cliente || "—"],
                ["Mascota",  `${citaDetalle.nombre_mascota} (${citaDetalle.tamanio})`],
                ["Servicio", citaDetalle.nombre_servicio],
                ["Fecha",    new Date(citaDetalle.fecha_programada + "T00:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })],
                ["Hora",     citaDetalle.hora_programada?.slice(0, 5)],
                ["Duración", `${citaDetalle.duracion_ajustada ?? "—"} min`],
                ["Groomer",  citaDetalle.nombre_groomer || "Sin asignar"],
                ["Precio",   `Bs. ${Number(citaDetalle.precio_calculado ?? 0).toFixed(2)}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold text-gray-800 text-right">{val}</span>
                </div>
              ))}
              {citaDetalle.notas && (
                <div className="py-2">
                  <p className="text-gray-500 mb-1 text-xs">Notas:</p>
                  <p className="text-gray-700 bg-amber-50 rounded-lg px-3 py-2 text-xs">{citaDetalle.notas}</p>
                </div>
              )}
            </div>

            {/* Selector groomer al confirmar */}
            {citaDetalle.estado_reserva === "pendiente" && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
                  <UserCheck size={12} /> Asignar groomer (opcional)
                </label>
                <select value={groomerSeleccionado}
                  onChange={e => setGroomerSeleccionado(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-teal-400 outline-none text-sm bg-white">
                  <option value="">Sin asignar por ahora</option>
                  {groomers.map(g => (
                    <option key={g.id_trabajador} value={g.id_trabajador}>{g.nombre} {g.apellido} — {g.especialidad}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-700 text-xs mb-3 flex items-center gap-2">
                <AlertCircle size={13} /> {error}
                <button onClick={() => setError("")} className="ml-auto">✕</button>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 flex-wrap">
              {["pendiente", "confirmada", "reprogramada"].includes(citaDetalle.estado_reserva) && (
                <button
                  onClick={() => { setNuevaFechaRep(""); setNuevaHoraRep(""); setSlotsRep([]); setModalReprogramar(true) }}
                  className="flex-1 py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition"
                >
                  <Move size={14} /> Reprogramar
                </button>
              )}
              {citaDetalle.estado_reserva === "pendiente" && (
                <>
                  <button onClick={() => cambiarEstado(citaDetalle.id_cita, "confirmada")}
                    disabled={!!accionando}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                    {accionando === citaDetalle.id_cita ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Confirmar
                  </button>
                  <button onClick={() => cambiarEstado(citaDetalle.id_cita, "cancelada")}
                    disabled={!!accionando}
                    className="py-2.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl text-sm disabled:opacity-50 transition">
                    <XCircle size={16} />
                  </button>
                </>
              )}
              {citaDetalle.estado_reserva === "confirmada" && (
                <>
                  <button onClick={() => cambiarEstado(citaDetalle.id_cita, "en_proceso")}
                    disabled={!!accionando}
                    className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                    {accionando === citaDetalle.id_cita ? <Loader2 size={14} className="animate-spin" /> : "🐾"}
                    En proceso
                  </button>
                  <button onClick={() => cambiarEstado(citaDetalle.id_cita, "cancelada")}
                    disabled={!!accionando}
                    className="py-2.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl text-sm disabled:opacity-50 transition">
                    <XCircle size={16} />
                  </button>
                </>
              )}
              {citaDetalle.estado_reserva === "en_proceso" && (
                <button onClick={() => cambiarEstado(citaDetalle.id_cita, "completada")}
                  disabled={!!accionando}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                  {accionando === citaDetalle.id_cita ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Completada
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <header className="bg-gradient-to-r from-teal-600 to-emerald-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-white" />
            <span className="text-white font-black text-lg">Panel <span className="text-teal-200">Recepción</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModalCrear(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-1.5 rounded-xl transition">
              <CalendarPlus size={16} /> Nueva cita
            </button>
            <button onClick={() => setTabPrincipal(t => t === "reportes" ? "citas" : "reportes")}
               className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-1.5 rounded-xl transition">
              <FileText size={16}/> Reportes
            </button>
            <button onClick={() => router.push("/recepcion/registrar")}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-3 py-1.5 rounded-xl transition">
              <Plus size={16} /> Cliente
            </button>
            <span className="text-white/80 text-sm font-medium hidden sm:block">{user.nombre}</span>
            <button onClick={() => { logout(); router.push("/login") }} className="text-white/70 hover:text-white">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
    {tabPrincipal === "citas" && (
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Alertas */}
        {error && !citaDetalle && !modalReprogramar && !modalCrear && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError("")} className="ml-auto"><XCircle size={14} /></button>
          </div>
        )}
        {exito && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> {exito}
          </div>
        )}

        {/* Stats */}
        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-3xl p-5 text-white">
          <h1 className="text-xl font-black mb-1">Hola, {user.nombre} 👋</h1>
          <p className="text-teal-100 text-xs mb-4">
            {new Date(fechaSeleccionada + "T00:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black">{citas.length}</p>
              <p className="text-xs text-teal-100">Total día</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-amber-300">{pendientes}</p>
              <p className="text-xs text-teal-100">Pendientes</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-2xl font-black text-green-300">{confirmadas}</p>
              <p className="text-xs text-teal-100">Confirmadas</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna izquierda: Calendario */}
          <div className="lg:col-span-1 space-y-4">
            <CalendarioMaestro
              fechaSeleccionada={fechaSeleccionada}
              onSelect={(f) => { setFechaSeleccionada(f); setFiltroEstado("todos") }}
              citasPorFecha={citasPorFecha}
              onDropCita={handleDropCita}
            />
            <div className="space-y-2">
              {[
                { icon: Users, label: "Registrar cliente", color: "text-blue-600 bg-blue-50 border-blue-200", action: () => router.push("/recepcion/registrar") },
                { icon: Lock, label: "Horarios y bloqueos", color: "text-orange-600 bg-orange-50 border-orange-200", action: () => router.push("/recepcion/horario") },
                { icon: Bell, label: "Notificaciones", color: "text-amber-600 bg-amber-50 border-amber-200", action: () => alert("Próximamente") },
              ].map(({ icon: Icon, label, color, action }) => (
                <button key={label} onClick={action}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 ${color} transition hover:scale-[1.01] hover:shadow-sm text-left`}>
                  <Icon size={18} />
                  <span className="font-bold text-sm text-gray-700">{label}</span>
                  <ChevronRight size={14} className="text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Columna derecha: Lista citas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800">
                Citas — {new Date(fechaSeleccionada + "T00:00:00").toLocaleDateString("es-BO", { day: "numeric", month: "short" })}
              </h2>
              <div className="flex items-center gap-2">
                <select value={filtroEstado}
                  onChange={e => setFiltroEstado(e.target.value)}
                  className="text-xs border-2 border-gray-200 rounded-xl px-2 py-1.5 outline-none focus:border-teal-400 bg-white font-semibold text-gray-600">
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="confirmada">Confirmadas</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="completada">Completadas</option>
                  <option value="reprogramada">Reprogramadas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
                <button onClick={refrescar} className="text-teal-600 hover:text-teal-800 transition p-1.5 border-2 border-gray-200 rounded-xl hover:border-teal-300">
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            {cargando ? (
              <div className="bg-white rounded-2xl p-12 flex items-center justify-center gap-3 text-teal-500">
                <Loader2 className="animate-spin" size={24} />
                <span className="font-semibold">Cargando citas...</span>
              </div>
            ) : citasFiltradas.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200">
                <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-semibold">Sin citas para este día</p>
                <button onClick={() => setModalCrear(true)}
                  className="mt-3 text-teal-600 text-sm font-bold hover:underline flex items-center gap-1 mx-auto">
                  <CalendarPlus size={14} /> Crear nueva cita
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {citasFiltradas
                  .sort((a, b) => a.hora_programada.localeCompare(b.hora_programada))
                  .map(cita => (
                    <div key={cita.id_cita}
                      draggable={["pendiente","confirmada","reprogramada"].includes(cita.estado_reserva)}
                      onDragStart={e => {
                        e.dataTransfer.setData("idCita", String(cita.id_cita))
                        e.dataTransfer.effectAllowed = "move"
                      }}
                      className={`bg-white rounded-2xl border-2 border-gray-100 hover:border-teal-300 p-4 transition-all hover:shadow-md flex items-center gap-4 ${["pendiente","confirmada","reprogramada"].includes(cita.estado_reserva) ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 ${ESTADO_DOT[cita.estado_reserva] || "bg-gray-300"}`} />
                      <div className="shrink-0 w-12 text-center">
                        <p className="font-black text-teal-700 text-base leading-none">{cita.hora_programada?.slice(0, 5)}</p>
                        <p className="text-[10px] text-gray-400">{cita.duracion_ajustada ?? ""}m</p>
                      </div>
                      <div className="w-px h-10 bg-gray-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 truncate">
                          {cita.nombre_mascota || "—"}
                          <span className="text-gray-400 font-normal text-xs ml-1">· {cita.nombre_cliente}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">{cita.nombre_servicio} · {cita.especie} {cita.tamanio}</p>
                        {cita.nombre_groomer && <p className="text-xs text-teal-600 font-semibold mt-0.5">✂️ {cita.nombre_groomer}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${ESTADO_COLORES[cita.estado_reserva] || "bg-gray-100 text-gray-500"}`}>
                        {cita.estado_reserva}
                      </span>
                      <button onClick={() => setCitaDetalle(cita)} className="text-gray-400 hover:text-teal-600 shrink-0">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>)}
      {tabPrincipal === "reportes" && <TabReportes authHeaders={authHeaders} />}


    </div>
  )
}