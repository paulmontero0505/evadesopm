<?php
// ============================================================
//  Reglas de negocio del Sistema de Desempeño OPM.
//  Única fuente de verdad: el frontend solo pinta lo que aquí
//  se define (GET /rules) y el servidor recalcula siempre los
//  puntajes al guardar — nunca se confía en un promedio enviado
//  por el cliente.
// ============================================================

// 'en' => nombre en inglés, usado por el reporte bilingüe de evaluación.
const OBJETIVOS = [
    'O1' => ['n' => 'Seguridad y cumplimiento',      'c' => '#C0392B', 'peso' => 0.40, 'en' => 'Safety and compliance'],
    'O2' => ['n' => 'Ejecución técnica',              'c' => '#0060A9', 'peso' => 0.30, 'en' => 'Technical execution'],
    'O3' => ['n' => 'Productividad',                  'c' => '#7A5195', 'peso' => 0.15, 'en' => 'Productivity'],
    'O4' => ['n' => 'Cuidado de carga y equipos',     'c' => '#1E7B34', 'peso' => 0.15, 'en' => 'Cargo and equipment care'],
];

// Cada actividad lleva 'd' => descriptores de la rúbrica 1..5: qué debe observarse
// en el turno para justificar cada puntaje. Es la guía anti-subjetividad del
// evaluador y viaja al frontend dentro de GET /rules.
const BLOQUES = [
    ['id' => 'trans', 't' => 'Transversal', 'acts' => [
        ['id' => 't1', 'o' => 'O4', 'n' => 'Inspección preoperacional de equipos y aparejos', 'd' => [
            'Solo observa, no participa: inicia la maniobra sin revisar equipos ni aparejos.',
            'Revisa por encima y de forma incompleta; omite puntos críticos y no informa hallazgos.',
            'Cumple la inspección básica del checklist, con recordatorio o apoyo del supervisor.',
            'Inspecciona completo por iniciativa propia y reporta desviaciones antes de operar.',
            'Inspección rigurosa y autónoma: segrega y etiqueta lo defectuoso, deja evidencia y orienta a sus compañeros.',
        ]],
        ['id' => 't2', 'o' => 'O4', 'n' => 'Preparación y señalización del área', 'd' => [
            'No prepara ni delimita el área; deja accesos y pasos obstruidos.',
            'Prepara parcialmente; señalización insuficiente o mal ubicada.',
            'Delimita y señaliza lo mínimo requerido; necesita correcciones puntuales.',
            'Área despejada y bien señalizada antes de iniciar; mantiene la delimitación durante el turno.',
            'Anticipa riesgos, ajusta la señalización cuando cambia la maniobra y coordina con áreas vecinas.',
        ]],
        ['id' => 't3', 'o' => 'O1', 'n' => 'Uso de EPP', 'd' => [
            'Sin EPP o lo mantiene incompleto pese a la observación del supervisor.',
            'EPP incompleto o mal usado; se lo coloca solo cuando lo están mirando.',
            'Usa correctamente el EPP básico obligatorio durante toda la faena.',
            'EPP completo, en buen estado y acorde al riesgo específico de la tarea.',
            'EPP impecable; verifica el de sus compañeros y solicita a tiempo la reposición del deteriorado.',
        ]],
        ['id' => 't4', 'o' => 'O4', 'n' => 'Orden y limpieza', 'd' => [
            'Deja residuos, herramientas y aparejos dispersos en el área.',
            'Ordena solo al final y de forma parcial; requiere que se le indique.',
            'Mantiene el orden básico y devuelve los materiales a su lugar.',
            'Ordena durante toda la faena; entrega el área limpia y los aparejos estibados.',
            'Aplica 5S de forma constante, mejora el acomodo del área e involucra a la cuadrilla.',
        ]],
    ]],
    ['id' => 'amarre', 't' => 'Amarre', 'acts' => [
        ['id' => 'a1', 'o' => 'O2', 'n' => 'Amarre / desamarre', 'd' => [
            'No participa o ejecuta maniobras inseguras: se ubica en línea de fuego o trabaja sin señal.',
            'Participa con dificultad; requiere corrección permanente en el manejo de cabos.',
            'Ejecuta la maniobra estándar de forma correcta bajo supervisión.',
            'Buena técnica y ritmo; respeta zonas de tensión y coordina con el buque.',
            'Domina la maniobra en condiciones exigentes (viento, marea, cambio de calado) y guía al equipo.',
        ]],
        ['id' => 'a2', 'o' => 'O2', 'n' => 'Uso de shore tension', 'd' => [
            'Desconoce el equipo; no lo opera ni lo asiste.',
            'Opera con errores de tensión o liberación y necesita corrección continua.',
            'Conecta y opera el shore tension según procedimiento, con supervisión.',
            'Opera con autonomía, controla la tensión y verifica el estado del equipo.',
            'Opera y diagnostica el sistema, ajusta ante variaciones del buque y capacita a otros.',
        ]],
    ]],
    ['id' => 'cont', 't' => 'Contenedores', 'carga' => 'Contenedores', 'acts' => [
        ['id' => 'c1', 'o' => 'O2', 'n' => 'Señalización a grúa / portalón', 'd' => [
            'No señaliza o emite señales confusas que obligan a detener la maniobra.',
            'Señaliza de forma intermitente o dudosa; pierde contacto visual con el operador.',
            'Usa las señales estándar y mantiene contacto visual en maniobras normales.',
            'Señalización clara, anticipada y continua; corrige a tiempo los desvíos de la carga.',
            'Señaliza con precisión incluso en maniobras complejas o de baja visibilidad; es referente de la cuadrilla.',
        ]],
        ['id' => 'c2', 'o' => 'O2', 'n' => 'Trincado / destrincado', 'd' => [
            'No trinca o lo hace de forma insegura; deja twistlocks o barras sueltos.',
            'Trincado incompleto o con tensión inadecuada; obliga a rehacer el trabajo.',
            'Trinca según el patrón indicado, con ritmo aceptable y sin observaciones mayores.',
            'Trincado completo, correcto y verificado; buen ritmo y sin retrabajos.',
            'Trincado impecable y rápido; detecta trincas dañadas y ajusta el patrón según el plan de estiba.',
        ]],
        ['id' => 'c3', 'o' => 'O2', 'n' => 'Pin station (retiro y colocación de piñas)', 'd' => [
            'No participa de la estación o coloca piñas incorrectas.',
            'Confunde tipos de piñas o desordena la estación; genera demoras.',
            'Retira y coloca piñas correctamente, al ritmo de la nave.',
            'Manejo ágil y ordenado, con selección correcta según el tipo de contenedor.',
            'Sostiene el ritmo de la grúa sin errores, mantiene la estación ordenada y descarta piñas defectuosas.',
        ]],
        ['id' => 'c4', 'o' => 'O2', 'n' => 'Uso de radio', 'd' => [
            'No porta la radio o no responde a los llamados; se comunica a gritos o por señas improvisadas.',
            'Usa la radio con mensajes confusos, pisa las comunicaciones de otros o habla por el canal equivocado.',
            'Se comunica por el canal asignado con mensajes entendibles y responde cuando lo llaman.',
            'Comunicación breve, clara y con confirmación ("copiado"); mantiene la radio encendida y en volumen audible todo el turno.',
            'Uso ejemplar del protocolo de radio: mensajes precisos, disciplina de canal, escala emergencias de inmediato y ordena el tráfico del equipo.',
        ]],
        ['id' => 'c5', 'o' => 'O2', 'n' => 'Lectura de planos', 'd' => [
            'No interpreta el plano de estiba.',
            'Interpreta con errores de bahía / fila / altura; requiere verificación permanente.',
            'Ubica correctamente las posiciones del plano, con apoyo puntual.',
            'Interpreta con autonomía y detecta inconsistencias entre el plano y lo que ve en cubierta.',
            'Dominio total del plano: anticipa secuencias y alerta desviaciones al planner o supervisor.',
        ]],
        ['id' => 'c6', 'o' => 'O2', 'n' => 'Reefer (conexión / monitoreo)', 'd' => [
            'No conecta ni monitorea; manipula sin resguardo eléctrico.',
            'Conecta con errores u omite el registro de temperaturas.',
            'Conecta y registra temperaturas según la frecuencia establecida.',
            'Conecta, monitorea y reporta alarmas a tiempo; verifica seteo contra lo requerido.',
            'Detecta fallas incipientes, escala oportunamente y deja trazabilidad completa del monitoreo.',
        ]],
    ]],
    ['id' => 'granel', 't' => 'Granel sólido', 'carga' => 'Granel sólido', 'acts' => [
        ['id' => 'g1', 'o' => 'O2', 'n' => 'Dominio de hopper', 'd' => [
            'No opera ni asiste el hopper; se expone a la zona de descarga.',
            'Opera con derrames frecuentes y requiere corrección constante.',
            'Opera el hopper de forma estable, con supervisión.',
            'Buen flujo de descarga, minimiza derrames y coordina con tolva y camiones.',
            'Optimiza el flujo, previene atoros y ajusta la operación al rendimiento de la grúa.',
        ]],
        ['id' => 'g2', 'o' => 'O2', 'n' => 'Trimming / nivelación de carga', 'd' => [
            'No participa del trimming o se expone bajo la carga.',
            'Nivelación deficiente que obliga a repasar la bodega.',
            'Realiza el trimming según indicación, con resultado aceptable.',
            'Nivela de forma pareja y eficiente, cuidando la estructura de la bodega.',
            'Planifica la secuencia de nivelación, aprovecha el equipo al máximo y reduce el tiempo de limpieza.',
        ]],
        ['id' => 'g3', 'o' => 'O2', 'n' => 'Comunicación con operadores', 'd' => [
            'No se comunica; provoca maniobras a ciegas.',
            'Comunicación intermitente o poco clara por radio o señas.',
            'Se comunica de forma correcta en situaciones normales.',
            'Comunicación clara y anticipada, con confirmación de mensajes.',
            'Coordina varios frentes (grúa, hopper, camiones) manteniendo ritmo y seguridad.',
        ]],
        ['id' => 'g4', 'o' => 'O2', 'n' => 'Limpieza de bodegas', 'd' => [
            'No participa o trabaja sin resguardo en zonas de riesgo.',
            'Limpieza incompleta; deja remanentes que obligan a retornar.',
            'Limpieza aceptable dentro del tiempo asignado.',
            'Entrega la bodega limpia y a conformidad, con buen uso de herramientas.',
            'Limpieza óptima y segura, cuidando la estructura y aprovechando el material recuperado.',
        ]],
        ['id' => 'g5', 'o' => 'O1', 'n' => 'Control de material de izaje', 'd' => [
            'Usa material de izaje sin revisar o con daño evidente.',
            'Revisión superficial; no retira de servicio lo observado.',
            'Verifica el material antes de usarlo y respeta código de colores y vigencia.',
            'Controla estado y capacidad del material y reporta lo deteriorado.',
            'Control riguroso: segrega lo no conforme y evita su reingreso a la operación.',
        ]],
    ]],
    ['id' => 'frac', 't' => 'Carga fraccionada', 'carga' => 'Carga fraccionada', 'acts' => [
        ['id' => 'f1', 'o' => 'O2', 'n' => 'Aparejamiento (rigging)', 'd' => [
            'Apareja de forma incorrecta o improvisada, con riesgo de caída de carga.',
            'Errores de ángulo, protección o punto de izaje; obliga a rehacer el aparejo.',
            'Apareja según lo indicado para cargas estándar.',
            'Selecciona eslingas y grilletes según peso y centro de gravedad; protege aristas.',
            'Resuelve aparejamientos complejos, calcula ángulos y capacidades y guía al equipo.',
        ]],
        ['id' => 'f2', 'o' => 'O1', 'n' => 'Revisión de materiales de izaje + alerta de deterioro', 'd' => [
            'No revisa; usa material vencido o dañado.',
            'Revisa parcialmente y no alerta lo encontrado.',
            'Revisa el material antes de la maniobra e informa lo evidente.',
            'Revisión completa y alerta oportuna; retira de servicio lo observado.',
            'Inspección experta: documenta el hallazgo y asegura el reemplazo antes de continuar.',
        ]],
        ['id' => 'f3', 'o' => 'O2', 'n' => 'Ejecución del plan de izaje', 'd' => [
            'Opera sin conocer el plan de izaje.',
            'Conoce el plan pero se desvía de la secuencia sin avisar.',
            'Ejecuta el plan según lo instruido.',
            'Ejecuta con precisión y verifica condiciones previas.',
            'Identifica oportunamente cualquier cambio en la maniobra, detiene la operación cuando detecta condiciones inseguras y comunica de inmediato la situación para prevenir incidentes.',
        ]],
        ['id' => 'f4', 'o' => 'O2', 'n' => 'Señalero / rigger', 'd' => [
            'No cumple el rol o emite señales contradictorias.',
            'Señaliza con inseguridad y se ubica en posiciones inadecuadas.',
            'Cumple el rol con señales estándar y posición segura.',
            'Señalización clara y anticipada; mantiene control del área y del personal.',
            'Lidera la maniobra como señalero único y coordina con grúa y equipo en situaciones críticas.',
        ]],
        ['id' => 'f5', 'o' => 'O2', 'n' => 'Aseguramiento de material de izaje', 'd' => [
            'Deja la carga o el material sin asegurar.',
            'Asegura de forma parcial o con elementos inadecuados.',
            'Asegura la carga según lo indicado.',
            'Asegura correctamente y verifica antes de liberar la maniobra.',
            'Asegura con criterio técnico según tipo de carga y trayecto; verifica y deja evidencia.',
        ]],
    ]],
    ['id' => 'bb', 't' => 'Big bags', 'carga' => 'Big bags', 'acts' => [
        ['id' => 'b1', 'o' => 'O2', 'n' => 'Eslingado / enganche de big bags con seguridad', 'd' => [
            'Engancha mal (una sola asa, gancho sin seguro) o se ubica bajo la carga.',
            'Errores de enganche frecuentes que obligan a bajar la carga.',
            'Engancha correctamente las cuatro asas y usa gancho con seguro.',
            'Enganche correcto y ágil; verifica el estado del big bag antes de izar.',
            'Enganche impecable y rápido; detecta bolsas dañadas y evita derrames en altura.',
        ]],
        ['id' => 'b2', 'o' => 'O2', 'n' => 'Comunicación con operadores de equipos móviles y grúas', 'd' => [
            'No establece comunicación antes ni durante la maniobra; ingresa a zonas de operación sin autorización o genera una condición de alto riesgo.',
            'Comunicación tardía, incompleta o poco clara; no confirma instrucciones y provoca detenciones, dudas o maniobras inseguras.',
            'Se comunica con el operador cuando es necesario, confirma las instrucciones principales y mantiene distancia segura durante la operación.',
            'Coordina oportunamente, usa las señales o medios de comunicación establecidos, confirma el entendimiento mutuo y respeta las zonas de tránsito y seguridad.',
            'Comunicación continua, clara y anticipada: coordina toda la maniobra, previene interferencias y logra una operación segura y fluida, sin detenciones innecesarias.',
        ]],
        ['id' => 'b3', 'o' => 'O1', 'n' => 'Revisión de materiales de izaje', 'd' => [
            'No revisa eslingas ni ganchos antes de operar.',
            'Revisión superficial; pasa por alto cortes o desgastes.',
            'Revisa el material antes de la faena y descarta lo evidente.',
            'Revisión completa con criterio de capacidad y estado; reporta lo observado.',
            'Control riguroso y trazable: segrega lo no conforme y verifica su reemplazo.',
        ]],
        ['id' => 'b4', 'o' => 'O1', 'n' => 'Seguridad en maniobras', 'd' => [
            'Se expone o expone a otros: línea de fuego o bajo carga suspendida.',
            'Comete descuidos de seguridad que deben corregirse durante el turno.',
            'Respeta las reglas de seguridad básicas de la maniobra.',
            'Mantiene distancias y zonas seguras; detiene la maniobra ante condiciones inseguras.',
            'Referente de seguridad: anticipa riesgos, corrige a sus compañeros y aplica la parada segura.',
        ]],
    ]],
    ['id' => 'prod', 't' => 'Productividad', 'acts' => [
        ['id' => 'p1', 'o' => 'O3', 'n' => 'Ritmo / rendimiento del turno', 'd' => [
            'Ritmo muy por debajo de lo esperado; genera detenciones en el frente de trabajo.',
            'Ritmo irregular; requiere que se le exija para sostener el avance.',
            'Cumple el rendimiento esperado del turno.',
            'Sostiene buen ritmo todo el turno sin sacrificar seguridad ni calidad.',
            'Rendimiento sobresaliente y constante; ayuda a recuperar demoras del frente.',
        ]],
    ]],
];

