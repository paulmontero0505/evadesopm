<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/rules_compromiso.php';
require_once __DIR__ . '/../lib/rules.php'; // quarter_of()

/** GET /compromiso-rules — catálogo de objetivos, actividades y parámetros. */
function handle_rules_compromiso(): void
{
    require_auth();
    json_response(['rules' => rules_catalog_c()]);
}

/** Fichas (crudas, columnas obj_o1..o4 + rol del supervisor) de un período, opcionalmente de un solo OPM. */
function fetch_compromiso_rows(int $year, int $quarter, ?int $opmId = null): array
{
    $sql = 'SELECT c.*, u.role AS supervisor_role
              FROM compromiso_records c
              JOIN users u ON u.id = c.supervisor_id
             WHERE c.year = ? AND c.quarter = ?';
    $params = [$year, $quarter];
    if ($opmId !== null) {
        $sql .= ' AND c.opm_id = ?';
        $params[] = $opmId;
    }
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** GET /control-compromiso?year=&quarter= — consolidado por OPM para el trimestre. */
function handle_control_compromiso(): void
{
    require_auth();
    $year = (int)($_GET['year'] ?? date('Y'));
    $quarter = (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));

    $opms = db()->query("SELECT id, code, full_name FROM opms WHERE active = 1 AND UPPER(puesto) LIKE '%OPERARIO%' AND UPPER(puesto) LIKE '%MULTIPROPOSITO%' ORDER BY code")->fetchAll();
    $allFichas = fetch_compromiso_rows($year, $quarter);

    $out = [];
    foreach ($opms as $o) {
        $fichas = array_values(array_filter($allFichas, fn($f) => (int)$f['opm_id'] === (int)$o['id']));
        $c = consolidar_c($fichas);
        $out[] = [
            'id' => (int)$o['id'], 'code' => $o['code'], 'full_name' => $o['full_name'],
            'n' => $c['n'], 'supers' => $c['supers'], 'criticas' => $c['criticas'],
            'obj' => $c['obj'], 'estado' => estado_c($c),
        ];
    }
    usort($out, fn($a, $b) => $b['n'] <=> $a['n']);

    json_response(['year' => $year, 'quarter' => $quarter, 'control' => $out]);
}

/** Máximo permitido para la foto de la conducta crítica. */
const CONDUCTA_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const CONDUCTA_PHOTO_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

/** Guarda la foto subida en uploads/compromiso y devuelve la ruta relativa (o null si no vino ninguna). */
function save_conducta_photo(): ?string
{
    if (empty($_FILES['conducta_photo']) || $_FILES['conducta_photo']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $f = $_FILES['conducta_photo'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        json_error('Error al subir la foto (código ' . $f['error'] . ').', 422);
    }
    if ($f['size'] > CONDUCTA_PHOTO_MAX_BYTES) {
        json_error('La foto es demasiado grande (máx. 8 MB).', 422);
    }
    $mime = mime_content_type($f['tmp_name']);
    if (!isset(CONDUCTA_PHOTO_MIME[$mime])) {
        json_error('La foto debe ser JPG, PNG o WEBP.', 422);
    }
    $dir = __DIR__ . '/../../uploads/compromiso';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . CONDUCTA_PHOTO_MIME[$mime];
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        json_error('No se pudo guardar la foto.', 500);
    }
    return 'uploads/compromiso/' . $name;
}

/** POST /compromiso-records
 *  JSON o multipart/form-data con campo "payload" (JSON) + archivo opcional "conducta_photo".
 *  { opm_id, work_date, turno, conducta_critica, conducta_comment, ratings, comments } */
