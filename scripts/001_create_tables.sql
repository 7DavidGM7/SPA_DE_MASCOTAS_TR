-- Script para crear las tablas necesarias para Pet Spa
-- Ejecuta este script en pgAdmin 4

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin', 'empleado')),
    verificado BOOLEAN DEFAULT FALSE,
    token_verificacion VARCHAR(6),
    token_verificacion_expira TIMESTAMP,
    refresh_token TEXT,
    refresh_token_expira TIMESTAMP,
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado_hasta TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indice para busquedas por email
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);

-- Indice para busquedas por token de verificacion
CREATE INDEX IF NOT EXISTS idx_usuario_token_verificacion ON usuario(token_verificacion);

-- Funcion para actualizar el campo actualizado_en automaticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
DROP TRIGGER IF EXISTS trigger_actualizar_usuarios ON usuario;
CREATE TRIGGER trigger_actualizar_usuarios
    BEFORE UPDATE ON usuario
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp();
