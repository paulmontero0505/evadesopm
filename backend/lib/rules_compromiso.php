<?php
// ============================================================
//  Reglas de negocio de la Evaluación de Compromiso (OPM).
//  Única fuente de verdad: el frontend solo pinta lo que aquí
//  se define (GET /compromiso-rules) y el servidor recalcula
//  siempre los puntajes al guardar — nunca se confía en un
//  promedio enviado por el cliente.
// ============================================================

// 'en' => nombre en inglés, usado por el reporte bilingüe de evaluación.
const OBJETIVOS_C = [
    'O1' => ['n' => 'Comunicación',                'c' => '#0060A9', 'peso' => 1 / 7, 't' => 'Comunicación',                'en' => 'Communication'],
    'O2' => ['n' => 'Adaptabilidad',                'c' => '#7A5195', 'peso' => 1 / 7, 't' => 'Adaptabilidad',               'en' => 'Adaptability'],
    'O3' => ['n' => 'Trabajo en equipo',            'c' => '#1E7B34', 'peso' => 1 / 7, 't' => 'Trabajo en Equipo',           'en' => 'Teamwork'],
    'O4' => ['n' => 'Iniciativa e innovación',      'c' => '#EF7D00', 'peso' => 1 / 7, 't' => 'Iniciativa e Innovación',     'en' => 'Initiative and innovation'],
    'O5' => ['n' => 'Respeto',                      'c' => '#C0392B', 'peso' => 1 / 7, 't' => 'Respeto',                     'en' => 'Respect'],
    'O6' => ['n' => 'Orientación a la seguridad',   'c' => '#B8860B', 'peso' => 1 / 7, 't' => 'Orientación a la Seguridad',  'en' => 'Safety orientation'],
    'O7' => ['n' => 'Orientación a resultados',     'c' => '#002E6D', 'peso' => 1 / 7, 't' => 'Orientación a Resultados',    'en' => 'Results orientation'],
];

