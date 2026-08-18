// ============================================================
//  Módulo "Cuidado y limpieza de instalaciones operativas"
//  Catálogos, cuestionario y estándares del Plan de Sensibilización
//  OPS-SEN-001 v1.0 (COSCO SHIPPING PORTS CHANCAY PERÚ).
//
//  Todo el contenido normativo del módulo vive aquí: las páginas solo lo
//  presentan. Si el plan cambia, se edita este archivo.
// ============================================================

// ---------------------------------------------- § 1.2 Alcance de instalaciones

export const INSTALACIONES = [
  {
    id: 'pin',
    corto: 'PIN',
    nombre: 'Caseta PIN Station',
    zona: 'Accesos y patio',
    color: '#0060A9',
    aprobador: 'Supervisor de Operaciones de Patio',
    mensaje: 'ANTES DE SALIR: superficies despejadas, residuos al tacho, equipos apagados.',
  },
  {
    id: 'paradero',
    corto: 'PAR',
    nombre: 'Paradero de patio',
    zona: 'Patio',
    color: '#EF7D00',
    aprobador: 'Supervisor de Operaciones de Patio',
    mensaje: 'ESTE PARADERO ES TUYO Y DE TU RELEVO. Deja la banca como te gustaría encontrarla.',
  },
  {
    id: 'cabina',
    corto: 'CAB',
    nombre: 'Cabina de grúa',
    zona: 'Muelle',
    color: '#002E6D',
    aprobador: 'Supervisor de Operaciones de Muelle',
    mensaje: 'CABINA LIMPIA, VISIÓN CLARA. Sin alimentos. Sin objetos sueltos. Vidrios despejados.',
  },
  {
    id: 'balanza',
    corto: 'BAL',
    nombre: 'Balanza',
    zona: 'Patio / accesos',
    color: '#7A5195',
    aprobador: 'Jefe del Centro de Operaciones',
    mensaje: 'PLATAFORMA DESPEJADA = PESO CONFIABLE. Revisa canaletas antes de operar.',
  },
]

export const instalacionPorId = (id) => INSTALACIONES.find((i) => i.id === id)

// § 4.2 Tabla 4 — aprobador principal por instalación.
export const aprobadorDe = (id) => instalacionPorId(id)?.aprobador || ''

// Ubicaciones nominales sugeridas (el campo sigue siendo de texto libre).
export const UBICACIONES = {
  pin: ['PIN Station 1 · Gate In', 'PIN Station 2 · Gate Out', 'PIN Station 3 · Patio norte'],
  paradero: ['Paradero P-01 · Patio central', 'Paradero P-02 · Patio norte', 'Paradero P-03 · Muelle sur'],
  cabina: ['STS 01', 'STS 02', 'STS 03', 'RTG 01', 'RTG 02', 'RTG 03'],
  balanza: ['Balanza 1 · Ingreso', 'Balanza 2 · Salida'],
}

export const ZONAS = ['Muelle', 'Patio', 'Accesos', 'Sala de operaciones']

export const turnoOpuesto = (id) => (id === 'dia' ? 'noche' : 'dia')

// § 5.1 Fase 0 (línea base) y § 5.5 Fase 4 (comparación final)
export const FASES = [
  { id: 'diagnostico', nombre: 'Diagnóstico', detalle: 'Fase 0 · semanas 1 y 2 (línea base)' },
  { id: 'cierre', nombre: 'Cierre', detalle: 'Fase 4 · semana 12 (comparación)' },
]

// ------------------------------------------------- CASO 1 · encuesta § 5.1

export const ESCALA = [
  { v: 1, l: 'Muy malo', d: 'La condición es inaceptable y se repite en todos los turnos.', color: '#C0392B' },
  { v: 2, l: 'Malo', d: 'Falla con frecuencia; se corrige solo cuando alguien lo exige.', color: '#D9642B' },
  { v: 3, l: 'Regular', d: 'Cumple a medias; depende del turno o de la persona.', color: '#B8860B' },
  { v: 4, l: 'Bueno', d: 'Cumple casi siempre; fallas puntuales y menores.', color: '#3D8A4E' },
  { v: 5, l: 'Muy bueno', d: 'Cumple de forma sostenida, sin necesidad de recordatorio.', color: '#1E7B34' },
]

