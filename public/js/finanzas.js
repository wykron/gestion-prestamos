import { estado } from './estado.js';
import { addDays, fcorta, fdate, formatoNombre, hoy, iso, money, parse, r2 } from './utilidades.js';

export const find = (id) => estado.loans.find((l) => l.id === id);

export function fechas(l) {
  const inicio = parse(l.inicio);
  const excluidos = l.excluidos || [];
  const out = [];
  if (l.modo === 'semanal') {
    const desfase = (Number(l.dia) - inicio.getDay() + 7) % 7;
    for (let i = 0; i < l.cuotas; i++) out.push(iso(addDays(inicio, desfase + 7 * i)));
    return out;
  }
  let d = inicio;
  while (out.length < l.cuotas) {
    if (!excluidos.includes(d.getDay())) out.push(iso(d));
    d = addDays(d, 1);
  }
  return out;
}

export const cerrado = (l) => l.estado === 'refinanciado' || l.estado === 'encadenado';

export const abonoPrevio = (l) => l.abonoPrevio || 0;

export const deuda = (l) => r2(l.total - abonoPrevio(l));

export function montoCuota(l, i) {
  const base = r2(deuda(l) / l.cuotas);
  return i === l.cuotas - 1 ? r2(deuda(l) - base * (l.cuotas - 1)) : base;
}

export const inicioRecargo = (r) => r.desde || r.fecha;

export const vigente = (r) => inicioRecargo(r) <= hoy();

export const sumaRecargos = (l) => r2((l.recargos || []).filter(vigente).reduce((a, r) => a + r.monto, 0));

export const pagado = (l) => r2(l.pagos.reduce((a, p) => a + p.monto, 0));

export const saldo = (l) => (cerrado(l) ? 0 : r2(l.total + sumaRecargos(l) - abonoPrevio(l) - pagado(l)));

const MAX_ETAPAS = 50;

export const anterior = (l) => (l.encadenadoDe ? find(l.encadenadoDe) : null);

export const siguiente = (l) => (l.encadenadoEn ? find(l.encadenadoEn) : null);

export function cadena(l) {
  const atras = [];
  for (let p = anterior(l); p && atras.length < MAX_ETAPAS; p = anterior(p)) atras.unshift(p);
  const adelante = [];
  for (let n = siguiente(l); n && adelante.length < MAX_ETAPAS; n = siguiente(n)) adelante.push(n);
  return [...atras, l, ...adelante];
}

export const etapaPrevia = (l) => l.estado === 'encadenado' && Boolean(siguiente(l));

export function pagosCadena(l) {
  const etapas = cadena(l);
  const previos = etapas.slice(0, etapas.indexOf(l)).flatMap((e) => e.pagos.map((p) => ({ ...p, previo: true })));
  return [...previos, ...l.pagos].sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1));
}

export function recargoPendiente(l) {
  const cubierto = Math.min(sumaRecargos(l), Math.max(0, pagado(l) - deuda(l)));
  return r2(sumaRecargos(l) - cubierto);
}

export function distribuirPagos(l) {
  const cuotas = fechas(l).map((due, i) => {
    const monto = montoCuota(l, i);
    return { n: i + 1, due, monto, abonado: 0, falta: monto, pagadoEl: null };
  });
  const cubre = {};
  [...l.pagos].sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1)).forEach((p) => {
    let resto = p.monto;
    const base = cuotas.filter((c) => c.due <= p.fecha).reverse().concat(cuotas.filter((c) => c.due > p.fecha));
    const orden = p.cuota ? base.filter((c) => c.n === p.cuota).concat(base.filter((c) => c.n !== p.cuota)) : base;
    cubre[p.id] = [];
    orden.forEach((c) => {
      const aplicado = r2(Math.min(resto, c.falta));
      if (aplicado <= 0) return;
      c.abonado = r2(c.abonado + aplicado);
      c.falta = r2(c.monto - c.abonado);
      c.pagadoEl = p.fecha;
      resto = r2(resto - aplicado);
      cubre[p.id].push(c.n);
    });
    cubre[p.id].sort((a, b) => a - b);
  });
  return { cuotas, cubre };
}

export function calendario(l) {
  const t = hoy();
  return distribuirPagos(l).cuotas.map((c) => {
    let etiqueta = 'Pendiente';
    if (c.falta === 0) etiqueta = 'Pagada';
    else if (c.due < t) etiqueta = c.abonado > 0 ? 'Vencida (parcial)' : 'Vencida';
    else if (c.abonado > 0) etiqueta = 'Parcial';
    return Object.assign(c, { estado: etiqueta });
  });
}

export function describirCobertura(numeros) {
  if (!numeros.length) return 'aplicado a recargos';
  return (numeros.length > 1 ? 'cuotas ' : 'cuota ') + numeros.map((n) => '#' + n).join(', ');
}

export const montoRecargo = (l, pct) => r2(l.monto * pct / 100);

export function limite(l) {
  const f = fechas(l);
  return f[f.length - 1];
}

