<?php
// ============================================================
//  Traducciones al inglés del catálogo de evaluación.
//  Viven aparte del catálogo (rules.php / rules_compromiso.php) para que el
//  español siga siendo la única fuente de verdad de ids, pesos y objetivos:
//  aquí solo hay texto. rules_catalog() inyecta estos campos como 't_en',
//  'n_en' y 'd_en' en la respuesta de GET /rules.
// ============================================================

/** Títulos de bloque (Ficha de Desenvolvimiento). */
const BLOQUES_EN = [
    'trans'  => 'Cross-cutting',
    'amarre' => 'Mooring',
    'cont'   => 'Containers',
    'granel' => 'Dry bulk',
    'frac'   => 'Breakbulk',
    'bb'     => 'Big bags',
    'prod'   => 'Productivity',
];

/** Tipos de carga: el valor guardado en base siempre es el español. */
const CARGAS_EN = [
    'Contenedores'      => 'Containers',
    'Granel sólido'     => 'Dry bulk',
    'Carga fraccionada' => 'Breakbulk',
    'Big bags'          => 'Big bags',
];

/** Etiquetas de la escala 1-5. */
const ESCALA_EN = [
    1 => 'Unsatisfactory',
    2 => 'Fair',
    3 => 'Acceptable',
    4 => 'Good',
    5 => 'Excellent',
];