export const escalaPorValor = (v) => ESCALA.find((e) => e.v === v)

export const PREGUNTAS = [
  {
    id: 'p1',
    texto: 'Cuando inicias tu turno, ¿en qué condición de orden y limpieza recibes las instalaciones que vas a usar?',
    ancla: 'Línea base § 1.1',
    ayuda: 'Piensa en cómo te la entrega el turno saliente, no en cómo la dejas tú.',
  },
  {
    id: 'p2',
    texto: '¿Con qué claridad sabes quién es el responsable de la limpieza de cada instalación que utilizas?',
    ancla: 'Eficacia de la matriz § 4',
    ayuda: 'Se refiere a saber a quién le corresponde ejecutar y a quién reportar.',
  },
  {
    id: 'p3',
    texto: '¿Qué tan disponibles están los recursos para mantener limpia tu instalación (tachos, bolsas, insumos, contenedores de segregación)?',
    ancla: 'Condición material § 8.3',
    ayuda: 'El plan señala esta como la causa que más rápido deteriora la credibilidad de la campaña.',
  },
  {
    id: 'p4',
    texto: 'Cuando reportas un deterioro o una condición sucia, ¿qué tan oportuna es la respuesta de tu supervisión?',
    ancla: 'Consistencia de la línea de mando § 6.1',
    ayuda: 'Considera el tiempo que pasa entre que reportas y que algo cambia.',
  },
  {
    id: 'p5',
    texto: '¿Qué tan de acuerdo estás con que "lo que recibo limpio, lo entrego limpio" sea la norma de tu turno?',
    ancla: 'Mensaje central § 7.1',
    ayuda: 'No es si te parece correcto en teoría, sino si estás dispuesto a que se te exija.',
  },
]

export const PREGUNTA_INSTALACION = '¿Cuál de las cuatro instalaciones te preocupa más hoy?'
export const PREGUNTA_ABIERTA = '¿Qué haría falta para mantener esa instalación limpia de forma sostenida?'

// ---------------------------------------- CASO 2 · estándar esperado § 3

export const ESTANDARES = {
  pin: [
    { id: 'pin1', texto: 'Superficies de trabajo despejadas: sin envases, restos de alimentos ni efectos personales sobre escritorios o consolas.' },
    { id: 'pin2', texto: 'Piso libre de residuos y de obstáculos; recipiente de residuos con bolsa y por debajo de su capacidad.' },
    { id: 'pin3', texto: 'Documentación archivada en su lugar; sin acumulación de papel suelto.' },
    { id: 'pin4', texto: 'Iluminación, ventilación y equipos operativos; fallas reportadas el mismo turno en que se detectan.' },
    { id: 'pin5', texto: 'Al cierre: superficies limpias, residuos trasladados al punto de acopio y equipos apagados antes del relevo.' },
  ],
  paradero: [
    { id: 'par1', texto: 'Bancas libres de botellas, envases, prendas y EPP olvidado.' },
    { id: 'par2', texto: 'Residuos segregados en los contenedores correspondientes; ningún residuo en el piso ni en el perímetro.' },
    { id: 'par3', texto: 'Techo, iluminación y señalización en condición visible y sin deterioro reportable.' },
    { id: 'par4', texto: 'El paradero cuenta con responsables nominados por turno y zona, asignados por el Coordinador de Personal.' },
    { id: 'par5', texto: 'Al cierre: paradero despejado antes de la entrega de turno.' },
  ],
  cabina: [
    { id: 'cab1', texto: 'Vidrios limpios y sin obstrucciones: es una condición de visibilidad, no solo de aseo.', critico: true },
    { id: 'cab2', texto: 'Consola, tableros y asiento libres de residuos, papeles y objetos sueltos que puedan desplazarse durante la maniobra.', critico: true },
    { id: 'cab3', texto: 'Sin alimentos ni bebidas azucaradas en cabina; únicamente agua en envase con tapa.' },
    { id: 'cab4', texto: 'Piso de cabina limpio y sin material que comprometa el accionamiento de pedales o controles.', critico: true },
    { id: 'cab5', texto: 'En el relevo, el operador entrante verifica la condición recibida y la registra; el saliente retira sus efectos y residuos.' },
  ],
  balanza: [
    { id: 'bal1', texto: 'Plataforma de pesaje y canaletas despejadas de material particulado, piedras y residuos antes de iniciar la operación.', critico: true },
    { id: 'bal2', texto: 'Módulo o caseta de balanza ordenado: escritorio despejado, cableado recogido, impresora operativa y documentación archivada.' },
    { id: 'bal3', texto: 'Entorno inmediato sin derrames ni acumulación de material.' },
    { id: 'bal4', texto: 'Cualquier condición que pueda afectar la lectura se reporta de inmediato al Coordinador de Tallyman y se deriva a mantenimiento.', critico: true },
    { id: 'bal5', texto: 'Al cierre: tickets y documentación de pesaje archivados, sin acumulación de papel en el módulo.' },
  ],
}