// 'd' => descriptores de la rúbrica 1..5 (misma lógica que en rules.php).
const ACTIVIDADES_C = [
    ['id' => 'com1', 'o' => 'O1', 'n' => 'Recepción y adopción de feedback / instrucciones operativas', 'd' => [
        'Rechaza el feedback o discute la instrucción; no la ejecuta.',
        'Escucha pero no aplica lo indicado; repite el error observado.',
        'Recibe la instrucción y la cumple correctamente.',
        'Aplica el feedback de inmediato y confirma que comprendió lo indicado.',
        'Busca feedback de forma activa, lo aplica y transmite lo aprendido al equipo.',
    ]],
    ['id' => 'ada1', 'o' => 'O2', 'n' => 'Disposición para apoyar en tareas críticas del turno', 'd' => [
        'Se niega a apoyar fuera de su tarea habitual.',
        'Apoya solo si se le insiste y con evidente desagrado.',
        'Apoya cuando se le solicita.',
        'Se ofrece a apoyar en los momentos críticos sin que se le pida.',
        'Se anticipa a la necesidad, reorganiza su tarea y motiva al equipo a apoyar.',
    ]],
    ['id' => 'teq1', 'o' => 'O3', 'n' => 'Proactividad para prevenir conflictos en el equipo', 'd' => [
        'Genera o alimenta conflictos dentro del equipo.',
        'Se mantiene al margen y deja escalar las fricciones.',
        'Evita conflictos y mantiene un trato correcto.',
        'Interviene a tiempo para bajar tensiones y busca acuerdos.',
        'Es factor de cohesión: media, resuelve y previene conflictos antes de que aparezcan.',
    ]],
    ['id' => 'teq2', 'o' => 'O3', 'n' => 'Participación activa en charlas de 5 minutos / inducciones', 'd' => [
        'No asiste o interrumpe la charla.',
        'Asiste de forma pasiva y distraída.',
        'Asiste y atiende la charla.',
        'Participa, pregunta y aporta ejemplos de la operación.',
        'Lidera o expone charlas, aporta casos reales y refuerza el mensaje durante el turno.',
    ]],
    ['id' => 'ini1', 'o' => 'O4', 'n' => 'Reporte oportuno de novedades o condiciones subestándar', 'd' => [
        'No reporta pese a detectar la condición.',
        'Reporta tarde o de forma incompleta.',
        'Reporta las novedades relevantes del turno.',
        'Reporta de inmediato y con detalle útil para corregir.',
        'Reporta, propone la solución y hace seguimiento hasta el cierre.',
    ]],
    ['id' => 'res1', 'o' => 'O5', 'n' => 'Comunicación asertiva y respeto con compañeros y superiores', 'd' => [
        'Trato irrespetuoso o agresivo con compañeros o superiores.',
        'Trato cortante; responde de mala forma ante la presión.',
        'Trato respetuoso y correcto.',
        'Comunicación asertiva: plantea desacuerdos sin faltar el respeto.',
        'Referente de buen trato; sostiene el respeto incluso en situaciones de alta tensión.',
    ]],
    ['id' => 'seg1', 'o' => 'O6', 'n' => 'Cultura de trabajo seguro', 'd' => [
        'Incumple normas de seguridad o genera una condición insegura.',
        'Cumple parcialmente las normas; requiere correcciones frecuentes.',
        'Cumple las normas y usa correctamente los controles establecidos (EPP, permisos, bloqueos, señalización).',
        'Actúa de forma preventiva: identifica riesgos antes de operar y sostiene prácticas seguras durante todo el turno.',
        'Promueve activamente la seguridad: corrige desviaciones, aplica la parada segura y da el ejemplo al equipo.',
    ]],
    ['id' => 'seg2', 'o' => 'O6', 'n' => 'Cumplimiento del orden y limpieza (5S) en áreas comunes', 'd' => [
        'Deja sucias las áreas comunes (comedor, vestuario, servicios).',
        'Ordena solo cuando se le llama la atención.',
        'Mantiene el orden y la limpieza básicos de las áreas comunes.',
        'Deja las áreas mejor de lo que las encontró, de forma constante.',
        'Promueve las 5S en el equipo y propone mejoras de orden en las áreas comunes.',
    ]],
    ['id' => 'ore1', 'o' => 'O7', 'n' => 'Puntualidad en el relevo e inicio de turno', 'd' => [
        'Llega tarde de forma reiterada y retrasa el relevo.',
        'Llega sobre la hora o con demoras ocasionales que afectan el inicio.',
        'Llega a la hora e inicia el turno sin retrasos.',
        'Llega con anticipación y realiza un relevo ordenado e informado.',
        'Siempre anticipado: entrega y recibe el turno con información completa que evita retrabajos.',
    ]],
    ['id' => 'ore2', 'o' => 'O7', 'n' => 'Permanencia en su puesto de trabajo asignado', 'd' => [
        'Abandona el puesto sin autorización.',
        'Se ausenta con frecuencia o demora en regresar.',
        'Permanece en su puesto durante el turno.',
        'Permanece atento en su puesto y avisa cualquier ausencia justificada.',
        'Permanencia total y cobertura del puesto; coordina reemplazo antes de retirarse.',
    ]],
];

// Conducta de seguridad crítica (SI/NO): si se marca SI, topa el objetivo O5 (Respeto).
const CONDUCTA_CRITICA_C = [
    'o' => 'O5',
    'n' => 'Falta de respeto grave o incumplimiento de consigna directa en el turno',
];

const ESCALA_C = [
    ['v' => 1, 'l' => 'Insatisfactorio', 'c' => '#C0392B'],
    ['v' => 2, 'l' => 'Regular',         'c' => '#E67E22'],
    ['v' => 3, 'l' => 'Aceptable',       'c' => '#B8860B'],
    ['v' => 4, 'l' => 'Bueno',           'c' => '#0060A9'],
    ['v' => 5, 'l' => 'Excelente',       'c' => '#1E7B34'],
];

const PARAMS_C = [
    'sobre5'     => 4.5, 'cumple5' => 3.0,
    'minimo'     => 3.0,
    'topeEvento' => 2.5,
    'piso'       => 4,
    'minSupers'  => 3,
];

/** Todo el catálogo, para GET /compromiso-rules. */
function rules_catalog_c(): array
{
    require_once __DIR__ . '/rules_i18n.php';
    return [
        'objetivos'         => OBJETIVOS_C,
        'actividades'       => actividades_c_i18n(ACTIVIDADES_C),
        'conducta_critica'  => CONDUCTA_CRITICA_C + ['n_en' => CONDUCTA_CRITICA_C_EN],
        'escala'            => escala_i18n(ESCALA_C),
        'params'            => PARAMS_C,
    ];
}

