<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/xlsx.php';

function assignment_name_key(string $value): string
{
    $value = trim(preg_replace('/\s+/u', ' ', $value));
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    return mb_strtoupper($ascii === false ? $value : $ascii);
}

function assignment_previous_shift(string $date, string $turno): array
{
    return $turno === 'dia'
        ? [date('Y-m-d', strtotime($date . ' -1 day')), 'noche']
        : [$date, 'dia'];
}

function opm_worked_previous_shift(int $opmId, string $date, string $turno): bool
{
    [$previousDate, $previousTurno] = assignment_previous_shift($date, $turno);
    $stmt = db()->prepare('SELECT 1 FROM opm_assignments WHERE opm_id=? AND work_date=? AND turno=? LIMIT 1');
    $stmt->execute([$opmId, $previousDate, $previousTurno]);
    return (bool)$stmt->fetchColumn();
}

function supervisor_worked_previous_shift(int $userId, string $date, string $turno): bool
{
    [$previousDate, $previousTurno] = assignment_previous_shift($date, $turno);
    $stmt = db()->prepare('SELECT 1 FROM supervisor_assignments WHERE user_id=? AND work_date=? AND turno=? LIMIT 1');
    $stmt->execute([$userId, $previousDate, $previousTurno]);
    return (bool)$stmt->fetchColumn();
}

/** GET /turno-team?date=YYYY-MM-DD&turno=dia|noche&type=all|opms|supervisors
 * Devuelve todo el catálogo activo y marca quiénes pertenecen al turno actual
 * y quiénes deben descansar por haber cubierto el turno inmediatamente anterior. */
function handle_shift_team_list(): void
{
    require_auth();
    $date = trim($_GET['date'] ?? '');
    $turno = $_GET['turno'] ?? '';
    $type = $_GET['type'] ?? 'opms';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($turno, ['dia', 'noche'], true) || !in_array($type, ['all', 'opms', 'supervisors'], true)) {
        json_error('Fecha, turno y equipo válidos son obligatorios.', 422);
    }

    [$previousDate, $previousTurno] = assignment_previous_shift($date, $turno);

    if ($type === 'all') {
        $stmt = db()->prepare(
            "SELECT o.id AS person_id, 'opm' AS person_type, o.code, o.full_name, o.fecha_nacimiento, o.puesto,
                    current_assignment.id AS assignment_id, current_assignment.funcion_1, current_assignment.funcion_2,
                    current_assignment.zona_1, current_assignment.nave, current_assignment.nave_2,
                    CASE WHEN current_assignment.id IS NULL THEN 0 ELSE 1 END AS in_turn,
                    CASE WHEN previous_assignment.id IS NULL THEN 0 ELSE 1 END AS worked_previous_turn
               FROM opms o
               LEFT JOIN opm_assignments current_assignment ON current_assignment.opm_id=o.id AND current_assignment.work_date=? AND current_assignment.turno=?
               LEFT JOIN opm_assignments previous_assignment ON previous_assignment.opm_id=o.id AND previous_assignment.work_date=? AND previous_assignment.turno=?
              WHERE o.active=1
             UNION ALL
             SELECT u.id AS person_id, u.role AS person_type, u.employee_number AS code, u.full_name, NULL AS fecha_nacimiento, COALESCE(current_assignment.puesto, u.puesto) AS puesto,
                    current_assignment.id AS assignment_id, current_assignment.funcion_1, current_assignment.funcion_2,
                    current_assignment.zona_1, current_assignment.nave, current_assignment.nave_2,
                    CASE WHEN current_assignment.id IS NULL THEN 0 ELSE 1 END AS in_turn,
                    CASE WHEN previous_assignment.id IS NULL THEN 0 ELSE 1 END AS worked_previous_turn
               FROM users u
               LEFT JOIN supervisor_assignments current_assignment ON current_assignment.user_id=u.id AND current_assignment.work_date=? AND current_assignment.turno=?
               LEFT JOIN supervisor_assignments previous_assignment ON previous_assignment.user_id=u.id AND previous_assignment.work_date=? AND previous_assignment.turno=?
              WHERE u.active=1 AND u.role IN ('supervisor','coordinator')
             ORDER BY in_turn DESC, full_name"
        );
        $stmt->execute([$date, $turno, $previousDate, $previousTurno, $date, $turno, $previousDate, $previousTurno]);
        json_response(['members' => $stmt->fetchAll(), 'previous_shift' => ['date' => $previousDate, 'turno' => $previousTurno]]);
    }

    if ($type === 'opms') {
        $stmt = db()->prepare(
            "SELECT o.id AS person_id, o.code, o.full_name,
                    COALESCE(current_assignment.puesto, o.puesto) AS puesto,
                    current_assignment.id AS assignment_id, current_assignment.funcion_1, current_assignment.funcion_2,
                    current_assignment.zona_1, current_assignment.nave, current_assignment.nave_2,
                    CASE WHEN current_assignment.id IS NULL THEN 0 ELSE 1 END AS in_turn,
                    CASE WHEN previous_assignment.id IS NULL THEN 0 ELSE 1 END AS worked_previous_turn
               FROM opms o
               LEFT JOIN opm_assignments current_assignment
                 ON current_assignment.opm_id=o.id AND current_assignment.work_date=? AND current_assignment.turno=?
               LEFT JOIN opm_assignments previous_assignment
                 ON previous_assignment.opm_id=o.id AND previous_assignment.work_date=? AND previous_assignment.turno=?
              WHERE o.active=1
              ORDER BY CASE WHEN current_assignment.id IS NULL THEN 1 ELSE 0 END, o.full_name"
        );
    } else {
        $stmt = db()->prepare(
            "SELECT u.id AS person_id, u.employee_number AS code, u.full_name, u.role,
                    current_assignment.id AS assignment_id, current_assignment.funcion_1, current_assignment.funcion_2,
                    current_assignment.zona_1, current_assignment.puesto, current_assignment.nave, current_assignment.nave_2,
                    CASE WHEN current_assignment.id IS NULL THEN 0 ELSE 1 END AS in_turn,
                    CASE WHEN previous_assignment.id IS NULL THEN 0 ELSE 1 END AS worked_previous_turn
               FROM users u
               LEFT JOIN supervisor_assignments current_assignment
                 ON current_assignment.user_id=u.id AND current_assignment.work_date=? AND current_assignment.turno=?
               LEFT JOIN supervisor_assignments previous_assignment
                 ON previous_assignment.user_id=u.id AND previous_assignment.work_date=? AND previous_assignment.turno=?
              WHERE u.active=1 AND u.role IN ('supervisor','coordinator')
              ORDER BY CASE WHEN current_assignment.id IS NULL THEN 1 ELSE 0 END, u.full_name"
        );
    }
    $stmt->execute([$date, $turno, $previousDate, $previousTurno]);
    json_response([
        'members' => $stmt->fetchAll(),
        'previous_shift' => ['date' => $previousDate, 'turno' => $previousTurno],
    ]);
}

