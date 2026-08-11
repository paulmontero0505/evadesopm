<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/xlsx.php';

/** GET /opms/template  (admin) — descarga la plantilla Excel (.xlsx) para la carga masiva. */
function handle_opms_template(): void
{
    require_role(['admin']);
    $bytes = xlsx_build_opms_template();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="plantilla_colaboradores.xlsx"');
    header('Content-Length: ' . strlen($bytes));
    echo $bytes;
    exit;
}

/** POST /opms/import  (admin) — carga masiva desde una plantilla Excel (.xlsx).
 *  Campo de archivo: "file". Inserta nuevos y actualiza el nombre de los existentes. */
function handle_opms_import(): void
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
        json_error('No se encontraron colaboradores en el archivo (se esperan columnas de código y nombre).', 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO opms (code, full_name, dni, fecha_ingreso, fecha_nacimiento, telefono, email_personal, puesto, team) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), dni = VALUES(dni),
           fecha_ingreso = VALUES(fecha_ingreso), fecha_nacimiento = VALUES(fecha_nacimiento),
           telefono = VALUES(telefono), email_personal = VALUES(email_personal),
           puesto = VALUES(puesto), team = VALUES(team), active = 1'
    );

    $created = 0; $updated = 0; $errors = [];
    $seen = [];
    $pdo->beginTransaction();
    try {
        foreach ($rows as $r) {
            $code = mb_substr(trim($r['code']), 0, 50);
            $name = mb_substr(trim($r['name']), 0, 150);
            if ($code === '' || $name === '') continue;
            if (isset($seen[$code])) continue;   // evita duplicados dentro del mismo archivo
            $seen[$code] = true;
            $dni    = mb_substr(trim($r['dni'] ?? ''), 0, 20) ?: null;
            $ingreso = $r['fecha_ingreso'] ?? null;
            $nacimiento = $r['fecha_nacimiento'] ?? null;
            $telefono = mb_substr(trim($r['telefono'] ?? ''), 0, 30) ?: null;
            $email = mb_substr(trim($r['email_personal'] ?? ''), 0, 150) ?: null;
            $puesto = mb_substr(trim($r['puesto'] ?? ''), 0, 150) ?: null;
            $team   = mb_substr(trim($r['team'] ?? ''), 0, 100) ?: null;
            try {
                $stmt->execute([$code, $name, $dni, $ingreso, $nacimiento, $telefono, $email, $puesto, $team]);
                // MySQL: rowCount() == 1 si insertó, == 2 si actualizó por ON DUPLICATE KEY.
                if ($stmt->rowCount() === 1) $created++; else $updated++;
            } catch (Throwable $e) {
                $errors[] = $code;
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Error al guardar la carga: ' . $e->getMessage(), 500);
    }

    json_response([
        'ok'       => true,
        'total'    => count($seen),
        'created'  => $created,
        'updated'  => $updated,
        'errors'   => $errors,
    ]);
}

/** GET /opms */
function handle_opms_list(): void
{
    require_auth();
    $rows = db()->query(
        'SELECT id, code, full_name, dni, fecha_ingreso, fecha_nacimiento, telefono, email_personal, puesto, team, active, created_at FROM opms ORDER BY code'
    )->fetchAll();
    json_response(['opms' => $rows]);
}

/** POST /opms  (admin) { code, full_name, dni?, fecha_ingreso?, puesto?, team? } */
function handle_opm_create(): void
{
    require_role(['admin']);
    $b = json_body();
    $code = trim($b['code'] ?? '');
    $name = trim($b['full_name'] ?? '');
    if ($code === '' || $name === '') {
        json_error('Código y nombre son obligatorios', 422);
    }
    $dni    = trim($b['dni'] ?? '') ?: null;
    $ingreso = trim($b['fecha_ingreso'] ?? '');
    if ($ingreso !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ingreso)) {
        json_error('Fecha de ingreso inválida', 422);
    }
    $ingreso = $ingreso ?: null;
    $nacimiento = trim($b['fecha_nacimiento'] ?? '');
    if ($nacimiento !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $nacimiento)) {
        json_error('Fecha de nacimiento invalida', 422);
    }
    $nacimiento = $nacimiento ?: null;
    $telefono = trim($b['telefono'] ?? '') ?: null;
    $email = trim($b['email_personal'] ?? '') ?: null;
    $puesto = trim($b['puesto'] ?? '') ?: null;
    $team   = trim($b['team'] ?? '') ?: null;
    try {
        $stmt = db()->prepare(
            'INSERT INTO opms (code, full_name, dni, fecha_ingreso, fecha_nacimiento, telefono, email_personal, puesto, team) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$code, $name, $dni, $ingreso, $nacimiento, $telefono, $email, $puesto, $team]);
        json_response(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_error('Ese código de OPM ya existe', 409);
        }
        throw $e;
    }
}

