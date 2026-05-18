-- =====================================================
-- Script para crear la tabla de tokens de verificacion
-- Ejecutar en pgAdmin sobre tu base de datos BD_ACTUALIZADA_SPA_MASCOTAS
-- Este script NO afecta ninguna tabla existente
-- =====================================================

-- Tabla para tokens de verificacion de email y recuperacion de contrasena
CREATE TABLE IF NOT EXISTS tokens_verificacion (
    id_token SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    token VARCHAR(6) NOT NULL,
    tipo VARCHAR(20) DEFAULT 'email' CHECK (tipo IN ('email', 'password_reset')),
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios descriptivos
COMMENT ON TABLE tokens_verificacion IS 'Tokens temporales para verificacion de email y recuperacion de contrasena';
COMMENT ON COLUMN tokens_verificacion.token IS 'Codigo de 6 digitos enviado al usuario';
COMMENT ON COLUMN tokens_verificacion.tipo IS 'email para verificar cuenta, password_reset para recuperar contrasena';
COMMENT ON COLUMN tokens_verificacion.expira_en IS 'El token expira 15 minutos despues de crearse';
COMMENT ON COLUMN tokens_verificacion.usado IS 'TRUE cuando el token ya fue utilizado';

-- Indices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens_verificacion(id_usuario);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens_verificacion(token);
CREATE INDEX IF NOT EXISTS idx_tokens_tipo ON tokens_verificacion(tipo);

-- =====================================================
-- Verificacion: Ejecuta esto para confirmar que se creo
-- SELECT * FROM tokens_verificacion LIMIT 1;
-- =====================================================
