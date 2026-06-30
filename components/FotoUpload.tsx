"use client"
// components/FotoUpload.tsx
// Componente reutilizable para subir fotos a Cloudinary
// Uso: <FotoUpload label="Foto antes" onUpload={(url) => setFotoUrl(url)} />

import { useState, useRef } from "react"
import { Camera, Upload, X, Loader2, CheckCircle } from "lucide-react"

interface FotoUploadProps {
  label: string
  urlActual?: string
  onUpload: (url: string) => void
  folder?: string  // subcarpeta en Cloudinary (opcional)
}

export default function FotoUpload({ label, urlActual, onUpload, folder = "fichas" }: FotoUploadProps) {
  const [subiendo, setSubiendo] = useState(false)
  const [preview, setPreview] = useState<string | null>(urlActual || null)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

  const handleFile = async (file: File) => {
    // Validar tipo y tamaño
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes"); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen no puede superar 10MB"); return
    }

    setError("")
    setSubiendo(true)

    // Preview local inmediato
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", UPLOAD_PRESET)
      formData.append("folder", `spa_mascotas/${folder}`)

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      )

      if (!res.ok) throw new Error("Error al subir la imagen")

      const data = await res.json()
      const url: string = data.secure_url

      setPreview(url)
      onUpload(url)         // ← devuelve la URL final al componente padre
    } catch (e: any) {
      setError(e.message || "Error al subir")
      setPreview(urlActual || null)
    } finally {
      setSubiendo(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const limpiar = () => {
    setPreview(null)
    onUpload("")
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-gray-500 flex items-center gap-1">
        <Camera size={11} /> {label}
      </label>

      {/* Zona de drop / botón subir */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-rose-400 rounded-xl p-5 text-center cursor-pointer transition-all hover:bg-rose-50 group"
        >
          <Upload size={24} className="text-gray-300 group-hover:text-rose-400 mx-auto mb-2 transition-colors" />
          <p className="text-xs text-gray-400 group-hover:text-rose-500 font-semibold transition-colors">
            Haz clic o arrastra una foto aquí
          </p>
          <p className="text-[10px] text-gray-300 mt-1">JPG, PNG, WEBP — máx. 10MB</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
          {/* Preview de la imagen */}
          <img
            src={preview}
            alt={label}
            className="w-full h-40 object-cover"
          />

          {/* Overlay mientras sube */}
          {subiendo && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 size={28} className="animate-spin mx-auto mb-1" />
                <p className="text-xs font-bold">Subiendo...</p>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          {!subiendo && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button
                onClick={() => inputRef.current?.click()}
                className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow text-gray-600 hover:text-rose-600 transition"
                title="Cambiar foto"
              >
                <Camera size={14} />
              </button>
              <button
                onClick={limpiar}
                className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow text-gray-600 hover:text-red-600 transition"
                title="Eliminar foto"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Badge de subida exitosa */}
          {!subiendo && preview && !preview.startsWith("blob:") && (
            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle size={10} /> Guardada en Cloudinary
            </div>
          )}
        </div>
      )}

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
          ⚠️ {error}
        </p>
      )}
    </div>
  )
}