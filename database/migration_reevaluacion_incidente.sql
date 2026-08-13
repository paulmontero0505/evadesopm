-- Permite identificar fichas adicionales autorizadas por un incidente de seguridad.
-- Ejecutar una sola vez en phpMyAdmin sobre la base de datos del sistema.
ALTER TABLE shift_records
  ADD COLUMN reevaluacion_incidente TINYINT(1) NOT NULL DEFAULT 0 AFTER evento_photo;
