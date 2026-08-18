<?php
// ============================================================
//  Módulo "Cuidado y limpieza de instalaciones operativas"
//  Plan de Sensibilización OPS-SEN-001 v1.0
//
//  Tres casos:
//    1. Encuesta de percepción       (§ 5.1 Fase 0 y § 5.5 Fase 4)
//    2. Inspección cruzada de relevo (§ 5.3 Fase 2, estándares § 3)
//    3. Registro de hallazgos        (§ 6)
//
//  Usa la sesión del sistema (users + auth_tokens); no tiene login propio.
// ============================================================
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/http.php';

const LIMPIEZA_INSTALACIONES = ['pin', 'paradero', 'cabina', 'balanza'];
const LIMPIEZA_TURNOS        = ['dia', 'noche'];
const LIMPIEZA_FASES         = ['diagnostico', 'cierre'];
const LIMPIEZA_ESTADOS       = ['abierto', 'correccion', 'cerrado'];
const LIMPIEZA_ZONAS         = ['Muelle', 'Patio', 'Accesos', 'Sala de operaciones'];

/** Roles que registran inspecciones y hallazgos: la línea de mando del § 2 del plan. */
const LIMPIEZA_ROLES_MANDO = ['admin', 'supervisor', 'coordinator'];

/** La foto llega como data URL ya comprimida por el navegador (JPEG ~700 px). */
const LIMPIEZA_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const LIMPIEZA_PHOTO_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

// ------------------------------------------------------------ utilidades

/** Cargo del usuario para los registros: el puesto del maestro de personal. */
function limpieza_cargo(array $user): string
{
    static $cache = [];
    $id = (int)$user['id'];
    if (!isset($cache[$id])) {
        $stmt = db()->prepare('SELECT puesto FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $puesto = trim((string)($stmt->fetchColumn() ?: ''));
        if ($puesto === '') {
            // Sin puesto en el maestro se cae al rol, para no guardar un cargo vacío.
            $puesto = [
                'admin'       => 'Jefe del Centro de Operaciones',
                'supervisor'  => 'Supervisor de Operaciones',
                'coordinator' => 'Coordinador',
                'labor'       => 'Administración de personal',
            ][$user['role']] ?? 'Sin puesto asignado';
        }
        $cache[$id] = mb_substr($puesto, 0, 150);
    }
    return $cache[$id];
}

function limpieza_enum(array $data, string $key, array $valid): string
{
    $v = (string)($data[$key] ?? '');
    if (!in_array($v, $valid, true)) {
        json_error("El campo «{$key}» debe ser uno de: " . implode(', ', $valid) . '.', 422);
    }
    return $v;
}

function limpieza_text(array $data, string $key, int $max, bool $required = true): ?string
{
    $v = trim((string)($data[$key] ?? ''));
    if ($v === '') {
        if ($required) json_error("El campo «{$key}» es obligatorio.", 422);
        return null;
    }
    return mb_substr($v, 0, $max);
}

function limpieza_date(array $data, string $key): string
{
    $v = (string)($data[$key] ?? '');
    $d = DateTime::createFromFormat('Y-m-d', $v);
    if (!$d || $d->format('Y-m-d') !== $v) {
        json_error("El campo «{$key}» debe ser una fecha AAAA-MM-DD.", 422);
    }
    return $v;
}

/**
 * Guarda una foto enviada como data URL y devuelve la ruta relativa
 * (uploads/limpieza/...), igual que el resto de módulos del sistema.
 * Si el valor ya es una ruta guardada antes, la devuelve sin tocar.
 */
function limpieza_save_photo($value): ?string
{
    if (!is_string($value) || $value === '') return null;

    if (strncmp($value, 'data:', 5) !== 0) {
        // Reenvío de una foto ya almacenada: solo se aceptan rutas del módulo.
        return preg_match('#^uploads/limpieza/[\w.-]+$#', $value) === 1 ? $value : null;
    }

    if (preg_match('#^data:([\w/+.-]+);base64,(.+)$#s', $value, $m) !== 1) {
        json_error('Formato de imagen no reconocido.', 422);
    }
    $mime = strtolower($m[1]);
    if (!isset(LIMPIEZA_PHOTO_MIME[$mime])) {
        json_error('La foto debe ser JPG, PNG o WEBP.', 422);
    }
    $bin = base64_decode($m[2], true);
    if ($bin === false) {
        json_error('La imagen no se pudo decodificar.', 422);
    }
    if (strlen($bin) > LIMPIEZA_PHOTO_MAX_BYTES) {
        json_error('La foto es demasiado grande (máx. 4 MB).', 422);
    }

    $dir = __DIR__ . '/../../uploads/limpieza';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        json_error('No se pudo preparar el directorio de fotos.', 500);
    }
    $name = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . LIMPIEZA_PHOTO_MIME[$mime];
    if (file_put_contents($dir . '/' . $name, $bin) === false) {
        json_error('No se pudo guardar la foto.', 500);
    }
    return 'uploads/limpieza/' . $name;
}