const CARGAS = ['Contenedores', 'Granel sólido', 'Carga fraccionada', 'Big bags'];

const ESCALA = [
    ['v' => 1, 'l' => 'Insatisfactorio', 'c' => '#C0392B'],
    ['v' => 2, 'l' => 'Regular',         'c' => '#E67E22'],
    ['v' => 3, 'l' => 'Aceptable',       'c' => '#B8860B'],
    ['v' => 4, 'l' => 'Bueno',           'c' => '#0060A9'],
    ['v' => 5, 'l' => 'Excelente',       'c' => '#1E7B34'],
];

const PARAMS = [
    'sobre5'     => 4.5, 'cumple5' => 3.0,
    'pesoObj'    => 0.70, 'pesoCond' => 0.30,
    'minimo'     => 3.0,
    'topeEvento' => 2.5,
    'piso'       => 8,
    'pctMuestreo'=> 0.20,
    'minCarga'   => 2,
    'minSupers'  => 3,
];

/** Todo el catálogo, para GET /rules (con los textos en inglés adjuntos). */
function rules_catalog(): array
{
    require_once __DIR__ . '/rules_i18n.php';
    return [
        'objetivos' => OBJETIVOS,
        'bloques'   => bloques_i18n(BLOQUES),
        'cargas'    => CARGAS,
        'cargas_en' => CARGAS_EN,
        'escala'    => escala_i18n(ESCALA),
        'params'    => PARAMS,
    ];
}

