// ============================================================
//  Cálculos de vista previa en el cliente para Evaluación de Compromiso.
//  El catálogo (objetivos, actividades, conducta crítica, escala, params)
//  viene siempre del servidor (GET /compromiso-rules): aquí solo vive la
//  fórmula, nunca los números — el servidor SIEMPRE vuelve a calcular al guardar.
// ============================================================

export function nivel5(v, params) {
  if (v == null) return null
  if (v >= params.sobre5) return 'Sobre'
  if (v >= params.cumple5) return 'Cumple'
  return 'Por Debajo'
}

export function colorNivel(n) {
  return n === 'Sobre' ? '#1E7B34' : n === 'Cumple' ? '#0060A9' : '#C0392B'
}

/** Texto completo del nivel CSPCP para mostrar en pantalla e impresión. */
export function nivelLabel(n) {
  if (n === 'Sobre') return 'Sobre las Expectativas'
  if (n === 'Cumple') return 'Cumple las Expectativas'
  if (n === 'Por Debajo') return 'Por Debajo de las Expectativas'
  return n
}

/** Promedios por objetivo de UNA ficha en curso (solo vista previa). */
export function promediosFichaCompromiso(objetivos, params, conductaCritica, actividades, ratings, critica) {
  const acc = {}
  actividades.forEach((a) => {
    const v = ratings[a.id]
    if (typeof v === 'number') (acc[a.o] = acc[a.o] || []).push(v)
  })
  const out = {}
  Object.keys(objetivos).forEach((o) => {
    if (!acc[o]?.length) { out[o] = null; return }
    let m = acc[o].reduce((s, x) => s + x, 0) / acc[o].length
    if (critica && o === conductaCritica.o) m = Math.min(m, params.topeEvento)
    out[o] = m
  })
  return out
}

/** Trimestre calendario (1-4) de hoy. */
export function currentQuarter(date = new Date()) {
  return Math.floor(date.getMonth() / 3) + 1
}
