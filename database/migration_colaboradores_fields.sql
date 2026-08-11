-- Ejecutar una vez en instalaciones existentes para ampliar el catÃ¡logo de colaboradores.
SET @fecha_nacimiento_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opms' AND COLUMN_NAME = 'fecha_nacimiento'
);
SET @add_fecha_nacimiento = IF(@fecha_nacimiento_exists = 0,
  'ALTER TABLE opms ADD COLUMN fecha_nacimiento DATE NULL AFTER fecha_ingreso',
  'SELECT 1');
PREPARE add_fecha_nacimiento FROM @add_fecha_nacimiento;
EXECUTE add_fecha_nacimiento;
DEALLOCATE PREPARE add_fecha_nacimiento;

SET @telefono_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opms' AND COLUMN_NAME = 'telefono'
);
SET @add_telefono = IF(@telefono_exists = 0,
  'ALTER TABLE opms ADD COLUMN telefono VARCHAR(30) NULL AFTER fecha_nacimiento',
  'SELECT 1');
PREPARE add_telefono FROM @add_telefono;
EXECUTE add_telefono;
DEALLOCATE PREPARE add_telefono;

SET @email_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opms' AND COLUMN_NAME = 'email_personal'
);
SET @add_email = IF(@email_exists = 0,
  'ALTER TABLE opms ADD COLUMN email_personal VARCHAR(150) NULL AFTER telefono',
  'SELECT 1');
PREPARE add_email FROM @add_email;
EXECUTE add_email;
DEALLOCATE PREPARE add_email;
