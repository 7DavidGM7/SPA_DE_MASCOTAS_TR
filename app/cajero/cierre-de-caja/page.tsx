"use client"
// app/cajero/cierre-de-caja/page.tsx
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft, Calendar, RefreshCw, TrendingUp,
  Banknote, CreditCard, QrCode, ArrowLeftRight,
  Loader2, PawPrint, Receipt, CheckCircle, Smartphone
} from "lucide-react"

interface ResumenMetodo {
  metodo_pago: string
  cantidad: number
  total: number
}

interface PagoServicio {
  id_pago: number; nro_factura: string
  nombre_cliente: string; servicio: string; mascota: string
  metodo_pago: string; monto: number; estado: string
}

interface CierreCaja {
  fecha: string
  total_dia: number
  por_metodo: ResumenMetodo[]
  pagos_servicios: PagoServicio[]
  pagos_productos: any[]
  cantidad_total: number
}

const METODO_ICON: Record<string, React.ElementType> = {
  efectivo: Banknote, qr: QrCode, transferencia: ArrowLeftRight,
  tarjeta_debito: CreditCard, tarjeta_credito: CreditCard,
}
const METODO_COLOR: Record<string, string> = {
  efectivo:"bg-green-50 text-green-700 border-green-200",
  qr:"bg-blue-50 text-blue-700 border-blue-200",
  transferencia:"bg-purple-50 text-purple-700 border-purple-200",
  tarjeta_debito:"bg-amber-50 text-amber-700 border-amber-200",
  tarjeta_credito:"bg-rose-50 text-rose-700 border-rose-200",
}
const METODO_LABEL: Record<string, string> = {
  efectivo:"Efectivo", qr:"QR Banco Unión", transferencia:"Transferencia",
  tarjeta_debito:"Tarjeta Débito", tarjeta_credito:"Tarjeta Crédito",
}