export function enMora(l) {
  return !cerrado(l) && saldo(l) > 0 && hoy() > limite(l);
}

export function debeAHoy(l) {
  if (cerrado(l) || saldo(l) <= 0) return 0;
  const t = hoy();
  const cuotas = calendario(l).filter((c) => c.due <= t).reduce((a, c) => a + c.falta, 0);
  return r2(cuotas + (enMora(l) ? recargoPendiente(l) : 0));
}

export function crearMora(l, pct, cuotas, desde) {
  const moraMonto = montoRecargo(l, pct);
  return {
    id: Date.now(), nombre: l.nombre, tel: l.tel, dir: l.dir, codigo: l.codigo,
    monto: l.monto, interes: l.interes, total: r2(l.total + moraMonto),
    moraTotal: r2((l.moraTotal || 0) + moraMonto), moraPct: pct, abonoPrevio: r2(abonoPrevio(l) + pagado(l)),
    modo: l.modo, cuotas, inicio: desde, dia: l.dia, excluidos: [...(l.excluidos || [])],
    pagos: [], recargos: (l.recargos || []).map((r) => ({ ...r })), encadenadoDe: l.id
  };
}

export function generarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo;
  do {
    codigo = Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  } while (estado.loans.some((l) => l.codigo === codigo));
  return codigo;
}

export function armarPrestamo(datos, monto, interes, plan) {
  return Object.assign({
    id: Date.now(), monto, interes, total: r2(monto * (1 + interes / 100)),
    pagos: [], recargos: [], codigo: generarCodigo()
  }, datos, plan);
}

export function resumenFinanciero(l) {
  return {
    total: l.total,
    recargos: sumaRecargos(l),
    pagado: r2(pagado(l) + abonoPrevio(l)),
    cuotasPagadas: calendario(l).filter((c) => c.falta === 0).length,
    cuotasTotales: l.cuotas,
    saldo: saldo(l)
  };
}

export function normalizarPrestamo(p) {
  const valido = p && typeof p.nombre === 'string' && p.id && p.total > 0 && p.cuotas >= 1 && p.inicio &&
    ['diario', 'semanal'].includes(p.modo) && Array.isArray(p.pagos);
  if (!valido) return null;
  return Object.assign({}, p, {
    nombre: formatoNombre(p.nombre),
    codigo: p.codigo ? String(p.codigo).toUpperCase() : generarCodigo(),
    recargos: Array.isArray(p.recargos) ? p.recargos : [],
    excluidos: Array.isArray(p.excluidos) ? p.excluidos : []
  });
}

export function textoComprobante(l) {
  const cal = cerrado(l) ? [] : calendario(l);
  const abierta = cal.find((c) => c.falta > 0);
  const { cubre } = distribuirPagos(l);
  const todos = pagosCadena(l);
  const lineas = [
    'COMPROBANTE DE ESTADO DE CUENTA',
    'Emitido: ' + fdate(hoy()),
    '',
    'Deudor: ' + l.nombre,
    'Préstamo: ' + money(l.monto) + ' + ' + l.interes + '% = ' + money(r2(l.total - (l.moraTotal || 0)))
  ];
  if (l.moraTotal) lineas.push('Mora: + ' + money(l.moraTotal) + ' (total ' + money(l.total) + ')');
  if (abonoPrevio(l)) lineas.push('Abonos previos conservados: ' + money(abonoPrevio(l)));
  lineas.push(
    'Plan: ' + (l.modo === 'diario' ? 'Diario' : 'Semanal') + ' × ' + l.cuotas + ' cuotas de ' + money(montoCuota(l, 0)) + ', desde ' + fdate(l.inicio),
    'Recargos por mora: ' + money(sumaRecargos(l)),
    'Pagado: ' + money(pagado(l) + abonoPrevio(l)),
    'Saldo pendiente: ' + money(saldo(l)),
    'Cuotas completas: ' + cal.filter((c) => c.falta === 0).length + ' de ' + l.cuotas
  );
  if (l.estado === 'refinanciado') lineas.push('Estado: refinanciado');
  else if (l.estado === 'encadenado') lineas.push('Estado: encadenado con mora');
  else if (abierta) lineas.push('Próximo cobro: ' + fdate(abierta.due) + ' · ' + money(abierta.falta));
  lineas.push('', 'PAGOS (' + todos.length + ')');
  todos.forEach((p) => lineas.push(fcorta(p.fecha) + '  ' + money(p.monto) + '  ' + (p.previo ? 'etapa anterior' : describirCobertura(cubre[p.id] || [])) + (p.nota ? ' · ' + p.nota : '')));
  if (!todos.length) lineas.push('Sin pagos registrados.');
  return lineas.join('\n');
}

export function claseEstado(etiqueta) {
  if (etiqueta === 'Pagada') return 'ok';
  if (etiqueta === 'Vencida (parcial)') return 'warn vencida';
  if (etiqueta.startsWith('Vencida')) return 'bad';
  if (etiqueta === 'Parcial') return 'warn';
  return 'pend';
}