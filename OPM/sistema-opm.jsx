import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck, Users, Award, AlertTriangle, Check, ChevronLeft,
  Anchor, Ship, Loader2, ShieldAlert, Trash2, Plus
} from "lucide-react";

/* ============================ CONFIG ============================ */
const P = {
  pesos: { O1: 0.40, O2: 0.30, O3: 0.15, O4: 0.15 },
  sobre5: 4.5, cumple5: 3.0,          // cortes escala 1-5
  pesoObj: 0.70, pesoCond: 0.30,
  minimo: 3.0,                        // puntaje minimo esperado
  topeEvento: 2.5,                    // tope O1/O3 si hay evento de seguridad
  piso: 8,                            // fichas minimas por trimestre
  pctMuestreo: 0.20,
  minCarga: 2,
  minSupers: 3,
};

const OBJ = {
  O1: { n: "Seguridad y cumplimiento", c: "#C0392B" },
  O2: { n: "Ejecución técnica", c: "#0060A9" },
  O3: { n: "Productividad", c: "#7A5195" },
  O4: { n: "Cuidado de carga y equipos", c: "#1E7B34" },
};

const BLOQUES = [
  { id: "trans", t: "Transversal", cond: false, acts: [
    { id: "t1", o: "O4", n: "Inspección preoperacional de equipos y aparejos" },
    { id: "t2", o: "O4", n: "Preparación y señalización del área" },
    { id: "t3", o: "O1", n: "Uso de EPP" },
    { id: "t4", o: "O4", n: "Orden y limpieza" }]},
  { id: "amarre", t: "Amarre", cond: true, acts: [
    { id: "a1", o: "O2", n: "Amarre / desamarre" },
    { id: "a2", o: "O2", n: "Uso de shore tension" }]},
  { id: "cont", t: "Contenedores", carga: "Contenedores", acts: [
    { id: "c1", o: "O2", n: "Señalización a grúa / portalón" },
    { id: "c2", o: "O2", n: "Trincado / destrincado" },
    { id: "c3", o: "O2", n: "Pin station (retiro y colocación de piñas)" },
    { id: "c4", o: "O2", n: "Uso de PDA" },
    { id: "c5", o: "O2", n: "Lectura de planos" },
    { id: "c6", o: "O2", n: "Reefer (conexión / monitoreo)" }]},
  { id: "granel", t: "Granel sólido", carga: "Granel sólido", acts: [
    { id: "g1", o: "O2", n: "Dominio de hopper" },
    { id: "g2", o: "O2", n: "Trimming / nivelación de carga" },
    { id: "g3", o: "O2", n: "Comunicación con operadores" },
    { id: "g4", o: "O2", n: "Limpieza de bodegas" },
    { id: "g5", o: "O1", n: "Control de material de izaje" }]},
  { id: "frac", t: "Carga fraccionada", carga: "Carga fraccionada", acts: [
    { id: "f1", o: "O2", n: "Aparejamiento (rigging)" },
    { id: "f2", o: "O1", n: "Revisión de materiales de izaje + alerta de deterioro" },
    { id: "f3", o: "O2", n: "Ejecución del plan de izaje" },
    { id: "f4", o: "O2", n: "Señalero / rigger" },
    { id: "f5", o: "O2", n: "Aseguramiento de material de izaje" }]},
  { id: "bb", t: "Big bags", carga: "Big bags", acts: [
    { id: "b1", o: "O2", n: "Eslingado / enganche de big bags con seguridad" },
    { id: "b2", o: "O2", n: "Comunicación con montacarguista" },
    { id: "b3", o: "O1", n: "Revisión de materiales de izaje" },
    { id: "b4", o: "O1", n: "Seguridad en maniobras" }]},
  { id: "prod", t: "Productividad", cond: false, acts: [
    { id: "p1", o: "O3", n: "Ritmo / rendimiento del turno" }]},
];