/** Mapa activity_code => objetivo (O1..O4), derivado de BLOQUES. */
function activity_objective_map(): array
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (BLOQUES as $b) {
            foreach ($b['acts'] as $a) {
                $map[$a['id']] = $a['o'];
            }
        }
    }
    return $map;
}

/** Bloques visibles para una combinación carga/amarre (misma lógica que el frontend). */
function visible_blocks(string $carga, bool $amarre): array
{
    return array_values(array_filter(BLOQUES, function ($b) use ($carga, $amarre) {
        if ($b['id'] === 'trans' || $b['id'] === 'prod') return true;
        if ($b['id'] === 'amarre') return $amarre;
        return isset($b['carga']) && $b['carga'] === $carga;
    }));
}

/** IDs de actividades requeridas para esta ficha (todas deben venir calificadas). */
function required_activity_ids(string $carga, bool $amarre): array
{
    $ids = [];
    foreach (visible_blocks($carga, $amarre) as $b) {
        foreach ($b['acts'] as $a) $ids[] = $a['id'];
    }
    return $ids;
}

function nivel5(?float $v): ?string
{
    if ($v === null) return null;
    if ($v >= PARAMS['sobre5']) return 'Sobre';
    if ($v >= PARAMS['cumple5']) return 'Cumple';
    return 'Por Debajo';
}

