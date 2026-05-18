import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const isConnected = await db.testConnection()

    if (isConnected) {
      return NextResponse.json(
        { 
          status: "ok",
          database: "connected",
          message: "Conexión a PostgreSQL exitosa"
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { 
          status: "error",
          database: "disconnected",
          message: "No se pudo conectar a PostgreSQL. Verifica la variable DATABASE_URL."
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[v0] Error en health check:", error)
    return NextResponse.json(
      { 
        status: "error",
        database: "error",
        message: "Error al verificar la conexión a la base de datos"
      },
      { status: 500 }
    )
  }
}
