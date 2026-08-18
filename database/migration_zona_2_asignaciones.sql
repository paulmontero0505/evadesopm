-- ============================================================
--  Asignación de funciones: segunda zona (ZONA 2)
-- ============================================================
--  opm_assignments.zona_2 ya figura en schema.sql, pero las bases creadas
--  antes de ese cambio pueden no tenerla; supervisor_assignments nunca la
--  tuvo. Este script agrega la columna solo donde falte, así que se puede
--  ejecutar sin revisar primero el estado de cada tabla.

-- ---------------------------------------------- opm_assignments.zona_2
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE opm_assignments ADD COLUMN zona_2 VARCHAR(150) NULL AFTER zona_1',
    'SELECT "opm_assignments.zona_2 ya existe" AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'opm_assignments'
    AND COLUMN_NAME  = 'zona_2'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------- supervisor_assignments.zona_2
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE supervisor_assignments ADD COLUMN zona_2 VARCHAR(150) NULL AFTER zona_1',
    'SELECT "supervisor_assignments.zona_2 ya existe" AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'supervisor_assignments'
    AND COLUMN_NAME  = 'zona_2'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificación
SHOW COLUMNS FROM opm_assignments LIKE 'zona_2';
SHOW COLUMNS FROM supervisor_assignments LIKE 'zona_2';