/** GET /assignments?date=YYYY-MM-DD&turno=dia|noche */
function handle_assignments_list(): void
{
    require_auth();
    $date = trim($_GET['date'] ?? ''); $turno = $_GET['turno'] ?? '';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($turno, ['dia', 'noche'], true)) {
        json_error('Fecha y turno válidos son obligatorios', 422);
    }
    $stmt = db()->prepare(
        'SELECT a.id, a.work_date, a.turno, a.funcion_1, a.funcion_2, a.zona_1, a.puesto, a.nave, a.nave_2,
                o.id AS opm_id, o.code AS opm_code, o.full_name AS opm_name
           FROM opm_assignments a JOIN opms o ON o.id = a.opm_id
          WHERE a.work_date = ? AND a.turno = ? AND o.active = 1
          ORDER BY COALESCE(a.zona_1, \'\'), o.full_name'
    );
    $stmt->execute([$date, $turno]);
    json_response(['assignments' => $stmt->fetchAll()]);
}

/** GET /assignments/template (admin) */
function handle_assignments_template(): void
{
    require_role(['admin']);
    $bytes = xlsx_build_assignments_template();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="plantilla_asignacion_opm.xlsx"');
    header('Content-Length: ' . strlen($bytes)); echo $bytes; exit;
}

/** POST /assignments/import (admin); la fecha y turno seleccionados se aplican a las filas sin fecha. */
function handle_assignments_import(): void
{
    $user = require_role(['admin']);
    $turno = $_POST['turno'] ?? '';
    if (!in_array($turno, ['dia', 'noche'], true)) json_error('Seleccione el turno para estas asignaciones', 422);
    // La versión actual del frontend envía la fecha seleccionada. Como respaldo para
    // sesiones que aún tienen el JavaScript anterior en caché, se usa la fecha del servidor.
    $selectedDate = trim($_POST['date'] ?? '') ?: date('Y-m-d');
    $puesto = mb_substr(trim($_POST['puesto'] ?? ''), 0, 150);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $selectedDate)) json_error('Seleccione una fecha válida para estas asignaciones.', 422);
    if ($puesto === '') json_error('Seleccione el cargo para estas asignaciones.', 422);
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) json_error('Adjunte la plantilla Excel de asignaciones.', 422);
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK || !preg_match('/\.xlsx$/i', $file['name']) || $file['size'] > 10 * 1024 * 1024) {
        json_error('El archivo debe ser un Excel .xlsx de hasta 10 MB.', 422);
    }
    try { $rows = xlsx_read_assignments($file['tmp_name']); }
    catch (Throwable $e) { json_error('No se pudo leer el Excel: ' . $e->getMessage(), 422); }
    if (!$rows) json_error('No se encontraron asignaciones en la plantilla.', 422);

    $opms = db()->prepare('SELECT id, full_name FROM opms WHERE active = 1 AND puesto = ?');
    $opms->execute([$puesto]);
    $opms = $opms->fetchAll();
    $opmByName = [];
    foreach ($opms as $opm) $opmByName[assignment_name_key($opm['full_name'])] = (int)$opm['id'];
    $valid = []; $errors = [];
    foreach ($rows as $row) {
        $row['date'] = $row['date'] ?: $selectedDate;
        $opmId = $opmByName[assignment_name_key($row['name'])] ?? null;
        if (!$row['date'] || !$opmId || opm_worked_previous_shift((int)$opmId, $row['date'], $turno)) { $errors[] = $row['row']; continue; }
        $row['opm_id'] = $opmId; $valid[] = $row;
    }
    if (!$valid) json_error('Ninguna fila es válida. Verifique fecha y que cada nombre exista en Colaboradores (OPM).', 422);

    $dates = array_values(array_unique(array_column($valid, 'date')));
    $pdo = db(); $pdo->beginTransaction();
    try {
        $delete = $pdo->prepare('DELETE a FROM opm_assignments a JOIN opms o ON o.id=a.opm_id WHERE a.work_date = ? AND a.turno = ? AND o.puesto = ?');
        foreach ($dates as $date) $delete->execute([$date, $turno, $puesto]);
        $insert = $pdo->prepare(
            'INSERT INTO opm_assignments (opm_id, work_date, turno, funcion_1, funcion_2, zona_1, puesto, nave, nave_2, imported_by)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        foreach ($valid as $row) $insert->execute([$row['opm_id'], $row['date'], $turno,
            mb_substr(trim($row['funcion_1']), 0, 150) ?: null, mb_substr(trim($row['funcion_2']), 0, 150) ?: null,
            mb_substr(trim($row['zona_1']), 0, 150) ?: null, $puesto,
            mb_substr(trim($row['nave']), 0, 150) ?: null, mb_substr(trim($row['nave_2']), 0, 150) ?: null, $user['id']]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    json_response(['ok' => true, 'imported' => count($valid), 'dates' => $dates, 'errors' => $errors]);
}