// ======================================================= 1. ENCUESTAS

function limpieza_map_encuesta(array $r, array $respuestas): array
{
    return [
        'id'         => (int)$r['id'],
        'fase'       => $r['fase'],
        'fecha'      => $r['fecha'],
        'turno'      => $r['turno'],
        'empleado'   => $r['empleado'],
        'nombre'     => $r['nombre'],
        'cargo'      => $r['cargo'],
        'zona'       => $r['zona'],
        'respuestas' => $respuestas,
        'preocupa'   => $r['preocupa'],
        'comentario' => $r['comentario'] ?? '',
        'promedio'   => $r['promedio'] !== null ? (float)$r['promedio'] : null,
        'created_at' => $r['created_at'],
    ];
}

/** GET /limpieza/encuestas — el consolidado es de jefatura; el resto ve solo lo suyo. */
function handle_limpieza_encuestas_list(): void
{
    $user = require_auth();

    if ($user['role'] === 'admin') {
        $rows = db()->query('SELECT * FROM limpieza_encuestas ORDER BY id')->fetchAll();
    } else {
        $stmt = db()->prepare('SELECT * FROM limpieza_encuestas WHERE user_id = ? ORDER BY id');
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();
    }
    if (!$rows) { json_response([]); }

    // Una sola consulta para todas las respuestas, en vez de una por encuesta.
    $ids = implode(',', array_map(fn($r) => (int)$r['id'], $rows));
    $byEncuesta = [];
    foreach (db()->query("SELECT encuesta_id, pregunta, valor FROM limpieza_encuesta_respuestas WHERE encuesta_id IN ($ids)")->fetchAll() as $a) {
        $byEncuesta[(int)$a['encuesta_id']][$a['pregunta']] = (int)$a['valor'];
    }

    json_response(array_map(
        fn(array $r) => limpieza_map_encuesta($r, $byEncuesta[(int)$r['id']] ?? []),
        $rows
    ));
}