const CARGAS = ["Contenedores", "Granel sólido", "Carga fraccionada", "Big bags"];
const CONDUCTAS = ["Comunicación", "Adaptabilidad", "Trabajo en equipo",
  "Iniciativa e innovación", "Respeto", "Orientación a la seguridad", "Orientación a resultados"];
const ESCALA = [
  { v: 1, l: "Insatisfactorio", c: "#C0392B" },
  { v: 2, l: "Regular", c: "#E67E22" },
  { v: 3, l: "Aceptable", c: "#B8860B" },
  { v: 4, l: "Bueno", c: "#0060A9" },
  { v: 5, l: "Excelente", c: "#1E7B34" },
];

/* ============================ LÓGICA ============================ */
const nivel5 = (v) => v == null ? null : v >= P.sobre5 ? "Sobre" : v >= P.cumple5 ? "Cumple" : "Por Debajo";
const colorNivel = (n) => n === "Sobre" ? "#1E7B34" : n === "Cumple" ? "#0060A9" : "#C0392B";

/** Promedios por objetivo de UNA ficha; aplica el tope si hubo evento de seguridad. */
function promediosFicha(ratings, evento) {
  const acc = {};
  BLOQUES.forEach(b => b.acts.forEach(a => {
    const v = ratings[a.id];
    if (typeof v === "number") {
      (acc[a.o] = acc[a.o] || []).push(v);
    }
  }));
  const out = {};
  Object.keys(OBJ).forEach(o => {
    if (!acc[o]?.length) { out[o] = null; return; }
    let m = acc[o].reduce((s, x) => s + x, 0) / acc[o].length;
    if (evento && (o === "O1" || o === "O3")) m = Math.min(m, P.topeEvento);
    out[o] = m;
  });
  return out;
}

/** Consolida las fichas de un OPM en el trimestre. */
function consolidar(fichas) {
  const out = {};
  Object.keys(OBJ).forEach(o => {
    const vals = fichas.map(f => f.prom[o]).filter(v => typeof v === "number");
    out[o] = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
  });
  const supers = new Set(fichas.map(f => f.supervisor).filter(Boolean));
  const cob = {};
  CARGAS.forEach(c => cob[c] = fichas.filter(f => f.carga === c).length);
  const eventos = fichas.filter(f => f.evento).length;
  return { obj: out, n: fichas.length, supers: supers.size, cob, eventos };
}

function estado(c, turnos) {
  if (c.n === 0) return { t: "SIN FICHAS", c: "#6B7280" };
  if (c.n < P.piso) return { t: "EVIDENCIA INSUFICIENTE", c: "#C0392B" };
  if (turnos && c.n < turnos * P.pctMuestreo) return { t: "BAJO % MUESTREO", c: "#B8860B" };
  if (c.supers < P.minSupers) return { t: "POCOS EVALUADORES", c: "#B8860B" };
  return { t: "VÁLIDA", c: "#1E7B34" };
}

/** Evaluación 70/30 con la regla de bloqueo CSPCP. */
function evaluar(obj, conductas) {
  let num = 0, den = 0;
  Object.keys(OBJ).forEach(o => {
    if (typeof obj[o] === "number") { num += P.pesos[o] * obj[o]; den += P.pesos[o]; }
  });
  const objScore = den ? num / den : null;                       // escala 1-5
  const cVals = CONDUCTAS.map(k => conductas[k]).filter(Boolean)
    .map(v => v === "Sobre" ? 5 : v === "Cumple" ? 3 : 1);       // conductas en escala 1-5
  const condScore = cVals.length ? cVals.reduce((s, x) => s + x, 0) / cVals.length : null;
  if (objScore == null || condScore == null) return { objScore, condScore };
  const comb = P.pesoObj * objScore + P.pesoCond * condScore;    // una sola escala 1-5
  const prelim = nivel5(comb);
  const nCond = nivel5(condScore);
  const final = (prelim === "Sobre" && nCond === "Por Debajo") ? "Cumple" : prelim;  // bloqueo
  return { objScore, condScore, comb, prelim, final, nCond, bloqueado: prelim === "Sobre" && nCond === "Por Debajo" };
}