/** Mapa activity_code => objetivo (O1..O7). */
function activity_objective_map_c(): array
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (ACTIVIDADES_C as $a) $map[$a['id']] = $a['o'];
    }
    return $map;
}

/** IDs de todas las actividades de conducta (siempre las mismas, no dependen de carga/nave). */
function required_activity_ids_c(): array
{
    return array_map(fn($a) => $a['id'], ACTIVIDADES_C);
}

function nivel5_c(?float $v): ?string
{
    if ($v === null) return null;
    if ($v >= PARAMS_C['sobre5']) return 'Sobre';
    if ($v >= PARAMS_C['cumple5']) return 'Cumple';
    return 'Por Debajo';
}

/**
 * Promedios por objetivo de UNA ficha de compromiso.
 * $ratings: [ activity_code => rating(1-5) | null ]
 * Un null significa "No aplica": no entra en la suma ni en el divisor.
 */
function promedios_ficha_c(array $ratings, bool $conductaCritica): array
{
    $map = activity_objective_map_c();
    $acc = [];
    foreach ($ratings as $code => $v) {
        if ($v === null) continue;
        $o = $map[$code] ?? null;
        if ($o === null) continue;
        $acc[$o][] = (int)$v;
    }
    $out = [];
    foreach (array_keys(OBJETIVOS_C) as $o) {
        if (empty($acc[$o])) { $out[$o] = null; continue; }
        $m = array_sum($acc[$o]) / count($acc[$o]);
        if ($conductaCritica && $o === CONDUCTA_CRITICA_C['o']) {
            $m = min($m, PARAMS_C['topeEvento']);
        }
        $out[$o] = round($m, 2);
    }
    return $out;
}

/**
 * Consolida varias fichas de compromiso (arrays con obj_o1..o7, supervisor_id, conducta_critica).
 * El promedio de cada objetivo se divide entre el máximo de (fichas calificadas, piso de
 * fichas mínimas del trimestre): así una sola ficha con nota 5 no muestra un 5.00 engañoso
 * como si el ciclo estuviera completo, sino 5/piso — reflejando que falta evidencia.
 */
function consolidar_c(array $fichas): array
{
    $out = [];
    foreach (array_keys(OBJETIVOS_C) as $o) {
        $col = 'obj_' . strtolower($o);
        $vals = array_values(array_filter(array_map(
            fn($f) => $f[$col] !== null ? (float)$f[$col] : null, $fichas
        ), fn($v) => $v !== null));
        $divisor = max(count($vals), PARAMS_C['piso']);
        $out[$o] = $vals ? round(array_sum($vals) / $divisor, 2) : null;
    }
    $supers = count(array_unique(array_map(fn($f) => (int)$f['supervisor_id'], $fichas)));
    $criticas = count(array_filter($fichas, fn($f) => (int)$f['conducta_critica'] === 1));
    // El administrador no tiene límites ni excepciones: si evaluó, alcanza para validar la evidencia
    // por sí solo (para poder probar el flujo completo sin depender de 3 supervisores distintos).
    $hasAdmin = count(array_filter($fichas, fn($f) => ($f['supervisor_role'] ?? null) === 'admin')) > 0;
    return ['obj' => $out, 'n' => count($fichas), 'supers' => $supers, 'criticas' => $criticas, 'hasAdmin' => $hasAdmin];
}

/** Estado de validez de la evidencia acumulada de compromiso. */
function estado_c(array $c): array
{
    if ($c['n'] === 0) return ['t' => 'SIN FICHAS', 'c' => '#6B7280'];
    if ($c['n'] < PARAMS_C['piso']) return ['t' => 'EVIDENCIA INSUFICIENTE', 'c' => '#C0392B'];
    if (!($c['hasAdmin'] ?? false) && $c['supers'] < PARAMS_C['minSupers']) {
        return ['t' => 'POCOS EVALUADORES', 'c' => '#B8860B'];
    }
    return ['t' => 'VÁLIDA', 'c' => '#1E7B34'];
}