/** Actividades de la ficha de Desenvolvimiento: nombre y rúbrica 1..5. */
const ACTS_EN = [
    't1' => ['n' => 'Pre-operational inspection of equipment and rigging gear', 'd' => [
        'Only watches, does not take part: starts the operation without checking equipment or gear.',
        'Checks superficially and incompletely; skips critical points and does not report findings.',
        'Completes the basic checklist inspection, with a reminder or support from the supervisor.',
        'Inspects thoroughly on their own initiative and reports deviations before operating.',
        'Rigorous and autonomous inspection: segregates and tags defective gear, records evidence and guides coworkers.',
    ]],
    't2' => ['n' => 'Work area preparation and signage', 'd' => [
        'Does not prepare or delimit the area; leaves accesses and walkways obstructed.',
        'Partial preparation; insufficient or poorly placed signage.',
        'Delimits and signals the minimum required; needs occasional corrections.',
        'Area cleared and properly signposted before starting; keeps the delimitation throughout the shift.',
        'Anticipates hazards, adjusts signage as the operation changes and coordinates with neighboring areas.',
    ]],
    't3' => ['n' => 'Use of PPE', 'd' => [
        'No PPE, or keeps it incomplete despite the supervisor\'s observation.',
        'Incomplete or improperly worn PPE; puts it on only when being watched.',
        'Correctly wears the mandatory basic PPE throughout the job.',
        'Complete PPE, in good condition and suited to the specific risk of the task.',
        'Impeccable PPE; checks that of coworkers and requests timely replacement of worn items.',
    ]],
    't4' => ['n' => 'Housekeeping and cleanliness', 'd' => [
        'Leaves waste, tools and gear scattered around the area.',
        'Tidies up only at the end and partially; needs to be told.',
        'Keeps basic order and returns materials to their place.',
        'Tidies throughout the job; hands over a clean area with gear properly stowed.',
        'Applies 5S consistently, improves the layout of the area and involves the gang.',
    ]],
    'a1' => ['n' => 'Mooring / unmooring', 'd' => [
        'Does not take part or performs unsafe maneuvers: stands in the line of fire or works without signals.',
        'Takes part with difficulty; needs constant correction in line handling.',
        'Performs the standard maneuver correctly under supervision.',
        'Good technique and pace; respects snap-back zones and coordinates with the vessel.',
        'Masters the maneuver in demanding conditions (wind, tide, draft changes) and guides the team.',
    ]],
    'a2' => ['n' => 'Use of shore tension', 'd' => [
        'Unfamiliar with the equipment; neither operates nor assists with it.',
        'Operates with tensioning or release errors and needs continuous correction.',
        'Connects and operates the shore tension per procedure, under supervision.',
        'Operates autonomously, controls tension and verifies equipment condition.',
        'Operates and troubleshoots the system, adjusts to vessel movement and trains others.',
    ]],
    'c1' => ['n' => 'Signaling to crane / gangway', 'd' => [
        'Does not signal or gives confusing signals that force the maneuver to stop.',
        'Signals intermittently or unclearly; loses eye contact with the operator.',
        'Uses standard signals and keeps eye contact in normal maneuvers.',
        'Clear, anticipated and continuous signaling; corrects load deviations in time.',
        'Signals accurately even in complex or low-visibility maneuvers; a reference for the gang.',
    ]],
    'c2' => ['n' => 'Lashing / unlashing', 'd' => [
        'Does not lash or does it unsafely; leaves twistlocks or bars loose.',
        'Incomplete lashing or inadequate tension; work has to be redone.',
        'Lashes according to the indicated pattern, at an acceptable pace and without major findings.',
        'Complete, correct and verified lashing; good pace and no rework.',
        'Flawless and fast lashing; detects damaged gear and adjusts the pattern to the stowage plan.',
    ]],
    'c3' => ['n' => 'Pin station (removing and fitting twistlocks)', 'd' => [
        'Does not work the station or fits the wrong twistlocks.',
        'Confuses twistlock types or leaves the station disorganized; causes delays.',
        'Removes and fits twistlocks correctly, keeping up with the vessel.',
        'Agile and orderly handling, choosing the right type for each container.',
        'Keeps up with the crane without errors, keeps the station tidy and discards defective twistlocks.',
    ]],
    'c4' => ['n' => 'Use of radio', 'd' => [
        'Does not carry the radio or does not answer calls; communicates by shouting or improvised signs.',
        'Uses the radio with confusing messages, talks over others or uses the wrong channel.',
        'Communicates on the assigned channel with understandable messages and answers when called.',
        'Brief, clear communication with acknowledgment ("copy"); keeps the radio on and audible all shift.',
        'Exemplary radio protocol: precise messages, channel discipline, immediate escalation of emergencies and orderly team traffic.',
    ]],
    'c5' => ['n' => 'Stowage plan reading', 'd' => [
        'Cannot interpret the stowage plan.',
        'Misreads bay / row / tier; requires permanent verification.',
        'Locates plan positions correctly, with occasional support.',
        'Interprets the plan autonomously and spots inconsistencies against what is on deck.',
        'Full command of the plan: anticipates sequences and flags deviations to the planner or supervisor.',
    ]],
    'c6' => ['n' => 'Reefer (connection / monitoring)', 'd' => [
        'Neither connects nor monitors; handles units without electrical safeguards.',
        'Connects with errors or omits temperature logging.',
        'Connects and logs temperatures at the established frequency.',
        'Connects, monitors and reports alarms promptly; checks set point against requirement.',
        'Detects early failures, escalates in time and leaves full traceability of the monitoring.',
    ]],
    'g1' => ['n' => 'Hopper handling', 'd' => [
        'Neither operates nor assists the hopper; exposes themselves to the discharge area.',
        'Operates with frequent spillage and needs constant correction.',
        'Operates the hopper steadily, under supervision.',
        'Good discharge flow, minimizes spillage and coordinates with silo and trucks.',
        'Optimizes flow, prevents blockages and adapts the operation to the crane rate.',
    ]],
    'g2' => ['n' => 'Trimming / cargo leveling', 'd' => [
        'Does not take part in trimming or exposes themselves under the load.',
        'Poor leveling that forces the hold to be reworked.',
        'Performs trimming as instructed, with acceptable results.',
        'Levels evenly and efficiently, protecting the hold structure.',
        'Plans the leveling sequence, makes the most of the equipment and reduces cleaning time.',
    ]],
    'g3' => ['n' => 'Communication with operators', 'd' => [
        'Does not communicate; causes blind maneuvers.',
        'Intermittent or unclear communication by radio or hand signals.',
        'Communicates properly in normal situations.',
        'Clear, anticipated communication with message acknowledgment.',
        'Coordinates several fronts (crane, hopper, trucks) keeping pace and safety.',
    ]],
    'g4' => ['n' => 'Hold cleaning', 'd' => [
        'Does not take part or works without safeguards in risk areas.',
        'Incomplete cleaning; leaves residues that force a return to the hold.',
        'Acceptable cleaning within the assigned time.',
        'Hands over the hold clean and to satisfaction, with good use of tools.',
        'Optimal and safe cleaning, protecting the structure and recovering usable cargo.',
    ]],
    'g5' => ['n' => 'Control of lifting gear', 'd' => [
        'Uses lifting gear without checking it or with visible damage.',
        'Superficial check; does not withdraw flagged gear from service.',
        'Verifies gear before use and respects color coding and validity dates.',
        'Controls condition and capacity of the gear and reports damaged items.',
        'Rigorous control: segregates non-conforming gear and prevents it from returning to service.',
    ]],
    'f1' => ['n' => 'Rigging', 'd' => [
        'Rigs incorrectly or improvises, risking a dropped load.',
        'Errors in angle, edge protection or lifting points; the rig has to be redone.',
        'Rigs as instructed for standard loads.',
        'Selects slings and shackles according to weight and center of gravity; protects edges.',
        'Solves complex rigging, calculates angles and capacities and guides the team.',
    ]],
    'f2' => ['n' => 'Lifting gear inspection + deterioration alert', 'd' => [
        'Does not inspect; uses expired or damaged gear.',
        'Partial inspection and does not report what is found.',
        'Inspects the gear before the lift and reports obvious defects.',
        'Full inspection and timely alert; withdraws flagged gear from service.',
        'Expert inspection: documents the finding and ensures replacement before continuing.',
    ]],
    'f3' => ['n' => 'Execution of the lifting plan', 'd' => [
        'Operates without knowing the lifting plan.',
        'Knows the plan but deviates from the sequence without notice.',
        'Executes the plan as instructed.',
        'Executes accurately and verifies prior conditions.',
        'Promptly identifies any change in the maneuver, stops the operation when unsafe conditions appear and immediately communicates the situation to prevent incidents.',
    ]],
    'f4' => ['n' => 'Signaler / rigger', 'd' => [
        'Does not fulfill the role or gives contradictory signals.',
        'Signals hesitantly and stands in unsuitable positions.',
        'Fulfills the role with standard signals and a safe position.',
        'Clear and anticipated signaling; keeps control of the area and the personnel.',
        'Leads the maneuver as sole signaler and coordinates with crane and team in critical situations.',
    ]],
    'f5' => ['n' => 'Securing of lifting gear', 'd' => [
        'Leaves the load or the gear unsecured.',
        'Secures partially or with unsuitable elements.',
        'Secures the load as instructed.',
        'Secures correctly and verifies before releasing the maneuver.',
        'Secures with technical judgment according to cargo type and route; verifies and records evidence.',
    ]],
    'b1' => ['n' => 'Slinging / hooking big bags safely', 'd' => [
        'Hooks incorrectly (single loop, hook without latch) or stands under the load.',
        'Frequent hooking errors that force the load to be lowered.',
        'Correctly hooks all four loops and uses a hook with safety latch.',
        'Correct and agile hooking; checks the condition of the big bag before lifting.',
        'Flawless and fast hooking; detects damaged bags and prevents spillage at height.',
    ]],
    'b2' => ['n' => 'Communication with mobile equipment and crane operators', 'd' => [
        'Does not establish communication before or during the maneuver; enters operating areas without authorization or creates a high-risk condition.',
        'Late, incomplete or unclear communication; does not confirm instructions and causes stoppages, doubts or unsafe maneuvers.',
        'Communicates with the operator when necessary, confirms the main instructions and keeps a safe distance during the operation.',
        'Coordinates in a timely manner, uses the established signals or communication means, confirms mutual understanding and respects traffic and safety zones.',
        'Continuous, clear and anticipated communication: coordinates the whole maneuver, prevents interference and delivers a safe, fluid operation without unnecessary stoppages.',
    ]],
    'b3' => ['n' => 'Lifting gear inspection', 'd' => [
        'Does not check slings or hooks before operating.',
        'Superficial check; overlooks cuts or wear.',
        'Checks the gear before the job and discards obvious defects.',
        'Full check against capacity and condition; reports findings.',
        'Rigorous and traceable control: segregates non-conforming gear and verifies its replacement.',
    ]],
    'b4' => ['n' => 'Safety during maneuvers', 'd' => [
        'Exposes themselves or others: line of fire or under a suspended load.',
        'Safety lapses that must be corrected during the shift.',
        'Follows the basic safety rules of the maneuver.',
        'Keeps safe distances and zones; stops the maneuver when conditions are unsafe.',
        'A safety reference: anticipates hazards, corrects coworkers and applies stop-work authority.',
    ]],
    'p1' => ['n' => 'Shift pace / performance', 'd' => [
        'Pace well below expectations; causes stoppages at the working front.',
        'Irregular pace; needs to be pushed to keep progress.',
        'Meets the expected performance for the shift.',
        'Keeps a good pace all shift without sacrificing safety or quality.',
        'Outstanding, steady performance; helps recover delays at the front.',
    ]],
];

