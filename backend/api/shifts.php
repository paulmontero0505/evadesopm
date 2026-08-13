<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/rules.php';

/** Fichas (crudas, columnas obj_o1..o4 + rol del supervisor) de un período, opcionalmente de un solo OPM. */
function fetch_shift_rows(int $year, int $quarter, ?int $opmId = null): array
{
    $sql = 'SELECT s.*, u.role AS supervisor_role
              FROM shift_records s
              JOIN users u ON u.id = s.supervisor_id
             WHERE s.year = ? AND s.quarter = ?';
    $params = [$year, $quarter];
    if ($opmId !== null) {
        $sql .= ' AND s.opm_id = ?';
        $params[] = $opmId;
    }
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function is_multipurpose_operator(?string $puesto): bool
{
    $puesto = mb_strtoupper(trim((string)$puesto));
    $puesto = strtr($puesto, ['Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U']);
    return strpos($puesto, 'OPERARIO') !== false && strpos($puesto, 'MULTIPROPOSITO') !== false;
}

function require_multipurpose_operator(int $opmId): array
{
    $stmt = db()->prepare('SELECT id, full_name, puesto FROM opms WHERE id = ? AND active = 1');
    $stmt->execute([$opmId]);
    $opm = $stmt->fetch();
    if (!$opm || !is_multipurpose_operator($opm['puesto'] ?? '')) {
        json_error('Seleccione un operario multipropósito activo.', 422);
    }
    return $opm;
}

/** Máximo permitido para la foto del evento de seguridad. */
const EVENTO_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const EVENTO_PHOTO_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

/** Guarda la foto subida en uploads/events y devuelve la ruta relativa (o null si no vino ninguna). */
function save_evento_photo(): ?string
{
    if (empty($_FILES['evento_photo']) || $_FILES['evento_photo']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $f = $_FILES['evento_photo'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        json_error('Error al subir la foto (código ' . $f['error'] . ').', 422);
    }
    if ($f['size'] > EVENTO_PHOTO_MAX_BYTES) {
        json_error('La foto es demasiado grande (máx. 8 MB).', 422);
    }
    $mime = mime_content_type($f['tmp_name']);
    if (!isset(EVENTO_PHOTO_MIME[$mime])) {
        json_error('La foto debe ser JPG, PNG o WEBP.', 422);
    }
    $dir = __DIR__ . '/../../uploads/events';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . EVENTO_PHOTO_MIME[$mime];
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        json_error('No se pudo guardar la foto.', 500);
    }
    return 'uploads/events/' . $name;
}

/** POST /shift-records
 *  JSON o multipart/form-data con campo "payload" (JSON) + archivo opcional "evento_photo".
 *  { opm_id, work_date, turno, carga, amarre, evento_seguridad, evento_comment, reevaluacion_incidente, ratings, comments } */
function handle_shift_create(): void
{
    $user = require_auth();
    $b = isset($_POST['payload']) ? (json_decode($_POST['payload'], true) ?: []) : json_body();

    $opmId  = (int)($b['opm_id'] ?? 0);
    $date   = trim($b['work_date'] ?? '');
    $turno  = $b['turno'] ?? '';
    $carga  = $b['carga'] ?? '';
    $nave   = trim($b['nave'] ?? '');
    $nave   = $nave === '' ? null : mb_substr($nave, 0, 150);
    $amarre = !empty($b['amarre']);
    $evento = !empty($b['evento_seguridad']);
    $eventoComment = trim($b['evento_comment'] ?? '');
    $eventoComment = $eventoComment === '' ? null : mb_substr($eventoComment, 0, 500);
    $reevaluacionIncidente = !empty($b['reevaluacion_incidente']);
    $ratingsIn = is_array($b['ratings'] ?? null) ? $b['ratings'] : [];
    $commentsIn = is_array($b['comments'] ?? null) ? $b['comments'] : [];

    if (!$opmId || $date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_error('OPM y fecha de turno son obligatorios', 422);
    }
    if (!in_array($turno, ['dia', 'noche'], true)) {
        json_error('Turno inválido', 422);
    }
    if (!in_array($carga, CARGAS, true)) {
        json_error('Tipo de carga inválido', 422);
    }

    $opmRow = require_multipurpose_operator($opmId);

    $year = (int)substr($date, 0, 4);
    $quarter = quarter_of($date);

    // Las cuotas no aplican al administrador: puede registrar sin límites ni excepciones.
    if ($user['role'] !== 'admin') {
        // Regla: un OPM no puede acumular más de PARAMS['piso'] fichas en el trimestre (tope total).
        $totalCount = db()->prepare(
            'SELECT COUNT(*) FROM shift_records WHERE opm_id = ? AND year = ? AND quarter = ?'
        );
        $totalCount->execute([$opmId, $year, $quarter]);
        if ((int)$totalCount->fetchColumn() >= PARAMS['piso']) {
            json_error("{$opmRow['full_name']} ya alcanzó el máximo de " . PARAMS['piso'] . " fichas este trimestre.", 422);
        }

        // Regla: un mismo supervisor no puede evaluar al mismo OPM más de 3 veces en el trimestre.
        $superCount = db()->prepare(
            'SELECT COUNT(*) FROM shift_records WHERE opm_id = ? AND supervisor_id = ? AND year = ? AND quarter = ?'
        );
        $superCount->execute([$opmId, $user['id'], $year, $quarter]);
        if ((int)$superCount->fetchColumn() >= 3) {
            json_error("Usted ya evaluó a {$opmRow['full_name']} 3 veces este trimestre. No se permiten más fichas suyas para este OPM.", 422);
        }
    }

    // Regla de cobertura por tipo de carga: el límite se puede exceder únicamente para
    // documentar un incidente de seguridad ocurrido en el turno actual.
    $cargaCount = db()->prepare(
        'SELECT COUNT(*) FROM shift_records WHERE opm_id = ? AND carga = ? AND year = ? AND quarter = ?'
    );
    $cargaCount->execute([$opmId, $carga, $year, $quarter]);
    $currentCargaCount = (int)$cargaCount->fetchColumn();
    $maxIncidentReevaluations = 2;
    if ($currentCargaCount >= PARAMS['minCarga'] + $maxIncidentReevaluations) {
        json_error("{$opmRow['full_name']} ya alcanzó el máximo de " . (PARAMS['minCarga'] + $maxIncidentReevaluations) . " fichas con carga \"$carga\" este trimestre, incluidas las reevaluaciones por incidente.", 422);
    }
    if ($currentCargaCount >= PARAMS['minCarga'] && (!$reevaluacionIncidente || !$evento || $eventoComment === null)) {
        json_error("Ya se completó esta actividad: {$opmRow['full_name']} ya fue evaluado " . PARAMS['minCarga'] . " veces con carga \"$carga\" este trimestre.", 422);
    }

    [$ratings, $comments] = collect_ratings(required_activity_ids($carga, $amarre), $ratingsIn, $commentsIn);

    $eventoPhoto = $evento ? save_evento_photo() : null;

    $obj = promedios_ficha($ratings, $evento);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO shift_records
               (opm_id, supervisor_id, work_date, year, quarter, turno, carga, nave, amarre,
                evento_seguridad, evento_comment, evento_photo, reevaluacion_incidente, obj_o1, obj_o2, obj_o3, obj_o4)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $opmId, $user['id'], $date, $year, $quarter, $turno, $carga, $nave, $amarre ? 1 : 0,
            $evento ? 1 : 0, $evento ? $eventoComment : null, $eventoPhoto, $reevaluacionIncidente ? 1 : 0,
            $obj['O1'], $obj['O2'], $obj['O3'], $obj['O4'],
        ]);
        $shiftId = (int)$pdo->lastInsertId();

        $map = activity_objective_map();
        $ins = $pdo->prepare(
            'INSERT INTO shift_ratings (shift_record_id, activity_code, objective, rating, comment)
             VALUES (?,?,?,?,?)'
        );
        foreach ($ratings as $code => $v) {
            $ins->execute([$shiftId, $code, $map[$code], $v, $comments[$code]]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Error al guardar la ficha: ' . $e->getMessage(), 500);
    }

    json_response(['ok' => true, 'id' => $shiftId, 'obj' => $obj], 201);
}