/** POST /limpieza/encuestas */
function handle_limpieza_encuesta_create(): void
{
    $user = require_auth();
    $b    = json_body();

    $respuestas = is_array($b['respuestas'] ?? null) ? $b['respuestas'] : [];
    if (!$respuestas) {
        json_error('La encuesta no tiene respuestas.', 422);
    }
    foreach ($respuestas as $pregunta => $valor) {
        if (!preg_match('/^[a-z0-9_]{1,10}$/', (string)$pregunta) || !is_numeric($valor)) {
            json_error('Hay respuestas con un formato inválido.', 422);
        }
        if ((int)$valor < 1 || (int)$valor > 5) {
            json_error('Las respuestas deben estar entre 1 y 5.', 422);
        }
    }

    $fase  = limpieza_enum($b, 'fase', LIMPIEZA_FASES);
    $fecha = limpieza_date($b, 'fecha');
    $turno = limpieza_enum($b, 'turno', LIMPIEZA_TURNOS);
    $zona  = limpieza_enum($b, 'zona', LIMPIEZA_ZONAS);

    $preocupa = $b['preocupa'] ?? null;
    if ($preocupa !== null && $preocupa !== '' && !in_array($preocupa, LIMPIEZA_INSTALACIONES, true)) {
        json_error('La instalación indicada no es válida.', 422);
    }
    $preocupa = ($preocupa === '' ? null : $preocupa);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO limpieza_encuestas
                (fase, fecha, turno, user_id, empleado, nombre, cargo, zona, preocupa, comentario, promedio)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $fase, $fecha, $turno,
            $user['id'],
            $user['employee_number'],
            $user['full_name'],
            limpieza_cargo($user),
            $zona,
            $preocupa,
            limpieza_text($b, 'comentario', 2000, false),
            round(array_sum($respuestas) / count($respuestas), 2),
        ]);
        $id = (int)$pdo->lastInsertId();

        $ins = $pdo->prepare('INSERT INTO limpieza_encuesta_respuestas (encuesta_id, pregunta, valor) VALUES (?,?,?)');
        foreach ($respuestas as $pregunta => $valor) {
            $ins->execute([$id, $pregunta, (int)$valor]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $stmt = $pdo->prepare('SELECT * FROM limpieza_encuestas WHERE id = ?');
    $stmt->execute([$id]);
    json_response(limpieza_map_encuesta($stmt->fetch(), array_map('intval', $respuestas)), 201);
}

// ==================================================== 2. INSPECCIONES

function limpieza_map_inspeccion(array $r, ?array $items = null): array
{
    $out = [
        'id'             => (int)$r['id'],
        'instalacion'    => $r['instalacion'],
        'ubicacion'      => $r['ubicacion'],
        'fecha'          => $r['fecha'],
        'turnoEntrante'  => $r['turno_entrante'],
        'turnoSaliente'  => $r['turno_saliente'],
        'inspector'      => $r['inspector'],
        'inspectorCargo' => $r['inspector_cargo'],
        'empleado'       => $r['empleado'],
        'conformidad'    => $r['conformidad'] !== null ? (int)$r['conformidad'] : null,
        'semaforo'       => $r['semaforo'],
        'created_at'     => $r['created_at'],
    ];
    if ($items !== null) $out['items'] = $items;
    return $out;
}

function limpieza_map_item(array $i): array
{
    return [
        'id'         => $i['item_id'],
        'texto'      => $i['texto'],
        'critico'    => (bool)$i['critico'],
        'estado'     => $i['estado'],
        'comentario' => $i['comentario'] ?? '',
        'foto'       => $i['foto'],
    ];
}

/** GET /limpieza/inspecciones */
function handle_limpieza_inspecciones_list(): void
{
    require_role(LIMPIEZA_ROLES_MANDO);
    $rows = db()->query('SELECT * FROM limpieza_inspecciones ORDER BY id')->fetchAll();
    json_response(array_map(fn(array $r) => limpieza_map_inspeccion($r), $rows));
}

/** GET /limpieza/inspecciones/{id} */
function handle_limpieza_inspeccion_get(int $id): void
{
    require_role(LIMPIEZA_ROLES_MANDO);

    $stmt = db()->prepare('SELECT * FROM limpieza_inspecciones WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('No se encontró la inspección.', 404);

    $items = db()->prepare('SELECT * FROM limpieza_inspeccion_items WHERE inspeccion_id = ? ORDER BY orden');
    $items->execute([$id]);
    json_response(limpieza_map_inspeccion($row, array_map('limpieza_map_item', $items->fetchAll())));
}

/** POST /limpieza/inspecciones */
function handle_limpieza_inspeccion_create(): void
{
    $user = require_role(LIMPIEZA_ROLES_MANDO);
    $b    = json_body();

    $items = is_array($b['items'] ?? null) ? array_values($b['items']) : [];
    if (!$items) json_error('La inspección no tiene ítems.', 422);
    if (count($items) > 20) json_error('La inspección tiene demasiados ítems.', 422);

    $conformidad = null;
    if (isset($b['conformidad']) && $b['conformidad'] !== null) {
        $conformidad = max(0, min(100, (int)$b['conformidad']));
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO limpieza_inspecciones
                (instalacion, ubicacion, fecha, turno_entrante, turno_saliente,
                 inspector, inspector_cargo, empleado, user_id, conformidad, semaforo)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            limpieza_enum($b, 'instalacion', LIMPIEZA_INSTALACIONES),
            limpieza_text($b, 'ubicacion', 120),
            limpieza_date($b, 'fecha'),
            limpieza_enum($b, 'turnoEntrante', LIMPIEZA_TURNOS),
            limpieza_enum($b, 'turnoSaliente', LIMPIEZA_TURNOS),
            $user['full_name'],
            limpieza_cargo($user),
            $user['employee_number'],
            $user['id'],
            $conformidad,
            limpieza_text($b, 'semaforo', 10, false),
        ]);
        $id = (int)$pdo->lastInsertId();

        $ins = $pdo->prepare(
            'INSERT INTO limpieza_inspeccion_items
                (inspeccion_id, orden, item_id, texto, critico, estado, comentario, foto)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        foreach ($items as $orden => $it) {
            if (!is_array($it)) json_error('Hay ítems con un formato inválido.', 422);
            $estado = in_array($it['estado'] ?? '', ['C', 'NC', 'NA'], true) ? $it['estado'] : 'NA';
            $ins->execute([
                $id,
                $orden + 1,
                mb_substr((string)($it['id'] ?? ''), 0, 20),
                mb_substr((string)($it['texto'] ?? ''), 0, 1000),
                !empty($it['critico']) ? 1 : 0,
                $estado,
                mb_substr(trim((string)($it['comentario'] ?? '')), 0, 2000),
                limpieza_save_photo($it['foto'] ?? null),
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $stmt = $pdo->prepare('SELECT * FROM limpieza_inspecciones WHERE id = ?');
    $stmt->execute([$id]);
    $its = $pdo->prepare('SELECT * FROM limpieza_inspeccion_items WHERE inspeccion_id = ? ORDER BY orden');
    $its->execute([$id]);

    json_response(limpieza_map_inspeccion($stmt->fetch(), array_map('limpieza_map_item', $its->fetchAll())), 201);
}

// ====================================================== 3. HALLAZGOS

function limpieza_map_hallazgo(array $r): array
{
    return [
        'id'              => (int)$r['id'],
        'fecha'           => $r['fecha'],
        'turno'           => $r['turno'],
        'instalacion'     => $r['instalacion'],
        'ubicacion'       => $r['ubicacion'],
        'descripcion'     => $r['descripcion'],
        'trabajador'      => $r['trabajador'] ?? '',
        'aprobador'       => $r['aprobador'] ?? '',
        'registradoPor'   => $r['registrado_por'],
        'registradoCargo' => $r['registrado_cargo'],
        'estado'          => $r['estado'],
        'foto'            => $r['foto'],
        'origen'          => $r['origen'],
        'cierre'          => $r['cierre_fecha'] === null ? null : [
            'fecha'         => $r['cierre_fecha'],
            'verificadoPor' => $r['cierre_por'],
            'nota'          => $r['cierre_nota'] ?? '',
        ],
        'created_at'      => $r['created_at'],
    ];
}

function limpieza_read_hallazgo(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM limpieza_hallazgos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('No se encontró el hallazgo.', 404);
    return $row;
}

/** GET /limpieza/hallazgos?instalacion=&estado=&turno= */
function handle_limpieza_hallazgos_list(): void
{
    require_role(LIMPIEZA_ROLES_MANDO);

    $where = [];
    $args  = [];
    $filtros = [
        'instalacion' => LIMPIEZA_INSTALACIONES,
        'estado'      => LIMPIEZA_ESTADOS,
        'turno'       => LIMPIEZA_TURNOS,
    ];
    foreach ($filtros as $col => $valid) {
        $v = trim((string)($_GET[$col] ?? ''));
        if ($v === '') continue;
        if (!in_array($v, $valid, true)) json_error("Filtro «{$col}» inválido.", 422);
        $where[] = "$col = ?";
        $args[]  = $v;
    }

    $sql = 'SELECT * FROM limpieza_hallazgos'
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY id';
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    json_response(array_map('limpieza_map_hallazgo', $stmt->fetchAll()));
}

/** POST /limpieza/hallazgos */
function handle_limpieza_hallazgo_create(): void
{
    $user = require_role(LIMPIEZA_ROLES_MANDO);
    $b    = json_body();

    $origen = limpieza_text($b, 'origen', 80, false);
    if ($origen !== null) {
        // Un ítem de inspección genera un solo hallazgo (uq_limpieza_hallazgo_origen).
        $stmt = db()->prepare('SELECT id FROM limpieza_hallazgos WHERE origen = ?');
        $stmt->execute([$origen]);
        if ($stmt->fetchColumn() !== false) {
            json_error('Ese ítem de la inspección ya tiene un hallazgo registrado.', 409);
        }
    }

    $descripcion = limpieza_text($b, 'descripcion', 4000);
    if (mb_strlen($descripcion) < 10) {
        json_error('La descripción debe tener al menos 10 caracteres.', 422);
    }

    $stmt = db()->prepare(
        'INSERT INTO limpieza_hallazgos
            (fecha, turno, instalacion, ubicacion, descripcion, trabajador, aprobador,
             registrado_por, registrado_cargo, user_id, estado, foto, origen)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        limpieza_date($b, 'fecha'),
        limpieza_enum($b, 'turno', LIMPIEZA_TURNOS),
        limpieza_enum($b, 'instalacion', LIMPIEZA_INSTALACIONES),
        limpieza_text($b, 'ubicacion', 120),
        $descripcion,
        limpieza_text($b, 'trabajador', 120, false),
        limpieza_text($b, 'aprobador', 150, false),
        $user['full_name'],
        limpieza_cargo($user),
        $user['id'],
        'abierto',
        limpieza_save_photo($b['foto'] ?? null),
        $origen,
    ]);

    json_response(limpieza_map_hallazgo(limpieza_read_hallazgo((int)db()->lastInsertId())), 201);
}

/** POST /limpieza/hallazgos/{id} — cambia el estado y la verificación de cierre. */
function handle_limpieza_hallazgo_update(int $id): void
{
    $user = require_role(LIMPIEZA_ROLES_MANDO);
    limpieza_read_hallazgo($id);

    $b      = json_body();
    $estado = limpieza_enum($b, 'estado', LIMPIEZA_ESTADOS);
    $cierre = is_array($b['cierre'] ?? null) ? $b['cierre'] : [];

    if ($estado === 'cerrado') {
        db()->prepare(
            'UPDATE limpieza_hallazgos
                SET estado = ?, cierre_fecha = ?, cierre_por = ?, cierre_nota = ?
              WHERE id = ?'
        )->execute([
            $estado,
            !empty($cierre['fecha']) ? limpieza_date($cierre, 'fecha') : date('Y-m-d'),
            mb_substr((string)($cierre['verificadoPor'] ?? $user['full_name']), 0, 120),
            mb_substr(trim((string)($cierre['nota'] ?? '')), 0, 2000),
            $id,
        ]);
    } else {
        // Reabrir limpia la verificación anterior: no debe quedar un cierre huérfano.
        db()->prepare(
            'UPDATE limpieza_hallazgos
                SET estado = ?, cierre_fecha = NULL, cierre_por = NULL, cierre_nota = NULL
              WHERE id = ?'
        )->execute([$estado, $id]);
    }

    json_response(limpieza_map_hallazgo(limpieza_read_hallazgo($id)));
}