/** Conductas de la ficha de Compromiso. */
const ACTS_C_EN = [
    'com1' => ['n' => 'Receiving and applying feedback / operational instructions', 'd' => [
        'Rejects feedback or argues with the instruction; does not carry it out.',
        'Listens but does not apply the feedback; repeats the observed mistake.',
        'Receives the instruction and carries it out correctly.',
        'Applies feedback immediately and confirms understanding.',
        'Actively seeks feedback, applies it and passes on what they learned to the team.',
    ]],
    'ada1' => ['n' => 'Willingness to support critical tasks during the shift', 'd' => [
        'Refuses to help outside their usual task.',
        'Helps only when pressed and with visible reluctance.',
        'Helps when asked.',
        'Offers to help at critical moments without being asked.',
        'Anticipates the need, reorganizes their task and motivates the team to help.',
    ]],
    'teq1' => ['n' => 'Proactivity in preventing conflicts within the team', 'd' => [
        'Creates or fuels conflicts within the team.',
        'Stays on the sidelines and lets friction escalate.',
        'Avoids conflicts and keeps a proper manner.',
        'Steps in early to lower tension and seeks agreement.',
        'A cohesion factor: mediates, resolves and prevents conflicts before they arise.',
    ]],
    'teq2' => ['n' => 'Active participation in toolbox talks / inductions', 'd' => [
        'Does not attend or disrupts the talk.',
        'Attends passively and distracted.',
        'Attends and pays attention.',
        'Participates, asks questions and contributes examples from the operation.',
        'Leads or delivers talks, brings real cases and reinforces the message during the shift.',
    ]],
    'ini1' => ['n' => 'Timely reporting of incidents or substandard conditions', 'd' => [
        'Does not report despite detecting the condition.',
        'Reports late or incompletely.',
        'Reports the relevant events of the shift.',
        'Reports immediately and with detail useful for correction.',
        'Reports, proposes the solution and follows up until closure.',
    ]],
    'res1' => ['n' => 'Assertive communication and respect toward coworkers and superiors', 'd' => [
        'Disrespectful or aggressive toward coworkers or superiors.',
        'Curt manner; responds poorly under pressure.',
        'Respectful and proper manner.',
        'Assertive communication: raises disagreements without being disrespectful.',
        'A reference for good treatment; keeps respect even in high-tension situations.',
    ]],
    'seg1' => ['n' => 'Safe work culture', 'd' => [
        'Breaches safety rules or creates an unsafe condition.',
        'Partially complies with the rules; requires frequent corrections.',
        'Complies with the rules and correctly uses the established controls (PPE, permits, lockout, signage).',
        'Acts preventively: identifies hazards before operating and sustains safe practices throughout the shift.',
        'Actively promotes safety: corrects deviations, applies stop-work authority and sets the example for the team.',
    ]],
    'seg2' => ['n' => 'Housekeeping (5S) compliance in common areas', 'd' => [
        'Leaves common areas dirty (canteen, locker room, restrooms).',
        'Tidies up only when told.',
        'Keeps basic order and cleanliness in common areas.',
        'Consistently leaves the areas better than they found them.',
        'Promotes 5S within the team and proposes improvements for common areas.',
    ]],
    'ore1' => ['n' => 'Punctuality at handover and shift start', 'd' => [
        'Repeatedly late and delays the handover.',
        'Arrives right on time or with occasional delays affecting the start.',
        'Arrives on time and starts the shift without delays.',
        'Arrives early and carries out an orderly, informed handover.',
        'Always early: hands over and takes over the shift with complete information that prevents rework.',
    ]],
    'ore2' => ['n' => 'Remaining at the assigned workstation', 'd' => [
        'Leaves the workstation without authorization.',
        'Frequently absent or slow to return.',
        'Stays at their workstation during the shift.',
        'Stays alert at their post and reports any justified absence.',
        'Full presence and coverage of the post; arranges a replacement before stepping away.',
    ]],
];