function handle_compromiso_create(): void
{
    $user = require_auth();
    $b = isset($_POST['payload']) ? (json_decode($_POST['payload'], true) ?: []) : json_body();

    $opmId    = (int)($b['opm_id'] ?? 0);
    $date     = trim($b['work_date'] ?? '');
    $turno    = $b['turno'] ?? '';
    $critica  = !empty($b['conducta_critica']);
    $comment  = trim($b['conducta_comment'] ?? '');
    $comment  = $comment === '' ? null : mb_substr($comment, 0, 500);
    $ratingsIn = is_array($b['ratings'] ?? null) ? $b['ratings'] : [];
    $commentsIn = is_array($b['comments'] ?? null) ? $b['comments'] : [];

    if (!$opmId || $date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_error('OPM y fecha de turno son obligatorios', 422);
    }
    if (!in_array($turno, ['dia', 'noche'], true)) {
        json_error('Turno inválido', 422);
    }

    $opmRow = require_multipurpose_operator($opmId);

    $year = (int)substr($date, 0, 4);
    $quarter = quarter_of($date);

    // Las cuotas no aplican al administrador: puede registrar sin límites ni excepciones.
    if ($user['role'] !== 'admin') {
        // Regla: un OPM no puede acumular más de PARAMS_C['piso'] fichas en el trimestre (tope total).
        $totalCount = db()->prepare(
            'SELECT COUNT(*) FROM compromiso_records WHERE opm_id = ? AND year = ? AND quarter = ?'
        );
        $totalCount->execute([$opmId, $year, $quarter]);
        if ((int)$totalCount->fetchColumn() >= PARAMS_C['piso']) {
            json_error("{$opmRow['full_name']} ya alcanzó el máximo de " . PARAMS_C['piso'] . " fichas este trimestre.", 422);
        }

        // Regla: un mismo supervisor no puede evaluar al mismo OPM más de 2 veces en el mismo mes.
        $month = substr($date, 0, 7); // 'YYYY-MM'
        $superCount = db()->prepare(
            "SELECT COUNT(*) FROM compromiso_records WHERE opm_id = ? AND supervisor_id = ? AND DATE_FORMAT(work_date, '%Y-%m') = ?"
        );
        $superCount->execute([$opmId, $user['id'], $month]);
        if ((int)$superCount->fetchColumn() >= 2) {
            json_error("Usted ya evaluó a {$opmRow['full_name']} 2 veces este mes. No se permiten más fichas suyas para este OPM este mes.", 422);
        }
    }

    [$ratings, $comments] = collect_ratings(required_activity_ids_c(), $ratingsIn, $commentsIn);

    $conductaPhoto = $critica ? save_conducta_photo() : null;

    $obj = promedios_ficha_c($ratings, $critica);

    $objKeys = array_keys(OBJETIVOS_C);
    $objCols = implode(', ', array_map(fn($o) => 'obj_' . strtolower($o), $objKeys));
    $objPlaceholders = implode(',', array_fill(0, count($objKeys), '?'));
    $objValues = array_map(fn($o) => $obj[$o], $objKeys);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO compromiso_records
               (opm_id, supervisor_id, work_date, year, quarter, turno,
                conducta_critica, conducta_comment, conducta_photo, $objCols)
             VALUES (?,?,?,?,?,?,?,?,?,$objPlaceholders)"
        );
        $stmt->execute([
            $opmId, $user['id'], $date, $year, $quarter, $turno,
            $critica ? 1 : 0, $critica ? $comment : null, $conductaPhoto,
            ...$objValues,
        ]);
        $recordId = (int)$pdo->lastInsertId();

        $map = activity_objective_map_c();
        $ins = $pdo->prepare(
            'INSERT INTO compromiso_ratings (compromiso_record_id, activity_code, objective, rating, comment)
             VALUES (?,?,?,?,?)'
        );
        foreach ($ratings as $code => $v) {
            $ins->execute([$recordId, $code, $map[$code], $v, $comments[$code]]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Error al guardar la ficha: ' . $e->getMessage(), 500);
    }

    json_response(['ok' => true, 'id' => $recordId, 'obj' => $obj], 201);
}

/** DELETE /compromiso-records/{id} — el supervisor solo puede borrar las suyas; el admin, cualquiera. */
function handle_compromiso_delete(int $id): void
{
    $user = require_auth();
    $stmt = db()->prepare('SELECT id, supervisor_id, conducta_photo FROM compromiso_records WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Ficha no encontrada', 404);
    }
    if ($user['role'] !== 'admin' && (int)$row['supervisor_id'] !== (int)$user['id']) {
        json_error('Solo puede eliminar las fichas que usted registró', 403);
    }
    db()->prepare('DELETE FROM compromiso_records WHERE id = ?')->execute([$id]);
    if (!empty($row['conducta_photo'])) {
        $path = __DIR__ . '/../../' . $row['conducta_photo'];
        if (is_file($path)) @unlink($path);
    }
    json_response(['ok' => true]);
}

/** GET /compromiso-records/{id} — detalle completo de una ficha, con sus calificaciones por actividad. */
function handle_compromiso_get(int $id): void
{
    require_auth();
    $stmt = db()->prepare(
        'SELECT c.*, o.code AS opm_code, o.full_name AS opm_name, u.full_name AS supervisor_name
           FROM compromiso_records c
           JOIN opms  o ON o.id = c.opm_id
           JOIN users u ON u.id = c.supervisor_id
          WHERE c.id = ?'
    );
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        json_error('Ficha no encontrada', 404);
    }

    $r = db()->prepare(
        'SELECT activity_code, objective, rating, comment FROM compromiso_ratings WHERE compromiso_record_id = ?'
    );
    $r->execute([$id]);
    $record['ratings'] = $r->fetchAll();

    json_response(['compromiso_record' => $record]);
}

