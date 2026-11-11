const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CODIGO = /^[A-Z0-9]{4,12}$/;

const redondear = (n) => Math.round(n * 100) / 100;
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const texto = (v, max) => typeof v === 'string' && v.length <= max;
const identificador = (v) => Number.isSafeInteger(v) && v > 0;
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fallo = (error) => ({ error });

function fechaValida(v) {
  if (typeof v !== 'string' || !FECHA.test(v)) return false;
  const fecha = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v;
}

function validarPago(p) {
  if (!objeto(p) || !identificador(p.id) || !fechaValida(p.fecha) || !numero(p.monto, 0.01, 1e7)) return null;
  const nota = p.nota ?? '';
  if (!texto(nota, 120)) return null;
  const pago = { id: p.id, fecha: p.fecha, monto: redondear(p.monto), nota };
  if (p.cuota !== undefined) {
    if (!entero(p.cuota, 1, 365)) return null;
    pago.cuota = p.cuota;
  }
  return pago;
}

function validarRecargo(r) {
  if (!objeto(r) || !identificador(r.id) || !fechaValida(r.fecha) || !numero(r.pct, 0, 1000) || !numero(r.monto, 0, 1e7)) return null;
  const recargo = { id: r.id, fecha: r.fecha, pct: r.pct, monto: redondear(r.monto) };
  if (r.desde !== undefined) {
    if (!fechaValida(r.desde)) return null;
    recargo.desde = r.desde;
  }
  return recargo;
}

function lista(valores, maximo, validar) {
  if (!Array.isArray(valores) || valores.length > maximo) return null;
  const salida = valores.map(validar);
  return salida.every(Boolean) ? salida : null;
}

function validarPrestamo(p) {
  if (!objeto(p)) return fallo('formato inválido');
  if (!identificador(p.id)) return fallo('identificador inválido');
  if (!texto(p.nombre, 80) || !p.nombre.trim()) return fallo('nombre inválido');
  if (!texto(p.tel ?? '', 40) || !texto(p.dir ?? '', 120)) return fallo('contacto inválido');
  if (typeof p.codigo !== 'string' || !CODIGO.test(p.codigo)) return fallo('código inválido');
  if (!numero(p.monto, 0.01, 1e7) || !numero(p.interes, 0, 1000)) return fallo('monto o interés inválido');
  const moraTotal = p.moraTotal ?? 0;
  if (!numero(moraTotal, 0, 1e7)) return fallo('mora inválida');
  if (!numero(p.total, 0.01, 2e7) || Math.abs(p.total - redondear(p.monto * (1 + p.interes / 100) + moraTotal)) > 0.01) return fallo('total inconsistente');
  const abonoPrevio = p.abonoPrevio ?? 0;
  if (!numero(abonoPrevio, 0, 2e7) || abonoPrevio > p.total + 0.01) return fallo('abonos previos inválidos');
  if (!['diario', 'semanal'].includes(p.modo)) return fallo('modalidad inválida');
  if (!entero(p.cuotas, 1, 365)) return fallo('cuotas inválidas');
  if (!fechaValida(p.inicio)) return fallo('fecha de inicio inválida');
  if (!/^[0-6]$/.test(String(p.dia ?? '1'))) return fallo('día de cobro inválido');
  if (!Array.isArray(p.excluidos) || p.excluidos.length > 6 || !p.excluidos.every((d) => entero(d, 0, 6))) return fallo('días excluidos inválidos');
  const pagos = lista(p.pagos, 2000, validarPago);
  const recargos = lista(p.recargos ?? [], 100, validarRecargo);
  if (!pagos) return fallo('pagos inválidos');
  if (!recargos) return fallo('recargos inválidos');
  const suma = (items) => items.reduce((a, x) => a + x.monto, 0);
  if (abonoPrevio + suma(pagos) > p.total + suma(recargos) + 0.01) return fallo('los pagos superan el total');
  const valor = {
    id: p.id, nombre: p.nombre.trim(), tel: p.tel ?? '', dir: p.dir ?? '', codigo: p.codigo,
    monto: p.monto, interes: p.interes, total: p.total, modo: p.modo, cuotas: p.cuotas, inicio: p.inicio,
    dia: String(p.dia ?? '1'), excluidos: [...p.excluidos], pagos, recargos
  };
  if (moraTotal) {
    valor.moraTotal = moraTotal;
    if (p.moraPct !== undefined) {
      if (!numero(p.moraPct, 0, 1000)) return fallo('porcentaje de mora inválido');
      valor.moraPct = p.moraPct;
    }
  }
  if (abonoPrevio) valor.abonoPrevio = abonoPrevio;
  if (p.arrastre !== undefined) {
    if (!numero(p.arrastre, 0, 1e7) || p.arrastre > p.monto + 0.01) return fallo('saldo arrastrado inválido');
    valor.arrastre = p.arrastre;
  }
  if (p.saldoTrasladado !== undefined) {
    if (!numero(p.saldoTrasladado, 0, 2e7)) return fallo('saldo trasladado inválido');
    valor.saldoTrasladado = p.saldoTrasladado;
  }
  for (const campo of ['origen', 'refinanciadoEn', 'encadenadoDe', 'encadenadoEn']) {
    if (p[campo] === undefined) continue;
    if (!identificador(p[campo])) return fallo(campo + ' inválido');
    valor[campo] = p[campo];
  }
  if (p.estado !== undefined) {
    if (!['refinanciado', 'encadenado'].includes(p.estado)) return fallo('estado inválido');
    valor.estado = p.estado;
  }
  return { valor };
}

export function validarPrestamos(entrada) {
  if (!Array.isArray(entrada) || entrada.length > 2000) return fallo('Lista de préstamos inválida');
  const ids = new Set();
  const codigos = new Map();
  const prestamos = [];
  for (const [i, bruto] of entrada.entries()) {
    const { error, valor } = validarPrestamo(bruto);
    const etiqueta = 'Préstamo ' + (i + 1) + ': ';
    if (error) return fallo(etiqueta + error);
    if (ids.has(valor.id)) return fallo(etiqueta + 'identificador duplicado');
    if (codigos.has(valor.codigo) && codigos.get(valor.codigo) !== valor.nombre) return fallo(etiqueta + 'código compartido por deudores distintos');
    ids.add(valor.id);
    codigos.set(valor.codigo, valor.nombre);
    prestamos.push(valor);
  }
  return { prestamos };
}