const OPMS = Array.from({ length: 14 }, (_, i) => ({
  id: `OPM-${String(i + 1).padStart(3, "0")}`,
  nombre: ["Juan Pérez","Ana López","Luis Díaz","Rosa Vega","Carlos Ruiz","Marta Soto","Pedro Cruz",
           "Elena Ríos","Jorge Mena","Sofía Paz","Iván Rojas","Nora Lima","Hugo Salas","Vera Cano"][i],
}));
const SUPERS = ["C. Rodríguez", "K. Avellaneda", "M. Torres", "L. Quispe"];

/* ============================ UI ============================ */
export default function App() {
  const [vista, setVista] = useState("menu");
  const [fichas, setFichas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState(null);

  useEffect(() => { (async () => {
    try {
      const r = await window.storage.get("fichas_opm", true);
      setFichas(r ? JSON.parse(r.value) : []);
    } catch { setFichas([]); }
    setCargando(false);
  })(); }, []);

  const guardar = async (nuevas) => {
    setFichas(nuevas);
    try { await window.storage.set("fichas_opm", JSON.stringify(nuevas), true); }
    catch (e) { console.error("No se pudo guardar", e); }
  };

  if (cargando) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-800" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="text-white px-4 py-3 sticky top-0 z-20 shadow-lg" style={{ background: "#002E6D" }}>
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          {vista !== "menu" && (
            <button onClick={() => { setVista("menu"); setSel(null); }}
              className="p-1 -ml-1 rounded active:bg-blue-900" aria-label="Volver">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-widest font-bold" style={{ color: "#8FB3DC" }}>
              COSCO SHIPPING PORTS CHANCAY
            </div>
            <div className="text-lg font-bold leading-tight truncate">
              {vista === "menu" ? "Desempeño OPM" :
               vista === "ficha" ? "Nueva ficha de turno" :
               vista === "control" ? "Control trimestral" : "Evaluación de desempeño"}
            </div>
          </div>
        </div>
        <div className="h-1 -mx-4 mt-3" style={{ background: "#EF7D00" }} />
      </header>

      <main className="max-w-3xl mx-auto p-4 pb-24">
        {vista === "menu" && <Menu setVista={setVista} fichas={fichas} />}
        {vista === "ficha" && <Ficha fichas={fichas} guardar={guardar} volver={() => setVista("menu")} />}
        {vista === "control" && <Control fichas={fichas} abrir={(id) => { setSel(id); setVista("evaluar"); }} guardar={guardar} />}
        {vista === "evaluar" && <Evaluacion fichas={fichas} opmId={sel} setSel={setSel} />}
      </main>
    </div>
  );
}

/* ---------- Menú ---------- */
function Menu({ setVista, fichas }) {
  const total = fichas.length;
  const enRiesgo = OPMS.filter(o => {
    const f = fichas.filter(x => x.opm === o.id);
    return f.length > 0 && f.length < P.piso;
  }).length;
  const eventos = fichas.filter(f => f.evento).length;

  const items = [
    { v: "ficha", i: ClipboardCheck, t: "Registrar turno", d: "Califica a un OPM al cierre del turno", c: "#0060A9" },
    { v: "control", i: Users, t: "Control trimestral", d: "Fichas acumuladas, cobertura y validez", c: "#002E6D" },
    { v: "evaluar", i: Award, t: "Evaluar desempeño", d: "Objetivos 70% + conductas 30%", c: "#EF7D00" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat n={total} l="Fichas" />
        <Stat n={eventos} l="Eventos seg." alerta={eventos > 0} />
        <Stat n={enRiesgo} l="Bajo el piso" alerta={enRiesgo > 0} />
      </div>
      {items.map(it => (
        <button key={it.v} onClick={() => setVista(it.v)}
          className="w-full bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm border border-slate-200 active:scale-[0.99] transition text-left">
          <div className="rounded-lg p-3 shrink-0" style={{ background: it.c }}>
            <it.i size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900">{it.t}</div>
            <div className="text-sm text-slate-500">{it.d}</div>
          </div>
        </button>
      ))}
      <p className="text-xs text-slate-500 px-1 pt-2">
        Prototipo para piloto. Los datos se guardan en el dispositivo y son visibles para todos los que usen esta app.
      </p>
    </div>
  );
}

function Stat({ n, l, alerta }) {
  return (
    <div className="bg-white rounded-xl p-3 text-center border border-slate-200">
      <div className="text-2xl font-bold" style={{ color: alerta ? "#C0392B" : "#002E6D" }}>{n}</div>
      <div className="text-[11px] text-slate-500 leading-tight">{l}</div>
    </div>
  );
}

/* ---------- Ficha (registro por turno) ---------- */
function Ficha({ fichas, guardar, volver }) {
  const [opm, setOpm] = useState("");
  const [supervisor, setSupervisor] = useState(SUPERS[0]);
  const [turno, setTurno] = useState("Día");
  const [carga, setCarga] = useState("");
  const [amarre, setAmarre] = useState(false);
  const [evento, setEvento] = useState(false);
  const [ratings, setRatings] = useState({});
  const [ok, setOk] = useState(false);

  const visibles = useMemo(() => BLOQUES.filter(b =>
    b.id === "trans" || b.id === "prod" ||
    (b.id === "amarre" && amarre) ||
    (b.carga && b.carga === carga)
  ), [carga, amarre]);

  const prom = useMemo(() => {
    const r = {};
    visibles.forEach(b => b.acts.forEach(a => { if (ratings[a.id]) r[a.id] = ratings[a.id]; }));
    return promediosFicha(r, evento);
  }, [ratings, evento, visibles]);

  const pendientes = visibles.flatMap(b => b.acts).filter(a => !ratings[a.id]).length;
  const listo = opm && carga && pendientes === 0;

  const enviar = async () => {
    const r = {};
    visibles.forEach(b => b.acts.forEach(a => { if (ratings[a.id]) r[a.id] = ratings[a.id]; }));
    const nueva = {
      id: Date.now(), opm, supervisor, turno, carga, amarre, evento,
      fecha: new Date().toISOString().slice(0, 10),
      prom: promediosFicha(r, evento),
    };
    await guardar([...fichas, nueva]);
    setOk(true);
    setTimeout(volver, 1200);
  };

  if (ok) return (
    <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
      <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "#1E7B34" }}>
        <Check size={28} className="text-white" />
      </div>
      <div className="font-bold text-lg text-slate-900">Ficha registrada</div>
      <div className="text-sm text-slate-500">Se sumó a la evidencia del trimestre.</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <Campo l="Operario (OPM)">
          <select value={opm} onChange={e => setOpm(e.target.value)} className={inputCls}>
            <option value="">Seleccione…</option>
            {OPMS.map(o => <option key={o.id} value={o.id}>{o.id} · {o.nombre}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo l="Supervisor">
            <select value={supervisor} onChange={e => setSupervisor(e.target.value)} className={inputCls}>
              {SUPERS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo l="Turno">
            <select value={turno} onChange={e => setTurno(e.target.value)} className={inputCls}>
              <option>Día</option><option>Noche</option>
            </select>
          </Campo>
        </div>
        <Campo l="Tipo de carga operada">
          <div className="grid grid-cols-2 gap-2">
            {CARGAS.map(c => (
              <button key={c} onClick={() => setCarga(c)}
                className={`py-3 px-2 rounded-lg text-sm font-semibold border-2 transition ${
                  carga === c ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
                style={carga === c ? { background: "#0060A9" } : {}}>
                {c}
              </button>
            ))}
          </div>
        </Campo>
        <button onClick={() => setAmarre(!amarre)}
          className={`w-full py-3 rounded-lg text-sm font-semibold border-2 flex items-center justify-center gap-2 ${
            amarre ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
          style={amarre ? { background: "#EF7D00" } : {}}>
          <Anchor size={16} /> {amarre ? "Participó en amarre" : "¿Participó en amarre?"}
        </button>
      </div>

      {!carga && (
        <div className="bg-white rounded-xl p-8 text-center border border-dashed border-slate-300">
          <Ship size={32} className="mx-auto text-slate-300 mb-2" />
          <div className="text-sm text-slate-500">Elija el tipo de carga para ver las actividades del turno.</div>
        </div>
      )}

      {carga && visibles.map(b => (
        <div key={b.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 text-white text-xs font-bold tracking-wide" style={{ background: "#002E6D" }}>
            {b.t.toUpperCase()}
          </div>
          <div className="divide-y divide-slate-100">
            {b.acts.map(a => (
              <div key={a.id} className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{ background: OBJ[a.o].c }}>{a.o}</span>
                  <span className="text-sm text-slate-800 leading-snug">{a.n}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {ESCALA.map(e => (
                    <button key={e.v} onClick={() => setRatings({ ...ratings, [a.id]: e.v })}
                      className={`py-2.5 rounded-lg text-base font-bold border-2 transition ${
                        ratings[a.id] === e.v ? "text-white border-transparent" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                      style={ratings[a.id] === e.v ? { background: e.c } : {}}
                      aria-label={`${a.n}: ${e.l}`}>
                      {e.v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {carga && (
        <>
          <button onClick={() => setEvento(!evento)}
            className={`w-full rounded-xl p-4 flex items-center gap-3 border-2 transition ${
              evento ? "text-white border-transparent" : "bg-white text-slate-700 border-slate-200"}`}
            style={evento ? { background: "#C0392B" } : {}}>
            <ShieldAlert size={22} className="shrink-0" />
            <div className="text-left">
              <div className="font-bold text-sm">Evento de seguridad en el turno</div>
              <div className={`text-xs ${evento ? "text-red-100" : "text-slate-500"}`}>
                {evento ? "Seguridad y Productividad quedan por debajo de lo esperado."
                        : "Marque si hubo incidente u observación."}
              </div>
            </div>
          </button>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 text-xs font-bold tracking-wide text-white" style={{ background: "#0060A9" }}>
              PROMEDIOS DE ESTE TURNO
            </div>
            <div className="p-3 space-y-2">
              {Object.keys(OBJ).map(o => {
                const v = prom[o]; const n = nivel5(v);
                return (
                  <div key={o} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                      style={{ background: OBJ[o].c }}>{o}</span>
                    <span className="text-xs text-slate-600 flex-1 truncate">{OBJ[o].n}</span>
                    {v == null ? <span className="text-xs text-slate-300">—</span> : (
                      <>
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(v / 5) * 100}%`, background: colorNivel(n) }} />
                        </div>
                        <span className="text-sm font-bold w-9 text-right" style={{ color: colorNivel(n) }}>
                          {v.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={enviar} disabled={!listo}
            className="w-full py-4 rounded-xl font-bold text-white disabled:bg-slate-300 shadow-lg"
            style={listo ? { background: "#EF7D00" } : {}}>
            {pendientes > 0 ? `Faltan ${pendientes} actividad${pendientes > 1 ? "es" : ""}` : "Guardar ficha"}
          </button>
        </>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-3 rounded-lg border-2 border-slate-200 text-slate-800 bg-white text-sm font-medium";
function Campo({ l, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-500 mb-1 tracking-wide uppercase">{l}</span>
      {children}
    </label>
  );
}

/* ---------- Control trimestral ---------- */
function Control({ fichas, abrir, guardar }) {
  const filas = OPMS.map(o => {
    const f = fichas.filter(x => x.opm === o.id);
    const c = consolidar(f);
    return { ...o, ...c, est: estado(c, null) };
  }).sort((a, b) => b.n - a.n);

  if (!fichas.length) return (
    <div className="bg-white rounded-xl p-10 text-center border border-dashed border-slate-300">
      <Users size={32} className="mx-auto text-slate-300 mb-2" />
      <div className="font-semibold text-slate-700">Aún no hay fichas</div>
      <div className="text-sm text-slate-500 mt-1">Registre turnos para construir la evidencia del trimestre.</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-3 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <span>La evaluación solo es válida con al menos <b>{P.piso} fichas</b>, <b>{P.minSupers} supervisores</b> distintos y <b>{P.minCarga} fichas</b> por tipo de carga operado.</span>
      </div>

      {filas.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm">{r.id} · {r.nombre}</div>
              <div className="text-xs text-slate-500">
                {r.n} ficha{r.n !== 1 && "s"} · {r.supers} supervisor{r.supers !== 1 && "es"}
                {r.eventos > 0 && <span className="text-red-600 font-semibold"> · {r.eventos} evento{r.eventos > 1 && "s"}</span>}
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded text-white shrink-0" style={{ background: r.est.c }}>
              {r.est.t}
            </span>
          </div>

          <div className="px-3 pb-2">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (r.n / P.piso) * 100)}%`, background: r.n >= P.piso ? "#1E7B34" : "#C0392B" }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{r.n} de {P.piso} fichas mínimas</div>
          </div>

          {r.n > 0 && (
            <div className="px-3 pb-3 grid grid-cols-4 gap-1.5">
              {Object.keys(OBJ).map(o => {
                const v = r.obj[o];
                return (
                  <div key={o} className="rounded-lg py-1.5 text-center" style={{ background: "#F1F5F9" }}>
                    <div className="text-[9px] font-bold" style={{ color: OBJ[o].c }}>{o}</div>
                    <div className="text-sm font-bold" style={{ color: v == null ? "#CBD5E1" : colorNivel(nivel5(v)) }}>
                      {v == null ? "—" : v.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {r.est.t === "VÁLIDA" && (
            <button onClick={() => abrir(r.id)}
              className="w-full py-2.5 text-sm font-bold text-white" style={{ background: "#EF7D00" }}>
              Evaluar desempeño
            </button>
          )}
        </div>
      ))}

      <button onClick={() => { if (confirm("¿Borrar todas las fichas registradas?")) guardar([]); }}
        className="w-full py-3 rounded-xl text-sm font-semibold text-slate-500 border border-slate-300 flex items-center justify-center gap-2">
        <Trash2 size={15} /> Reiniciar datos del piloto
      </button>
    </div>
  );
}

/* ---------- Evaluación ---------- */
function Evaluacion({ fichas, opmId, setSel }) {
  const [conductas, setConductas] = useState({});
  const opm = OPMS.find(o => o.id === opmId);

  if (!opm) return (
    <div className="space-y-2">
      <div className="text-sm text-slate-600 mb-2">Elija el operario a evaluar:</div>
      {OPMS.map(o => {
        const c = consolidar(fichas.filter(x => x.opm === o.id));
        const e = estado(c, null);
        const puede = e.t === "VÁLIDA";
        return (
          <button key={o.id} onClick={() => puede && setSel(o.id)} disabled={!puede}
            className="w-full bg-white rounded-xl p-3 border border-slate-200 flex items-center gap-3 disabled:opacity-50 text-left">
            <div className="flex-1">
              <div className="font-bold text-sm text-slate-900">{o.id} · {o.nombre}</div>
              <div className="text-xs text-slate-500">{c.n} fichas</div>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ background: e.c }}>{e.t}</span>
          </button>
        );
      })}
    </div>
  );

  const f = fichas.filter(x => x.opm === opmId);
  const c = consolidar(f);
  const r = evaluar(c.obj, conductas);
  const faltan = CONDUCTAS.filter(k => !conductas[k]).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="font-bold text-slate-900">{opm.id} · {opm.nombre}</div>
        <div className="text-xs text-slate-500">Operario de Puerto Multipropósito · {c.n} fichas del trimestre</div>
      </div>

      <Seccion t="A. Logro de objetivos" p="70%" color="#002E6D">
        <div className="space-y-2">
          {Object.keys(OBJ).map(o => {
            const v = c.obj[o]; const n = nivel5(v);
            return (
              <div key={o} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: OBJ[o].c }}>{o}</span>
                <span className="text-xs text-slate-600 flex-1 truncate">{OBJ[o].n}</span>
                <span className="text-[10px] text-slate-400">{(P.pesos[o] * 100).toFixed(0)}%</span>
                <span className="text-sm font-bold w-9 text-right" style={{ color: v == null ? "#CBD5E1" : colorNivel(n) }}>
                  {v == null ? "—" : v.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        {r.objScore != null && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">PROMEDIO PONDERADO (1-5)</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: colorNivel(nivel5(r.objScore)) }}>{r.objScore.toFixed(2)}</span>
              <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ background: colorNivel(nivel5(r.objScore)) }}>
                {nivel5(r.objScore)}
              </span>
            </div>
          </div>
        )}
      </Seccion>

      <Seccion t="B. Conductas corporativas" p="30%" color="#EF7D00">
        <div className="text-[11px] text-slate-500 mb-3">Modelo de Liderazgo Institucional de COSCO SHIPPING · Sobre = 5 · Cumple = 3 · Por Debajo = 1</div>
        <div className="space-y-2.5">
          {CONDUCTAS.map(k => (
            <div key={k}>
              <div className="text-xs font-semibold text-slate-700 mb-1">{k}</div>
              <div className="grid grid-cols-3 gap-1">
                {["Por Debajo", "Cumple", "Sobre"].map(n => (
                  <button key={n} onClick={() => setConductas({ ...conductas, [k]: n })}
                    className={`py-2 rounded-lg text-[11px] font-bold border-2 transition ${
                      conductas[k] === n ? "text-white border-transparent" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                    style={conductas[k] === n ? { background: colorNivel(n) } : {}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      {faltan > 0 ? (
        <div className="bg-white rounded-xl p-4 text-center border border-dashed border-slate-300 text-sm text-slate-500">
          Faltan {faltan} conducta{faltan > 1 ? "s" : ""} por calificar.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-2 text-white text-xs font-bold" style={{ background: "#002E6D" }}>C. RESULTADO FINAL</div>
          <div className="bg-white p-4 space-y-2">
            <Linea l="Nivel objetivos (70%)" v={nivel5(r.objScore)} />
            <Linea l="Nivel conductas (30%)" v={r.nCond} />
            <Linea l="Score combinado (escala 1-5)" v={r.comb.toFixed(2)} plano />
            {r.bloqueado && (
              <div className="flex items-start gap-2 p-2 rounded-lg text-xs" style={{ background: "#FDEBD3", color: "#9C5700" }}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>Regla CSPCP: un “Por Debajo” en conductas impide un “Sobre” final.</span>
              </div>
            )}
          </div>
          <div className="p-5 text-center" style={{ background: colorNivel(r.final) }}>
            <div className="text-[11px] font-bold text-white/70 tracking-widest mb-1">NIVEL FINAL</div>
            <div className="text-3xl font-bold text-white">{r.final}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Seccion({ t, p, color, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between text-white" style={{ background: color }}>
        <span className="text-xs font-bold tracking-wide">{t.toUpperCase()}</span>
        <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">{p}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Linea({ l, v, plano }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-600">{l}</span>
      {plano ? <span className="text-sm font-bold text-slate-800">{v}</span> : (
        <span className="text-[11px] font-bold px-2 py-1 rounded text-white" style={{ background: colorNivel(v) }}>{v}</span>
      )}
    </div>
  );
}