/** GET /compromiso-records?opm_id=&year=&quarter=&date= */
function handle_compromiso_list(): void
{
    require_auth();
    $date = trim($_GET['date'] ?? '');
    $hasDate = $date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date);

    $year = $hasDate ? (int)substr($date, 0, 4) : (int)($_GET['year'] ?? date('Y'));
    $quarter = $hasDate ? quarter_of($date) : (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));
    $opmId = isset($_GET['opm_id']) && $_GET['opm_id'] !== '' ? (int)$_GET['opm_id'] : null;

    $sql = 'SELECT c.*, o.code AS opm_code, o.full_name AS opm_name, u.full_name AS supervisor_name
              FROM compromiso_records c
              JOIN opms  o ON o.id = c.opm_id
              JOIN users u ON u.id = c.supervisor_id
             WHERE c.year = ? AND c.quarter = ?';
    $params = [$year, $quarter];
    if ($hasDate) {
        $sql .= ' AND c.work_date = ?';
        $params[] = $date;
    }
    if ($opmId !== null) {
        $sql .= ' AND c.opm_id = ?';
        $params[] = $opmId;
    }
    $sql .= ' ORDER BY c.work_date DESC, c.id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_response(['compromiso_records' => $stmt->fetchAll()]);
}

/** PUT/POST /compromiso-records/{id}
 *  JSON o multipart/form-data con campo "payload" (JSON) + archivo opcional "conducta_photo".
 *  { opm_id, work_date, turno, conducta_critica, conducta_comment, clear_photo, ratings, comments } */
function handle_compromiso_update(int $id): void
{
    $user = require_auth();

    $stmt = db()->prepare('SELECT * FROM compromiso_records WHERE id = ?');
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) {
        json_error('Ficha no encontrada', 404);
    }
    if ($user['role'] !== 'admin' && (int)$record['supervisor_id'] !== (int)$user['id']) {
        json_error('Solo puede editar las fichas que usted registró', 403);
    }

    $b = isset($_POST['payload']) ? (json_decode($_POST['payload'], true) ?: []) : json_body();

    $opmId    = (int)($b['opm_id'] ?? 0);
    $date     = trim($b['work_date'] ?? '');
    $turno    = $b['turno'] ?? '';
    $critica  = !empty($b['conducta_critica']);
    $comment  = trim($b['conducta_comment'] ?? '');
    $comment  = $comment === '' ? null : mb_substr($comment, 0, 500);
    $clearPhoto = !empty($b['clear_photo']);
    $ratingsIn = is_array($b['ratings'] ?? null) ? $b['ratings'] : [];
    $commentsIn = is_array($b['comments'] ?? null) ? $b['comments'] : [];

    if (!$opmId || $date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_error('OPM y fecha de turno son obligatorios', 422);
    }
    if (!in_array($turno, ['dia', 'noche'], true)) {
        json_error('Turno inválido', 422);
    }

    require_multipurpose_operator($opmId);

    [$ratings, $comments] = collect_ratings(required_activity_ids_c(), $ratingsIn, $commentsIn);

    $conductaPhoto = $record['conducta_photo'];

    if ($clearPhoto || !$critica) {
        if (!empty($record['conducta_photo'])) {
            $oldPath = __DIR__ . '/../../' . $record['conducta_photo'];
            if (is_file($oldPath)) @unlink($oldPath);
        }
        $conductaPhoto = null;
    }

    if (!empty($_FILES['conducta_photo']) && $_FILES['conducta_photo']['error'] !== UPLOAD_ERR_NO_FILE) {
        if (!empty($record['conducta_photo']) && $conductaPhoto !== null) {
            $oldPath = __DIR__ . '/../../' . $record['conducta_photo'];
            if (is_file($oldPath)) @unlink($oldPath);
        }
        $conductaPhoto = save_conducta_photo();
    }

    $obj = promedios_ficha_c($ratings, $critica);
    $year = (int)substr($date, 0, 4);
    $quarter = quarter_of($date);

    $objKeys = array_keys(OBJETIVOS_C);
    $objSet = implode(', ', array_map(fn($o) => 'obj_' . strtolower($o) . ' = ?', $objKeys));
    $objValues = array_map(fn($o) => $obj[$o], $objKeys);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "UPDATE compromiso_records
                SET opm_id = ?, work_date = ?, year = ?, quarter = ?, turno = ?,
                    conducta_critica = ?, conducta_comment = ?, conducta_photo = ?,
                    $objSet
              WHERE id = ?"
        );
        $stmt->execute([
            $opmId, $date, $year, $quarter, $turno,
            $critica ? 1 : 0, $critica ? $comment : null, $conductaPhoto,
            ...$objValues,
            $id
        ]);

        $pdo->prepare('DELETE FROM compromiso_ratings WHERE compromiso_record_id = ?')->execute([$id]);

        $map = activity_objective_map_c();
        $ins = $pdo->prepare(
            'INSERT INTO compromiso_ratings (compromiso_record_id, activity_code, objective, rating, comment)
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
