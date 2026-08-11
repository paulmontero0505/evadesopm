-- ============================================================
--  Migración: opción "No aplica" por actividad.
--  rating pasa a admitir NULL = la actividad no se observó en el turno,
--  por lo que no entra en la suma ni en el divisor del promedio.
--  Ejecutar una sola vez en phpMyAdmin sobre la base de datos del sistema.
-- ============================================================

ALTER TABLE shift_ratings      MODIFY rating TINYINT NULL;
ALTER TABLE compromiso_ratings MODIFY rating TINYINT NULL;
