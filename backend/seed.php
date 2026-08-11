<?php
// ============================================================
//  Inicializa la base de datos: crea el usuario admin y OPMs de ejemplo.
//  Ejecutar UNA vez:  php backend/seed.php
//  (El esquema se carga aparte con database/schema.sql)
// ============================================================

require_once __DIR__ . '/lib/db.php';

$employee = '0000001';
$name     = 'ADMINISTRADOR';
$password = 'admin123';          // <-- cámbiala después de entrar
$role     = 'admin';

$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = db()->prepare(
    'INSERT INTO users (employee_number, full_name, password_hash, role)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name),
                             password_hash = VALUES(password_hash),
                             role = VALUES(role), active = 1'
);
$stmt->execute([$employee, $name, $hash, $role]);

echo "Usuario admin listo:\n";
echo "  Empleado:   $employee\n";
echo "  Contraseña: $password\n";
echo "  Rol:        $role\n";

$opms = [
    ['OPM-001', 'Juan Pérez'], ['OPM-002', 'Ana López'], ['OPM-003', 'Luis Díaz'],
    ['OPM-004', 'Rosa Vega'], ['OPM-005', 'Carlos Ruiz'], ['OPM-006', 'Marta Soto'],
    ['OPM-007', 'Pedro Cruz'], ['OPM-008', 'Elena Ríos'],
];
$ins = db()->prepare(
    'INSERT INTO opms (code, full_name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)'
);
foreach ($opms as [$code, $n]) {
    $ins->execute([$code, $n]);
}
echo "OPMs de ejemplo listos (" . count($opms) . ").\n";
