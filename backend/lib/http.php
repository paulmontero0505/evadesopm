<?php
// ============================================================
//  Utilidades HTTP: CORS, JSON, errores
// ============================================================

function send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Responde JSON y termina. */
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void
{
    json_response(['error' => $message], $status);
}

/**
 * Normaliza el valor enviado para una actividad:
 *   1..5  => int (calificada)
 *   'na'  => null (No aplica: no se observó en el turno, no promedia)
 *   otro  => false (inválido / sin calificar)
 */
function parse_rating($v)
{
    if (is_string($v) && strtolower(trim($v)) === 'na') return null;
    if (!is_numeric($v)) return false;
    $n = (int)$v;
    return ($n >= 1 && $n <= 5) ? $n : false;
}

/**
 * Valida y normaliza las calificaciones + comentarios de una ficha.
 * Toda actividad requerida debe venir con 1..5 o con 'na' (No aplica); si todas
 * son 'na' la ficha no aporta evidencia y se rechaza.
 * Devuelve [ratings, comments] con ratings[code] = int|null.
 */
function collect_ratings(array $required, array $ratingsIn, array $commentsIn): array
{
    $ratings = [];
    $comments = [];
    $evaluadas = 0;
    foreach ($required as $code) {
        $v = parse_rating($ratingsIn[$code] ?? false);
        if ($v === false) {
            json_error("Falta calificar la actividad: $code", 422);
        }
        if ($v !== null) $evaluadas++;
        $ratings[$code] = $v;
        $cmt = trim((string)($commentsIn[$code] ?? ''));
        $comments[$code] = $cmt === '' ? null : mb_substr($cmt, 0, 500);
    }
    if ($evaluadas === 0) {
        json_error('La ficha debe tener al menos una actividad calificada; no puede marcar "No aplica" en todas.', 422);
    }
    return [$ratings, $comments];
}

/** Lee y decodifica el cuerpo JSON de la petición. */
function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
