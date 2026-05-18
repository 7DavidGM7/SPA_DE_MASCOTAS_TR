import { Pool } from 'pg'
import crypto from 'crypto'

// Configuracion de conexion a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Interfaz que coincide EXACTAMENTE con tu tabla "usuario" existente
export interface Usuario {
  id_usuario: number
  ci: string
  nombre: string
  apellido: string
  telefono: string | null
  email: string
  password_hash: string
  salt: string
  estado: 'activo' | 'inactivo' | 'bloqueado'
  fecha_registro: Date
  // Columnas nuevas para bloqueo por intentos fallidos
  rol: string   // ← agregar esta línea
  intentos_fallidos: number
  bloqueado_hasta: Date | null
}

// Interfaz para tokens de verificacion (tabla nueva que se creara)
export interface TokenVerificacion {
  id_token: number
  id_usuario: number
  token: string
  tipo: 'email' | 'password_reset'
  expira_en: Date
  usado: boolean
  created_at: Date
}

// Funcion para hashear contraseña con salt (compatible con tu esquema)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, useSalt, 10000, 64, 'sha512').toString('hex')
  return { hash, salt: useSalt }
}

// Funcion para verificar contraseña
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt)
  return computedHash === hash
}

export const db = {
  // Test de conexion
  testConnection: async (): Promise<boolean> => {
    try {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      console.error('[v0] Error de conexion a PostgreSQL:', error)
      return false
    }
  },

  // Inicializar tabla de tokens (solo esta tabla es nueva)
  initTokensTable: async (): Promise<boolean> => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tokens_verificacion (
          id_token SERIAL PRIMARY KEY,
          id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
          token VARCHAR(6) NOT NULL,
          tipo VARCHAR(20) DEFAULT 'email' CHECK (tipo IN ('email', 'password_reset')),
          expira_en TIMESTAMP NOT NULL,
          usado BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens_verificacion(id_usuario);
        CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens_verificacion(token);
      `)
      return true
    } catch (error) {
      console.error('[v0] Error al crear tabla de tokens:', error)
      return false
    }
  },

  usuarios: {
    findByEmail: async (email: string): Promise<Usuario | null> => {
      try {
        const result = await pool.query(
          'SELECT * FROM usuario WHERE LOWER(email) = LOWER($1)',
          [email]
        )
        return result.rows[0] || null
      } catch (error) {
        console.error('[v0] Error al buscar usuario por email:', error)
        return null
      }
    },

    findByCi: async (ci: string): Promise<Usuario | null> => {
      try {
        const result = await pool.query(
          'SELECT * FROM usuario WHERE ci = $1',
          [ci]
        )
        return result.rows[0] || null
      } catch (error) {
        console.error('[v0] Error al buscar usuario por CI:', error)
        return null
      }
    },

    findById: async (id: number): Promise<Usuario | null> => {
      try {
        const result = await pool.query(
          'SELECT * FROM usuario WHERE id_usuario = $1',
          [id]
        )
        return result.rows[0] || null
      } catch (error) {
        console.error('[v0] Error al buscar usuario por ID:', error)
        return null
      }
    },

    create: async (data: {
      ci: string
      nombre: string
      apellido: string
      email: string
      telefono?: string
      password: string
    }): Promise<Usuario | null> => {
      try {
        const { hash, salt } = hashPassword(data.password)
        
        const result = await pool.query(
          `INSERT INTO usuario (ci, nombre, apellido, email, telefono, password_hash, salt, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'inactivo')
           RETURNING *`,
          [
            data.ci,
            data.nombre,
            data.apellido,
            data.email.toLowerCase(),
            data.telefono || null,
            hash,
            salt
          ]
        )
        return result.rows[0]
      } catch (error) {
        console.error('[v0] Error al crear usuario:', error)
        return null
      }
    },

    activar: async (id: number): Promise<boolean> => {
      try {
        await pool.query(
          `UPDATE usuario SET estado = 'activo' WHERE id_usuario = $1`,
          [id]
        )
        return true
      } catch (error) {
        console.error('[v0] Error al activar usuario:', error)
        return false
      }
    },

    bloquear: async (id: number): Promise<boolean> => {
      try {
        await pool.query(
          `UPDATE usuario SET estado = 'bloqueado' WHERE id_usuario = $1`,
          [id]
        )
        return true
      } catch (error) {
        console.error('[v0] Error al bloquear usuario:', error)
        return false
      }
    },

    desbloquear: async (id: number): Promise<boolean> => {
      try {
        await pool.query(
          `UPDATE usuario SET estado = 'activo' WHERE id_usuario = $1`,
          [id]
        )
        return true
      } catch (error) {
        console.error('[v0] Error al desbloquear usuario:', error)
        return false
      }
    },

    // ── NUEVOS: control de intentos fallidos ─────────────────────────────────

    incrementarIntentosFallidos: async (id: number, intentos: number): Promise<void> => {
      try {
        await pool.query(
          `UPDATE usuario SET intentos_fallidos = $1 WHERE id_usuario = $2`,
          [intentos, id]
        )
      } catch (error) {
        console.error('[login] Error al incrementar intentos fallidos:', error)
      }
    },

    bloquearTemporalmente: async (id: number, hasta: Date, intentos: number): Promise<void> => {
      try {
        await pool.query(
          `UPDATE usuario SET intentos_fallidos = $1, bloqueado_hasta = $2 WHERE id_usuario = $3`,
          [intentos, hasta, id]
        )
      } catch (error) {
        console.error('[login] Error al bloquear usuario temporalmente:', error)
      }
    },

    resetIntentosFallidos: async (id: number): Promise<void> => {
      try {
        await pool.query(
          `UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = $1`,
          [id]
        )
      } catch (error) {
        console.error('[login] Error al resetear intentos fallidos:', error)
      }
    },

    findByRefreshToken: async (refreshToken: string): Promise<Usuario | null> => {
      try {
        const parts = refreshToken.split('.')
        if (parts.length !== 3) return null
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        const userId = payload.userId || payload.id
        if (!userId) return null
        return await db.usuarios.findById(Number(userId))
      } catch (error) {
        console.error('[v0] Error en findByRefreshToken:', error)
        return null
      }
    },
  },

  tokens: {
    crear: async (idUsuario: number, tipo: 'email' | 'password_reset' = 'email'): Promise<string | null> => {
      try {
        // Invalidar tokens anteriores del mismo tipo
        await pool.query(
          `UPDATE tokens_verificacion SET usado = TRUE WHERE id_usuario = $1 AND tipo = $2 AND usado = FALSE`,
          [idUsuario, tipo]
        )

        // Generar nuevo token de 6 digitos
        const token = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
        const expiraEn = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

        await pool.query(
          `INSERT INTO tokens_verificacion (id_usuario, token, tipo, expira_en)
          VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
          [idUsuario, token, tipo]
        )

        return token
      } catch (error) {
        console.error('[v0] Error al crear token:', error)
        return null
      }
    },

    verificar: async (email: string, token: string, tipo: 'email' | 'password_reset' = 'email'): Promise<{ success: boolean; message: string; usuario?: Usuario }> => {
      try {
        const usuario = await db.usuarios.findByEmail(email)
        
        if (!usuario) {
          return { success: false, message: 'Usuario no encontrado' }
        }

        if (usuario.estado === 'activo' && tipo === 'email') {
          return { success: false, message: 'La cuenta ya esta verificada' }
        }

        const result = await pool.query(
          `SELECT * FROM tokens_verificacion 
           WHERE id_usuario = $1 AND token = $2 AND tipo = $3 AND usado = FALSE AND expira_en > NOW()
           ORDER BY created_at DESC LIMIT 1`,
          [usuario.id_usuario, token, tipo]
        )

        if (result.rows.length === 0) {
          return { success: false, message: 'Token invalido o expirado' }
        }

        // Marcar token como usado
        await pool.query(
          `UPDATE tokens_verificacion SET usado = TRUE WHERE id_token = $1`,
          [result.rows[0].id_token]
        )

        // Activar usuario si es verificacion de email
        if (tipo === 'email') {
          await db.usuarios.activar(usuario.id_usuario)
        }

        return { success: true, message: 'Token verificado exitosamente', usuario }
      } catch (error) {
        console.error('[v0] Error al verificar token:', error)
        return { success: false, message: 'Error al verificar el token' }
      }
    },

    reenviar: async (email: string): Promise<{ success: boolean; token?: string; message: string }> => {
      try {
        const usuario = await db.usuarios.findByEmail(email)
        
        if (!usuario) {
          return { success: false, message: 'Usuario no encontrado' }
        }

        if (usuario.estado === 'activo') {
          return { success: false, message: 'La cuenta ya esta verificada' }
        }

        const token = await db.tokens.crear(usuario.id_usuario, 'email')
        
        if (!token) {
          return { success: false, message: 'Error al generar nuevo token' }
        }

        return { success: true, token, message: 'Nuevo token generado' }
      } catch (error) {
        console.error('[v0] Error al reenviar token:', error)
        return { success: false, message: 'Error al generar nuevo token' }
      }
    }
  },

  // Para crear cliente asociado al usuario
  clientes: {
    crear: async (idUsuario: number): Promise<boolean> => {
      try {
        await pool.query(
          `INSERT INTO cliente (id_usuario_cliente, acepta_notificaciones) 
           VALUES ($1, TRUE)
           ON CONFLICT (id_usuario_cliente) DO NOTHING`,
          [idUsuario]
        )
        return true
      } catch (error) {
        console.error('[v0] Error al crear cliente:', error)
        return false
      }
    }
  }
}