/** Conducta crítica de la ficha de Compromiso (SI/NO). */
const CONDUCTA_CRITICA_C_EN = 'Serious disrespect or failure to follow a direct instruction during the shift';

/** Añade los campos en inglés a una lista de bloques (Desenvolvimiento). */
function bloques_i18n(array $bloques): array
{
    foreach ($bloques as &$b) {
        $b['t_en'] = BLOQUES_EN[$b['id']] ?? $b['t'];
        foreach ($b['acts'] as &$a) {
            $tr = ACTS_EN[$a['id']] ?? null;
            $a['n_en'] = $tr['n'] ?? $a['n'];
            $a['d_en'] = $tr['d'] ?? ($a['d'] ?? []);
        }
        unset($a);
    }
    unset($b);
    return $bloques;
}

/** Añade los campos en inglés a la lista de conductas (Compromiso). */
function actividades_c_i18n(array $acts): array
{
    foreach ($acts as &$a) {
        $tr = ACTS_C_EN[$a['id']] ?? null;
        $a['n_en'] = $tr['n'] ?? $a['n'];
        $a['d_en'] = $tr['d'] ?? ($a['d'] ?? []);
    }
    unset($a);
    return $acts;
}

/** Añade la etiqueta en inglés a la escala 1-5. */
function escala_i18n(array $escala): array
{
    foreach ($escala as &$e) {
        $e['l_en'] = ESCALA_EN[$e['v']] ?? $e['l'];
    }
    unset($e);
    return $escala;
}