/** DELETE /shift-records/{id} — el supervisor solo puede borrar las suyas; el admin, cualquiera. */
function handle_shift_delete(int $id): void
{
    $user = require_auth();
    $stmt = db()->prepare('SELECT id, supervisor_id, evento_photo FROM shift_records WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Ficha no encontrada', 404);
    }
    if ($user['role'] !== 'admin' && (int)$row['supervisor_id'] !== (int)$user['id']) {
        json_error('Solo puede eliminar las fichas que usted registró', 403);
    }
    db()->prepare('DELETE FROM shift_records WHERE id = ?')->execute([$id]);
    if (!empty($row['evento_photo'])) {
        $path = __DIR__ . '/../../' . $row['evento_photo'];
        if (is_file($path)) @unlink($path);
    }
    json_response(['ok' => true]);
}

/** GET /shift-records/{id} — detalle completo de una ficha, con sus calificaciones por actividad. */
function handle_shift_get(int $id): void
{
    require_auth();
    $stmt = db()->prepare(
        'SELECT s.*, o.code AS opm_code, o.full_name AS opm_name, u.full_name AS supervisor_name
           FROM shift_records s
           JOIN opms  o ON o.id = s.opm_id
           JOIN users u ON u.id = s.supervisor_id
          WHERE s.id = ?'
    );
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        json_error('Ficha no encontrada', 404);
    }

    $r = db()->prepare(
        'SELECT activity_code, objective, rating, comment FROM shift_ratings WHERE shift_record_id = ?'
    );
    $r->execute([$id]);
    $record['ratings'] = $r->fetchAll();

    json_response(['shift_record' => $record]);
}

