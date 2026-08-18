-- Fix: "Unknown column 'reevaluacion_incidente' in 'WHERE'"
-- La columna existe en schema.sql y en migration_reevaluacion_incidente.sql,
-- pero la base de datos de produccion nunca corrio esa migracion.
-- Este script es idempotente: se puede ejecutar aunque la columna ya exista.

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE shift_records ADD COLUMN reevaluacion_incidente TINYINT(1) NOT NULL DEFAULT 0 AFTER evento_photo',
    'SELECT "reevaluacion_incidente ya existe" AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'shift_records'
    AND COLUMN_NAME  = 'reevaluacion_incidente'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificacion
SHOW COLUMNS FROM shift_records LIKE 'reevaluacion_incidente';