/** POST /assignments/individual (admin): agrega o actualiza un colaborador en un turno. */
function handle_assignment_create_individual(): void
{
    $user = require_role(['admin']); $b = json_body();
    $opmId = (int)($b['opm_id'] ?? 0); $date = trim($b['date'] ?? ''); $turno = $b['turno'] ?? '';
    if (!$opmId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($turno, ['dia', 'noche'], true)) json_error('Seleccione colaborador, fecha y turno válidos.', 422);
    $exists = db()->prepare('SELECT id FROM opms WHERE id=? AND active=1'); $exists->execute([$opmId]);
    if (!$exists->fetchColumn()) json_error('El colaborador no está disponible.', 422);
    if (opm_worked_previous_shift($opmId, $date, $turno)) json_error('El colaborador cubrio el turno anterior y debe descansar antes de otro turno.', 422);
    $values = [];
    foreach (['funcion_1','funcion_2','zona_1','puesto','nave','nave_2'] as $field) $values[$field] = mb_substr(trim($b[$field] ?? ''), 0, 150) ?: null;
    db()->prepare('INSERT INTO opm_assignments (opm_id,work_date,turno,funcion_1,funcion_2,zona_1,puesto,nave,nave_2,imported_by) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE funcion_1=VALUES(funcion_1),funcion_2=VALUES(funcion_2),zona_1=VALUES(zona_1),puesto=VALUES(puesto),nave=VALUES(nave),nave_2=VALUES(nave_2),imported_by=VALUES(imported_by)')->execute([$opmId,$date,$turno,$values['funcion_1'],$values['funcion_2'],$values['zona_1'],$values['puesto'],$values['nave'],$values['nave_2'],$user['id']]);
    json_response(['ok'=>true]);
}
