<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/xlsx.php';

/** GET /users  (admin) */
function handle_users_list(): void
{
    require_role(['admin']);
    $rows = db()->query(
        'SELECT id, employee_number, full_name, role, active, code, dni, fecha_ingreso, puesto, team, created_at
           FROM users ORDER BY created_at DESC'
    )->fetchAll();
    json_response(['users' => $rows]);
}

/** GET /users/template  (admin) — descarga la plantilla Excel (.xlsx) para la carga masiva de supervisores. */
function handle_users_template(): void
{
    require_role(['admin']);
    $bytes = xlsx_build_supervisors_template();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="plantilla_supervisores.xlsx"');
    header('Content-Length: ' . strlen($bytes));
    echo $bytes;
    exit;
}

/** POST /users/import  (admin) — carga masiva de supervisores desde una plantilla Excel (.xlsx).
 *  Campo de archivo: "file". El DNI de cada fila se usa como N° empleado (login) y como
 *  contraseña inicial. Inserta nuevos; a los ya existentes solo les actualiza los datos
 *  (nunca la contraseña, por si el supervisor ya la cambió). */
function handle_users_import(): void
{
    require_role(['admin']);

    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        json_error('No se recibió ningún archivo. Adjunte la plantilla Excel.', 422);
    }
    $f = $_FILES['file'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        json_error('Error al subir el archivo (código ' . $f['error'] . ').', 422);
    }
    if ($f['size'] > 10 * 1024 * 1024) {
        json_error('El archivo es demasiado grande (máx. 10 MB).', 422);
    }
    if (!preg_match('/\.xlsx$/i', $f['name'])) {
        json_error('El archivo debe ser una plantilla Excel .xlsx', 422);
    }

    try {
        $rows = xlsx_read_opms($f['tmp_name']);
    } catch (Throwable $e) {
        json_error('No se pudo leer el Excel: ' . $e->getMessage(), 422);
    }
    if (!$rows) {
        json_error('No se encontraron supervisores en el archivo (se esperan columnas de DNI y nombre).', 422);
    }

    $pdo = db();
    $insert = $pdo->prepare(
        'INSERT INTO users (employee_number, full_name, password_hash, role, password_change_required, code, dni, fecha_ingreso, puesto, team)
         VALUES (?, ?, ?, \'supervisor\', 1, ?, ?, ?, ?, ?)'
    );
    $update = $pdo->prepare(
        'UPDATE users SET full_name = ?, code = ?, fecha_ingreso = ?, puesto = ?, team = ?, active = 1
          WHERE employee_number = ?'
    );
    $exists = $pdo->prepare('SELECT id FROM users WHERE employee_number = ?');

    $created = 0; $updated = 0; $errors = [];
    $seen = [];
    $pdo->beginTransaction();
    try {
        foreach ($rows as $r) {
            $dni  = mb_substr(trim($r['dni'] ?? ''), 0, 20);
            $name = mb_substr(trim($r['name']), 0, 120);
            if ($dni === '' || $name === '' || !preg_match('/\d/', $dni)) continue;
            if (isset($seen[$dni])) continue;   // evita duplicados dentro del mismo archivo
            $seen[$dni] = true;

            $code    = mb_substr(trim($r['code'] ?? ''), 0, 20) ?: null;
            $ingreso = $r['fecha_ingreso'] ?? null;
            $puesto  = mb_substr(trim($r['puesto'] ?? ''), 0, 150) ?: null;
            $team    = mb_substr(trim($r['team'] ?? ''), 0, 100) ?: null;

            try {
                $exists->execute([$dni]);
                if ($exists->fetchColumn()) {
                    $update->execute([$name, $code, $ingreso, $puesto, $team, $dni]);
                    $updated++;
                } else {
                    $insert->execute([$dni, $name, password_hash($dni, PASSWORD_DEFAULT), $code, $dni, $ingreso, $puesto, $team]);
                    $created++;
                }
            } catch (Throwable $e) {
                $errors[] = $dni;
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Error al guardar la carga: ' . $e->getMessage(), 500);
    }

    json_response(['ok' => true, 'created' => $created, 'updated' => $updated, 'total' => count($rows), 'errors' => $errors]);
}

/** POST /users  (admin) { employee_number, full_name, password, role, code?, dni?, fecha_ingreso?, puesto?, team? } */
function handle_user_create(): void
{
    require_role(['admin']);
    $b = json_body();
    $emp  = trim($b['employee_number'] ?? '');
    $name = trim($b['full_name'] ?? '');
    $pass = (string)($b['password'] ?? '');
    $role = $b['role'] ?? 'supervisor';
    $code    = trim($b['code'] ?? '') ?: null;
    $dni     = trim($b['dni'] ?? '') ?: null;
    $ingreso = trim($b['fecha_ingreso'] ?? '') ?: null;
    $puesto  = trim($b['puesto'] ?? '') ?: null;
    $team    = trim($b['team'] ?? '') ?: null;

    if ($emp === '' || $name === '' || $pass === '') {
        json_error('Empleado, nombre y contraseña son obligatorios', 422);
    }
    if (!in_array($role, ['admin', 'supervisor', 'coordinator'], true)) {
        json_error('Rol inválido', 422);
    }

    try {
        $stmt = db()->prepare(
            'INSERT INTO users (employee_number, full_name, password_hash, role, password_change_required, code, dni, fecha_ingreso, puesto, team)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([$emp, $name, password_hash($pass, PASSWORD_DEFAULT), $role, $role !== 'admin' ? 1 : 0, $code, $dni, $ingreso, $puesto, $team]);
        json_response(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_error('Ese número de empleado ya existe', 409);
        }
        throw $e;
    }
}

/** PUT /users/{id}  (admin) { employee_number?, full_name?, role?, active?, password? } */
function handle_user_update(int $id): void
{
    $me = require_role(['admin']);
    $b = json_body();
    $sets = [];
    $params = [];

    $self = (int)$me['id'] === $id;
    if ($self && isset($b['role']) && $b['role'] !== 'admin') {
        json_error('No puedes cambiar tu propio rol de administrador', 409);
    }
    if ($self && isset($b['active']) && empty($b['active'])) {
        json_error('No puedes desactivar tu propio usuario', 409);
    }

    if (isset($b['employee_number'])) {
        $emp = trim($b['employee_number']);
        if ($emp === '') {
            json_error('El número de empleado no puede quedar vacío', 422);
        }
        $sets[] = 'employee_number = ?'; $params[] = $emp;
    }
    if (isset($b['full_name'])) { $sets[] = 'full_name = ?'; $params[] = trim($b['full_name']); }
    if (isset($b['role'])) {
        if (!in_array($b['role'], ['admin', 'supervisor', 'coordinator'], true)) {
            json_error('Rol inválido', 422);
        }
        $sets[] = 'role = ?'; $params[] = $b['role'];
    }
    if (isset($b['active'])) { $sets[] = 'active = ?'; $params[] = !empty($b['active']) ? 1 : 0; }
    if (!empty($b['password'])) {
        $targetRole = $b['role'] ?? null;
        if ($targetRole === null) {
            $roleStmt = db()->prepare('SELECT role FROM users WHERE id = ?');
            $roleStmt->execute([$id]);
            $targetRole = $roleStmt->fetchColumn();
        }
        $sets[] = 'password_hash = ?'; $params[] = password_hash($b['password'], PASSWORD_DEFAULT);
        $sets[] = 'password_change_required = ?'; $params[] = $targetRole !== 'admin' ? 1 : 0;
    }
    if (isset($b['code']))          { $sets[] = 'code = ?';          $params[] = trim($b['code']) ?: null; }
    if (isset($b['dni']))           { $sets[] = 'dni = ?';           $params[] = trim($b['dni']) ?: null; }
    if (isset($b['fecha_ingreso'])) { $sets[] = 'fecha_ingreso = ?'; $params[] = trim($b['fecha_ingreso']) ?: null; }
    if (isset($b['puesto']))        { $sets[] = 'puesto = ?';        $params[] = trim($b['puesto']) ?: null; }
    if (isset($b['team']))          { $sets[] = 'team = ?';          $params[] = trim($b['team']) ?: null; }
    if (!$sets) {
        json_error('Nada que actualizar', 422);
    }
    $params[] = $id;
    try {
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_error('Ese número de empleado ya existe', 409);
        }
        throw $e;
    }
    if (!empty($b['password']) && !$self) {
        // Una clave reasignada por administración invalida las sesiones que ya tenía el usuario.
        db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$id]);
    }
    json_response(['ok' => true]);
}

/** DELETE /users/{id}  (admin) */
function handle_user_delete(int $id): void
{
    $me = require_role(['admin']);
    if ((int)$me['id'] === $id) {
        json_error('No puedes eliminar tu propio usuario', 409);
    }

    $stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) {
        json_error('Usuario no encontrado', 404);
    }

    $used = db()->prepare(
        '(SELECT COUNT(*) FROM shift_records WHERE supervisor_id = ?)
       + (SELECT COUNT(*) FROM evaluations   WHERE evaluated_by = ?)'
    );
    $used->execute([$id, $id]);
    if ((int)$used->fetchColumn() > 0) {
        json_error(
            'Este usuario tiene fichas o evaluaciones registradas y no se puede eliminar. Desactívalo.',
            409
        );
    }

    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    json_response(['ok' => true]);
}