export default function CierreCajaPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [fecha, setFecha]           = useState(new Date().toISOString().split("T")[0])
  const [datos, setDatos]           = useState<CierreCaja | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState("")

  useEffect(() => {
    if (!isLoading && (!user || !["admin","cajero"].includes(user.rol)))
      router.replace("/login")
  }, [user, isLoading, router])

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken])

  const cargar = useCallback(async () => {
    setCargando(true); setError("")
    try {
      const res = await fetch(`/api/pagos?fecha=${fecha}`, { headers: authHeaders() })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDatos(d)
    } catch (e: any) {
      setError(e.message || "Error al cargar el cierre")
    } finally { setCargando(false) }
  }, [authHeaders, fecha])

  useEffect(() => { if (user) cargar() }, [user, fecha])

  const imprimirCierre = () => {
    if (!datos) return
    const ventana = window.open("", "_blank")
    if (!ventana) return
    ventana.document.write(`
      <!DOCTYPE html><html><head><title>Cierre de Caja ${datos.fecha}</title>
      <style>
        body{font-family:'Courier New',monospace;max-width:400px;margin:0 auto;padding:20px;font-size:12px}
        .center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:3px 0}
        table{width:100%;border-collapse:collapse;font-size:11px}
        td,th{padding:3px;border-bottom:1px solid #eee;text-align:left}
        th{font-weight:bold}
        @media print{button{display:none}}
      </style></head><body>
      <div class="center"><div style="font-size:18px;font-weight:bold">🐾 SPA MASCOTAS</div>
      <div class="bold">CIERRE DE CAJA</div><div>${datos.fecha}</div></div>
      <div class="line"></div>
      <div class="row"><span>Total del día:</span><span class="bold">Bs. ${Number(datos.total_dia).toFixed(2)}</span></div>
      <div class="row"><span>Transacciones:</span><span>${datos.cantidad_total}</span></div>
      <div class="line"></div>
      <div class="bold">Por método de pago:</div>
      ${datos.por_metodo.map(m=>`
        <div class="row">
          <span>${METODO_LABEL[m.metodo_pago]||m.metodo_pago}</span>
          <span>${m.cantidad} · Bs.${Number(m.total).toFixed(2)}</span>
        </div>`).join("")}
      <div class="line"></div>
      <div class="bold">Detalle de cobros:</div>
      <table><tr><th>Cliente</th><th>Concepto</th><th>Método</th><th>Monto</th></tr>
      ${datos.pagos_servicios.map(p=>`
        <tr><td>${p.nombre_cliente}</td><td>${p.servicio||"Pedido"}</td>
        <td>${METODO_LABEL[p.metodo_pago]||p.metodo_pago}</td><td>Bs.${Number(p.monto).toFixed(2)}</td></tr>`).join("")}
      </table>
      <div class="line"></div>
      <div class="center">Generado el ${new Date().toLocaleString("es-BO")}</div>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;background:#f59e0b;color:white;border:none;border-radius:8px;cursor:pointer;width:100%">
        Imprimir / Guardar PDF
      </button>
      </body></html>
    `)
    ventana.document.close()
    setTimeout(() => ventana.print(), 500)
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <PawPrint className="w-10 h-10 text-amber-400 animate-bounce" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily:"'Nunito',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      <header className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/cajero/punto-de-venta")}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm">
              <ArrowLeft size={18}/><span className="hidden sm:block">Punto de venta</span>
            </button>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-200"/>
              <span className="text-white font-black text-lg">Cierre <span className="text-amber-200">de Caja</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="text-white/80 hover:text-white">
              <RefreshCw size={16} className={cargando ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Selector fecha */}
        <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Calendar className="text-amber-500" size={20}/>
          <label className="text-sm font-bold text-gray-700">Fecha del cierre:</label>
          <input
            type="date" value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
          />
          {datos && (
            <button onClick={imprimirCierre}
              className="ml-auto flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
              <Receipt size={14}/> Imprimir cierre
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-amber-400" size={32}/></div>
        ) : datos ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white col-span-2 md:col-span-1">
                <TrendingUp size={20} className="mb-2 opacity-80"/>
                <p className="text-xs font-semibold opacity-80">Total del día</p>
                <p className="text-3xl font-black">Bs. {Number(datos.total_dia).toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <Receipt size={20} className="text-amber-500 mb-2"/>
                <p className="text-xs text-gray-500 font-semibold">Cobros realizados</p>
                <p className="text-3xl font-black text-gray-800">{datos.cantidad_total}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <CheckCircle size={20} className="text-green-500 mb-2"/>
                <p className="text-xs text-gray-500 font-semibold">Métodos usados</p>
                <p className="text-3xl font-black text-gray-800">{datos.por_metodo.length}</p>
              </div>
            </div>

            {/* Por método */}
            {datos.por_metodo.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-black text-gray-800 mb-4">Resumen por método de pago</h3>
                <div className="space-y-3">
                  {datos.por_metodo.map(m => {
                    const Icon = METODO_ICON[m.metodo_pago] ?? CreditCard
                    return (
                      <div key={m.metodo_pago} className={`flex items-center gap-3 p-3 rounded-xl border ${METODO_COLOR[m.metodo_pago] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
                        <Icon size={18}/>
                        <span className="font-bold text-sm flex-1">{METODO_LABEL[m.metodo_pago] ?? m.metodo_pago}</span>
                        <span className="text-xs">{m.cantidad} cobro{m.cantidad !== 1 ? "s" : ""}</span>
                        <span className="font-black text-base">Bs. {Number(m.total).toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Detalle cobros */}
            {datos.pagos_servicios.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-black text-gray-800">Detalle de cobros — {datos.fecha}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {datos.pagos_servicios.map(p => {
                    const Icon = METODO_ICON[p.metodo_pago] ?? CreditCard
                    return (
                      <div key={p.id_pago} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Icon size={14} className="text-amber-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{p.nombre_cliente}</p>
                          <p className="text-xs text-gray-400">{p.servicio ?? "Pedido"}{p.mascota ? ` — ${p.mascota}` : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-800">Bs. {Number(p.monto).toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400">{p.nro_factura}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {datos.cantidad_total === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <Receipt className="w-14 h-14 text-gray-200 mx-auto mb-3"/>
                <p className="text-gray-500 font-semibold">Sin cobros registrados para esta fecha</p>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}