/** PUT /opms/{id}  (admin) { code?, full_name?, dni?, fecha_ingreso?, puesto?, team?, active? } */
function handle_opm_update(int $id): void
{
    require_role(['admin']);
    $b = json_body();
    $sets = []; $params = [];
    if (isset($b['code'])) {
        $code = trim($b['code']);
        if ($code === '') json_error('El código no puede quedar vacío', 422);
        $sets[] = 'code = ?'; $params[] = $code;
    }
    if (isset($b['full_name'])) {
        $name = trim($b['full_name']);
        if ($name === '') json_error('El nombre no puede quedar vacío', 422);
        $sets[] = 'full_name = ?'; $params[] = $name;
    }
    if (isset($b['dni'])) { $sets[] = 'dni = ?'; $params[] = trim($b['dni']) ?: null; }
    if (isset($b['fecha_ingreso'])) {
        $ingreso = trim($b['fecha_ingreso']);
        if ($ingreso !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ingreso)) {
            json_error('Fecha de ingreso inválida', 422);
        }
        $sets[] = 'fecha_ingreso = ?'; $params[] = $ingreso ?: null;
    }
    if (isset($b['fecha_nacimiento'])) {
        $nacimiento = trim($b['fecha_nacimiento']);
        if ($nacimiento !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $nacimiento)) {
            json_error('Fecha de nacimiento invalida', 422);
        }
        $sets[] = 'fecha_nacimiento = ?'; $params[] = $nacimiento ?: null;
    }
    if (isset($b['telefono'])) { $sets[] = 'telefono = ?'; $params[] = trim($b['telefono']) ?: null; }
    if (isset($b['email_personal'])) { $sets[] = 'email_personal = ?'; $params[] = trim($b['email_personal']) ?: null; }
    if (isset($b['puesto'])) { $sets[] = 'puesto = ?'; $params[] = trim($b['puesto']) ?: null; }
    if (isset($b['team']))   { $sets[] = 'team = ?';   $params[] = trim($b['team']) ?: null; }
    if (isset($b['active'])) { $sets[] = 'active = ?'; $params[] = !empty($b['active']) ? 1 : 0; }
    if (!$sets) json_error('Nada que actualizar', 422);
    $params[] = $id;
    try {
        db()->prepare('UPDATE opms SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') json_error('Ese código de OPM ya existe', 409);
        throw $e;
    }
    json_response(['ok' => true]);
}

/** DELETE /opms/{id}  (admin) — si tiene fichas/evaluaciones se desactiva en vez de borrar. */
function handle_opm_delete(int $id): void
{
    require_role(['admin']);
    $stmt = db()->prepare('SELECT id FROM opms WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) {
        json_error('OPM no encontrado', 404);
    }
    $used = db()->prepare(
        'SELECT (SELECT COUNT(*) FROM shift_records WHERE opm_id = ?)
              + (SELECT COUNT(*) FROM evaluations   WHERE opm_id = ?)'
    );
    $used->execute([$id, $id]);
    if ((int)$used->fetchColumn() > 0) {
        db()->prepare('UPDATE opms SET active = 0 WHERE id = ?')->execute([$id]);
        json_response(['ok' => true, 'deactivated' => true]);
    }
    db()->prepare('DELETE FROM opms WHERE id = ?')->execute([$id]);
    json_response(['ok' => true, 'deactivated' => false]);
}
