-- Trazabilidad de relevos: guarda qué usuario (coordinador/supervisor/admin)
-- registró cada movimiento de radio, para poder mostrar la cadena completa
-- (quién relevó, quién registró el relevo y a quién se asignó) en el reporte.
--
-- Ejecutar una sola vez en phpMyAdmin. Si la columna ya existe, MySQL avisará
-- con un error que puede ignorarse.
ALTER TABLE radio_assignment_movements
  ADD COLUMN registered_by INT NULL AFTER to_user_id,
  ADD CONSTRAINT fk_radio_movement_registered_by FOREIGN KEY (registered_by) REFERENCES users(id);