function color_nivel(?string $n): string
{
    if ($n === 'Sobre') return '#1E7B34';
    if ($n === 'Cumple') return '#0060A9';
    return '#C0392B';
}

/**
 * Promedios por objetivo de UNA ficha.
 * $ratings: [ activity_code => rating(1-5) | null ]
 * Un null significa "No aplica": la actividad no se observó en ese turno, así que
 * no entra ni en la suma ni en el divisor — el promedio se calcula solo sobre las
 * actividades realmente evaluadas.
 */
function promedios_ficha(array $ratings, bool $evento): array
{
    $map = activity_objective_map();
    $acc = [];
    foreach ($ratings as $code => $v) {
        if ($v === null) continue;
        $o = $map[$code] ?? null;
        if ($o === null) continue;
        $acc[$o][] = (int)$v;
    }
    $out = [];
    foreach (array_keys(OBJETIVOS) as $o) {
        if (empty($acc[$o])) { $out[$o] = null; continue; }
        $m = array_sum($acc[$o]) / count($acc[$o]);
        if ($evento && ($o === 'O1' || $o === 'O3')) {
            $m = min($m, PARAMS['topeEvento']);
        }
        $out[$o] = round($m, 2);
    }
    return $out;
}

/**
 * Consolida varias fichas (arrays con obj_o1..o4, supervisor_id, carga, evento_seguridad).
 * El promedio de cada objetivo se divide entre el máximo de (fichas calificadas, piso de
 * fichas mínimas del trimestre): así una sola ficha con nota 5 no muestra un 5.00 engañoso
 * como si el ciclo estuviera completo, sino 5/piso — reflejando que falta evidencia.
 */