export const RESPUESTAS = [
  { id: 'C', label: 'Conforme', color: '#1E7B34' },
  { id: 'NC', label: 'No conforme', color: '#C0392B' },
  { id: 'NA', label: 'N/A', color: '#64748B' },
]

export const ESTADO_ITEM = { C: 'Conforme', NC: 'No conforme', NA: 'N/A' }
export const COLOR_ITEM = { C: '#1E7B34', NC: '#C0392B', NA: '#64748B' }

// § 8.2 Seguimiento: semáforo del resultado de la inspección.
export function semaforo(pct) {
  if (pct === null || pct === undefined) return { id: 'sin', label: 'Sin datos', color: '#64748B' }
  if (pct >= 90) return { id: 'verde', label: 'Conforme', color: '#1E7B34' }
  if (pct >= 70) return { id: 'ambar', label: 'Observado', color: '#B8860B' }
  return { id: 'rojo', label: 'No conforme', color: '#C0392B' }
}

/** Porcentaje de conformidad: los N/A no cuentan ni a favor ni en contra. */
export function conformidad(respuestas) {
  const evaluados = Object.values(respuestas).filter((r) => r && r.estado && r.estado !== 'NA')
  if (!evaluados.length) return null
  const conformes = evaluados.filter((r) => r.estado === 'C').length
  return Math.round((conformes / evaluados.length) * 100)
}

// ------------------------------------------------- CASO 3 · hallazgos § 6

// El nivel de escalamiento N1-N5 no forma parte del formulario: el hallazgo se
// registra, se corrige y se cierra, y la consecuencia se resuelve fuera del
// sistema según la ruta del § 6 del plan.
export const ESTADOS = [
  { id: 'abierto', label: 'Abierto', color: '#C0392B' },
  { id: 'correccion', label: 'En corrección', color: '#B8860B' },
  { id: 'cerrado', label: 'Cerrado', color: '#1E7B34' },
]

export const estadoPorId = (id) => ESTADOS.find((e) => e.id === id)

// ----------------------------------------------------------- utilidades

export const fechaLarga = (iso) => {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Reduce la foto antes de enviarla. La evidencia se manda como data URL y el
 * backend la guarda en uploads/limpieza/, así que conviene que llegue liviana.
 */
export function comprimirImagen(file, maxLado = 800, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    lector.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Archivo de imagen no válido.'))
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', calidad))
      }
      img.src = lector.result
    }
    lector.readAsDataURL(file)
  })
}

/** Exportación CSV para el reporte semanal consolidado (§ 8.2). */
export function aCSV(filas, columnas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const cab = columnas.map((c) => esc(c.label)).join(';')
  const cuerpo = filas.map((f) => columnas.map((c) => esc(c.get(f))).join(';'))
  return [cab, ...cuerpo].join('\r\n')
}

export function descargarCSV(nombre, contenido) {
  // El BOM hace que Excel abra el archivo en UTF-8 sin pedir nada.
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