/** GET /shift-records?opm_id=&year=&quarter=&date= */
function handle_shifts_list(): void
{
    require_auth();
    $date = trim($_GET['date'] ?? '');
    $hasDate = $date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date);

    // Si viene una fecha, el año/trimestre se derivan de ella.
    $year = $hasDate ? (int)substr($date, 0, 4) : (int)($_GET['year'] ?? date('Y'));
    $quarter = $hasDate ? quarter_of($date) : (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));
    $opmId = isset($_GET['opm_id']) && $_GET['opm_id'] !== '' ? (int)$_GET['opm_id'] : null;
    $all = ($_GET['all'] ?? '') === '1';

    $sql = 'SELECT s.*, o.code AS opm_code, o.full_name AS opm_name, u.full_name AS supervisor_name
              FROM shift_records s
              JOIN opms  o ON o.id = s.opm_id
              JOIN users u ON u.id = s.supervisor_id
              WHERE 1=1';
    $params = [];
    if (!$all) {
        $sql .= ' AND s.year = ? AND s.quarter = ?';
        $params = [$year, $quarter];
    }
    if ($hasDate) {
        $sql .= ' AND s.work_date = ?';
        $params[] = $date;
    }
    if ($opmId !== null) {
        $sql .= ' AND s.opm_id = ?';
        $params[] = $opmId;
    }
    $sql .= ' ORDER BY s.work_date DESC, s.id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_response(['shift_records' => $stmt->fetchAll()]);
}

/** GET /control?year=&quarter= — consolidado por OPM para el trimestre. */
function handle_control(): void
{
    require_auth();
    $year = (int)($_GET['year'] ?? date('Y'));
    $quarter = (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));

    $opms = db()->query("SELECT id, code, full_name FROM opms WHERE active = 1 AND UPPER(puesto) LIKE '%OPERARIO%' AND UPPER(puesto) LIKE '%MULTIPROPOSITO%' ORDER BY code")->fetchAll();
    $allFichas = fetch_shift_rows($year, $quarter);

    // Denominador de % de muestreo: turnos distintos (fecha+turno) registrados en el período.
    $turnosTotal = count(array_unique(array_map(fn($f) => $f['work_date'] . '|' . $f['turno'], $allFichas)));

    $out = [];
    foreach ($opms as $o) {
        $fichas = array_values(array_filter($allFichas, fn($f) => (int)$f['opm_id'] === (int)$o['id']));
        $c = consolidar($fichas);
        $out[] = [
            'id' => (int)$o['id'], 'code' => $o['code'], 'full_name' => $o['full_name'],
            'n' => $c['n'], 'supers' => $c['supers'], 'cob' => $c['cob'], 'eventos' => $c['eventos'],
            'obj' => $c['obj'], 'estado' => estado($c, $turnosTotal ?: null),
        ];
    }
    // Más fichas primero, igual que el prototipo.
    usort($out, fn($a, $b) => $b['n'] <=> $a['n']);

    json_response(['year' => $year, 'quarter' => $quarter, 'turnos_total' => $turnosTotal, 'control' => $out]);
}

/** PUT/POST /shift-records/{id}
 *  JSON o multipart/form-data con campo "payload" (JSON) + archivo opcional "evento_photo".
 *  { opm_id, work_date, turno, carga, amarre, evento_seguridad, evento_comment, clear_photo, ratings, comments } */
