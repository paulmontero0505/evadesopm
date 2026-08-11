// ============================================================
//  Cálculos de vista previa en el cliente.
//  El catálogo (objetivos, bloques, cargas, conductas, escala, params)
//  viene siempre del servidor (GET /rules): aquí solo vive la fórmula,
//  nunca los números — así no hay forma de que cliente y servidor
//  diverjan. El servidor SIEMPRE vuelve a calcular al guardar.
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

/** Bloques de actividades visibles para una combinación carga/amarre. */
export function visibleBlocks(bloques, carga, amarre) {
  return bloques.filter((b) =>
    b.id === 'trans' || b.id === 'prod' ||
    (b.id === 'amarre' && amarre) ||
    (b.carga && b.carga === carga)
  )
}

/** Promedios por objetivo de UNA ficha en curso (solo vista previa). */
export function promediosFicha(bloques, objetivos, params, ratings, evento) {
  const acc = {}
  bloques.forEach((b) => b.acts.forEach((a) => {
    const v = ratings[a.id]
    if (typeof v === 'number') (acc[a.o] = acc[a.o] || []).push(v)
  }))
  const out = {}
  Object.keys(objetivos).forEach((o) => {
    if (!acc[o]?.length) { out[o] = null; return }
    let m = acc[o].reduce((s, x) => s + x, 0) / acc[o].length
    if (evento && (o === 'O1' || o === 'O3')) m = Math.min(m, params.topeEvento)
    out[o] = m
  })
  return out
}

/** Trimestre calendario (1-4) de hoy. */
export function currentQuarter(date = new Date()) {
  return Math.floor(date.getMonth() / 3) + 1
}
