-- Rellena los movimientos de radios históricos (relevos/devoluciones/reasignaciones
-- registrados antes de que existiera la columna registered_by) asignándolos al
-- usuario administrador. De ahí en adelante el sistema guarda automáticamente el
-- usuario que realiza cada movimiento.
--
-- Requiere que la columna registered_by ya exista
-- (migration_trazabilidad_relevo_radios.sql). Ejecutar una sola vez.
UPDATE radio_assignment_movements
SET registered_by = (SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY id LIMIT 1)
WHERE registered_by IS NULL;
