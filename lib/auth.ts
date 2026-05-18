import { SignJWT, jwtVerify } from "jose"
import { randomBytes, createHash } from "crypto"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-change-in-production")
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret-change-in-production")

export type Rol = "admin" | "recepcionista" | "cajero" | "groomer" | "cliente"

export interface JWTPayload {
  userId: string
  email: string
  nombre: string
  apellido: string
  rol: Rol  // ← nuevo
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256").update(password + salt).digest("hex")
  return `${salt}:${hash}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":")
  const verifyHash = createHash("sha256").update(password + salt).digest("hex")
  return hash === verifyHash
}

export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET)
}

export async function generateRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_REFRESH_SECRET)
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex")
}

export function getTokenExpiration(hours: number = 24): Date {
  const expiration = new Date()
  expiration.setHours(expiration.getHours() + hours)
  return expiration
}