function handle_shift_update(int $id): void
{
    $user = require_auth();

    // 1. Verificar existencia y permisos
    $stmt = db()->prepare('SELECT * FROM shift_records WHERE id = ?');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        json_error('Ficha no encontrada', 404);
    }
    if ($user['role'] !== 'admin' && (int)$record['supervisor_id'] !== (int)$user['id']) {
        json_error('Solo puede editar las fichas que usted registró', 403);
    }

    $b = isset($_POST['payload']) ? (json_decode($_POST['payload'], true) ?: []) : json_body();

    $opmId  = (int)($b['opm_id'] ?? 0);
    $date   = trim($b['work_date'] ?? '');
    $turno  = $b['turno'] ?? '';
    $carga  = $b['carga'] ?? '';
    $nave   = trim($b['nave'] ?? '');
    $nave   = $nave === '' ? null : mb_substr($nave, 0, 150);
    $amarre = !empty($b['amarre']);
    $evento = !empty($b['evento_seguridad']);
    $eventoComment = trim($b['evento_comment'] ?? '');
    $eventoComment = $eventoComment === '' ? null : mb_substr($eventoComment, 0, 500);
    $clearPhoto = !empty($b['clear_photo']);
    $ratingsIn = is_array($b['ratings'] ?? null) ? $b['ratings'] : [];
    $commentsIn = is_array($b['comments'] ?? null) ? $b['comments'] : [];

    if (!$opmId || $date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_error('OPM y fecha de turno son obligatorios', 422);
    }
    if (!in_array($turno, ['dia', 'noche'], true)) {
        json_error('Turno inválido', 422);
    }
    if (!in_array($carga, CARGAS, true)) {
        json_error('Tipo de carga inválido', 422);
    }

    require_multipurpose_operator($opmId);

    [$ratings, $comments] = collect_ratings(required_activity_ids($carga, $amarre), $ratingsIn, $commentsIn);

    // Gestionar la foto
    $eventoPhoto = $record['evento_photo'];

    if ($clearPhoto || !$evento) {
        if (!empty($record['evento_photo'])) {
            $oldPath = __DIR__ . '/../../' . $record['evento_photo'];
            if (is_file($oldPath)) @unlink($oldPath);
        }
        $eventoPhoto = null;
    }

    // Si se sube una nueva foto, reemplazamos la anterior
    if (!empty($_FILES['evento_photo']) && $_FILES['evento_photo']['error'] !== UPLOAD_ERR_NO_FILE) {
        if (!empty($record['evento_photo']) && $eventoPhoto !== null) {
            $oldPath = __DIR__ . '/../../' . $record['evento_photo'];
            if (is_file($oldPath)) @unlink($oldPath);
        }
        $eventoPhoto = save_evento_photo();
    }

    $obj = promedios_ficha($ratings, $evento);
    $year = (int)substr($date, 0, 4);
    $quarter = quarter_of($date);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Actualizar shift_records
        $stmt = $pdo->prepare(
            'UPDATE shift_records
                SET opm_id = ?, work_date = ?, year = ?, quarter = ?, turno = ?, carga = ?, nave = ?, amarre = ?,
                    evento_seguridad = ?, evento_comment = ?, evento_photo = ?,
                    obj_o1 = ?, obj_o2 = ?, obj_o3 = ?, obj_o4 = ?
              WHERE id = ?'
        );
        $stmt->execute([
            $opmId, $date, $year, $quarter, $turno, $carga, $nave, $amarre ? 1 : 0,
            $evento ? 1 : 0, $evento ? $eventoComment : null, $eventoPhoto,
            $obj['O1'], $obj['O2'], $obj['O3'], $obj['O4'],
            $id
        ]);

        // Borrar shift_ratings antiguos
        $pdo->prepare('DELETE FROM shift_ratings WHERE shift_record_id = ?')->execute([$id]);

        // Insertar shift_ratings nuevos
        $map = activity_objective_map();
        $ins = $pdo->prepare(
            'INSERT INTO shift_ratings (shift_record_id, activity_code, objective, rating, comment)
             VALUES (?,?,?,?,?)'
        );
        foreach ($ratings as $code => $v) {
            $ins->execute([$id, $code, $map[$code], $v, $comments[$code]]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Error al actualizar la ficha: ' . $e->getMessage(), 500);
    }

    json_response(['ok' => true, 'id' => $id, 'obj' => $obj]);
}
