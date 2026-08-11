<?php
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/rules.php';
require_once __DIR__ . '/../lib/rules_compromiso.php';
require_once __DIR__ . '/shifts.php';
require_once __DIR__ . '/compromiso.php';

/** GET /evaluations/{opmId}?year=&quarter= */
function handle_evaluation_get(int $opmId): void
{
    require_auth();
    $year = (int)($_GET['year'] ?? date('Y'));
    $quarter = (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));

    $opmStmt = db()->prepare('SELECT id, code, full_name, puesto FROM opms WHERE id = ?');
    $opmStmt->execute([$opmId]);
    $opm = $opmStmt->fetch();
    if (!$opm) {
        json_error('OPM no encontrado', 404);
    }

    // Desenvolvimiento (70%): fichas de turno (shift_records).
    $fichas = fetch_shift_rows($year, $quarter, $opmId);
    $allFichas = fetch_shift_rows($year, $quarter);
    $turnosTotal = count(array_unique(array_map(fn($f) => $f['work_date'] . '|' . $f['turno'], $allFichas)));
    $c = consolidar($fichas);
    $estado = estado($c, $turnosTotal ?: null);

    // Compromiso (30%): fichas de conducta (compromiso_records).
    $fichasC = fetch_compromiso_rows($year, $quarter, $opmId);
    $cC = consolidar_c($fichasC);
    $estadoC = estado_c($cC);

    $objScore = weighted_avg(OBJETIVOS, $c['obj']);
    $condScore = weighted_avg(OBJETIVOS_C, $cC['obj']);
    $preview = combinar_final($objScore, $condScore);

    $evalStmt = db()->prepare('SELECT * FROM evaluations WHERE opm_id = ? AND year = ? AND quarter = ?');
    $evalStmt->execute([$opmId, $year, $quarter]);
    $evaluation = $evalStmt->fetch();

    json_response([
        'opm' => $opm, 'year' => $year, 'quarter' => $quarter,
        'consolidado' => ['n' => $c['n'], 'supers' => $c['supers'], 'obj' => $c['obj'], 'eventos' => $c['eventos'], 'estado' => $estado],
        'consolidado_compromiso' => ['n' => $cC['n'], 'supers' => $cC['supers'], 'obj' => $cC['obj'], 'criticas' => $cC['criticas'], 'estado' => $estadoC],
        'preview' => $preview,
        'evaluation' => $evaluation ?: null,
        'puede_evaluar' => $estado['t'] === 'VÁLIDA' && $estadoC['t'] === 'VÁLIDA',
    ]);
}

/** POST /evaluations
 *  { opm_id, year, quarter, evidencias_comentarios, pip_activado, pip_acciones }
 *  Los puntajes (objetivos 70% + conductas 30%) siempre se recalculan en el servidor
 *  a partir de shift_records y compromiso_records — nunca se confía en el cliente. */
function handle_evaluation_save(): void
{
    $user = require_auth();
    $b = json_body();
    $opmId = (int)($b['opm_id'] ?? 0);
    $year = (int)($b['year'] ?? 0);
    $quarter = (int)($b['quarter'] ?? 0);
    $evidencias = trim($b['evidencias_comentarios'] ?? '');
    $evidencias = $evidencias === '' ? null : mb_substr($evidencias, 0, 2000);

    if (!$opmId || !$year || $quarter < 1 || $quarter > 4) {
        json_error('OPM, año y trimestre son obligatorios', 422);
    }

    $opmStmt = db()->prepare('SELECT id FROM opms WHERE id = ?');
    $opmStmt->execute([$opmId]);
    if (!$opmStmt->fetchColumn()) {
        json_error('OPM no encontrado', 404);
    }

    $fichas = fetch_shift_rows($year, $quarter, $opmId);
    $allFichas = fetch_shift_rows($year, $quarter);
    $turnosTotal = count(array_unique(array_map(fn($f) => $f['work_date'] . '|' . $f['turno'], $allFichas)));
    $c = consolidar($fichas);
    $estado = estado($c, $turnosTotal ?: null);

    $fichasC = fetch_compromiso_rows($year, $quarter, $opmId);
    $cC = consolidar_c($fichasC);
    $estadoC = estado_c($cC);

    // Se permite guardar con evidencia incompleta: el promedio general (diluido por consolidar())
    // ya refleja que falta evidencia. Solo se exige que haya al menos una ficha calificada en
    // cada módulo (si no, no hay nada que promediar).
    $objScore = weighted_avg(OBJETIVOS, $c['obj']);
    $condScore = weighted_avg(OBJETIVOS_C, $cC['obj']);
    $r = combinar_final($objScore, $condScore);
    if (!isset($r['final'])) {
        json_error('No se pudo calcular la evaluación: faltan datos', 422);
    }

    $stmt = db()->prepare(
        'INSERT INTO evaluations
           (opm_id, year, quarter, obj_score, cond_score, comb_score, prelim_level, final_level, blocked,
            n_fichas, n_supervisors, n_fichas_compromiso, n_supervisors_compromiso,
            evidencias_comentarios, evaluated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           obj_score = VALUES(obj_score), cond_score = VALUES(cond_score),
           comb_score = VALUES(comb_score), prelim_level = VALUES(prelim_level),
           final_level = VALUES(final_level), blocked = VALUES(blocked),
           n_fichas = VALUES(n_fichas), n_supervisors = VALUES(n_supervisors),
           n_fichas_compromiso = VALUES(n_fichas_compromiso), n_supervisors_compromiso = VALUES(n_supervisors_compromiso),
           evidencias_comentarios = VALUES(evidencias_comentarios), evaluated_by = VALUES(evaluated_by)'
    );
    $stmt->execute([
        $opmId, $year, $quarter, $r['objScore'], $r['condScore'], $r['comb'], $r['prelim'], $r['final'], $r['bloqueado'] ? 1 : 0,
        $c['n'], $c['supers'], $cC['n'], $cC['supers'],
        $evidencias, $user['id'],
    ]);

    $idStmt = db()->prepare('SELECT id FROM evaluations WHERE opm_id = ? AND year = ? AND quarter = ?');
    $idStmt->execute([$opmId, $year, $quarter]);
    $evaluationId = (int)$idStmt->fetchColumn();

    json_response(['ok' => true, 'id' => $evaluationId, 'result' => $r]);
}

/** GET /evaluations?year=&quarter= — todas las evaluaciones guardadas del período. */
function handle_evaluations_list(): void
{
    require_auth();
    $year = (int)($_GET['year'] ?? date('Y'));
    $quarter = (int)($_GET['quarter'] ?? quarter_of(date('Y-m-d')));
    $stmt = db()->prepare(
        'SELECT e.*, o.code AS opm_code, o.full_name AS opm_name, u.full_name AS evaluated_by_name
           FROM evaluations e
           JOIN opms  o ON o.id = e.opm_id
           JOIN users u ON u.id = e.evaluated_by
          WHERE e.year = ? AND e.quarter = ?
          ORDER BY o.code'
    );
    $stmt->execute([$year, $quarter]);
    json_response(['evaluations' => $stmt->fetchAll()]);
}