function consolidar(array $fichas): array
{
    $out = [];
    foreach (array_keys(OBJETIVOS) as $o) {
        $col = 'obj_' . strtolower($o);
        $vals = array_values(array_filter(array_map(
            fn($f) => $f[$col] !== null ? (float)$f[$col] : null, $fichas
        ), fn($v) => $v !== null));
        $divisor = max(count($vals), PARAMS['piso']);
        $out[$o] = $vals ? round(array_sum($vals) / $divisor, 2) : null;
    }
    $supers = count(array_unique(array_map(fn($f) => (int)$f['supervisor_id'], $fichas)));
    $cob = [];
    foreach (CARGAS as $c) {
        $cob[$c] = count(array_filter($fichas, fn($f) => $f['carga'] === $c));
    }
    $eventos = count(array_filter($fichas, fn($f) => (int)$f['evento_seguridad'] === 1));
    // El administrador no tiene límites ni excepciones: si evaluó, alcanza para validar la evidencia
    // por sí solo (para poder probar el flujo completo sin depender de 3 supervisores distintos).
    $hasAdmin = count(array_filter($fichas, fn($f) => ($f['supervisor_role'] ?? null) === 'admin')) > 0;
    return ['obj' => $out, 'n' => count($fichas), 'supers' => $supers, 'cob' => $cob, 'eventos' => $eventos, 'hasAdmin' => $hasAdmin];
}

/** Estado de validez de la evidencia acumulada. */
function estado(array $c, ?int $turnosTotal): array
{
    if ($c['n'] === 0) return ['t' => 'SIN FICHAS', 'c' => '#6B7280'];
    if ($c['n'] < PARAMS['piso']) return ['t' => 'EVIDENCIA INSUFICIENTE', 'c' => '#C0392B'];
    if (!($c['hasAdmin'] ?? false)) {
        if ($turnosTotal && $c['n'] < $turnosTotal * PARAMS['pctMuestreo']) {
            return ['t' => 'BAJO % MUESTREO', 'c' => '#B8860B'];
        }
        if ($c['supers'] < PARAMS['minSupers']) return ['t' => 'POCOS EVALUADORES', 'c' => '#B8860B'];
    }
    return ['t' => 'VÁLIDA', 'c' => '#1E7B34'];
}

/**
 * Promedio ponderado de un consolidado de objetivos según los pesos de su catálogo.
 * $objetivosDef: OBJETIVOS u OBJETIVOS_C (mapa con 'peso' por clave O1..O4).
 * $obj: ['O1'=>float|null, ...]
 */
function weighted_avg(array $objetivosDef, array $obj): ?float
{
    $num = 0.0; $den = 0.0;
    foreach ($objetivosDef as $o => $meta) {
        if (isset($obj[$o]) && $obj[$o] !== null) {
            $num += $meta['peso'] * $obj[$o];
            $den += $meta['peso'];
        }
    }
    return $den > 0 ? $num / $den : null;
}

/**
 * Combina el puntaje de objetivos (70%, módulo Desenvolvimiento) con el de
 * conductas (30%, módulo Compromiso) y aplica la regla de bloqueo CSPCP:
 * un "Por Debajo" en conductas impide un "Sobre" final.
 */
function combinar_final(?float $objScore, ?float $condScore): array
{
    if ($objScore === null || $condScore === null) {
        return ['objScore' => $objScore, 'condScore' => $condScore];
    }

    $comb = PARAMS['pesoObj'] * $objScore + PARAMS['pesoCond'] * $condScore;
    $prelim = nivel5($comb);
    $nCond = nivel5($condScore);
    $bloqueado = ($prelim === 'Sobre' && $nCond === 'Por Debajo');
    $final = $bloqueado ? 'Cumple' : $prelim;

    return [
        'objScore' => round($objScore, 2), 'condScore' => round($condScore, 2),
        'comb' => round($comb, 2), 'prelim' => $prelim, 'final' => $final,
        'nCond' => $nCond, 'bloqueado' => $bloqueado,
    ];
}

/** Trimestre calendario (1-4) de una fecha Y-m-d. */
function quarter_of(string $ymd): int
{
    $m = (int)substr($ymd, 5, 2);
    return intdiv($m - 1, 3) + 1;
}
