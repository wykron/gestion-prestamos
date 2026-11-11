import test from 'node:test';
import assert from 'node:assert/strict';
import { fechas, distribuirPagos, montoRecargo, saldo, calendario, crearMora, cadena, cerrado, deuda, etapaPrevia, pagosCadena } from '../public/js/finanzas.js';
import { estado } from '../public/js/estado.js';

const prestamo = (extra = {}) => ({
  id: 1, nombre: 'Ana', codigo: 'ABC123', monto: 150, interes: 20, total: 180, modo: 'diario', cuotas: 18,
  inicio: '2026-11-08', dia: '1', excluidos: [], pagos: [], recargos: [], ...extra
});

test('la primera cuota diaria cae en la fecha de inicio', () => {
  assert.equal(fechas(prestamo())[0], '2026-11-08');
});

test('omite los días excluidos', () => {
  const f = fechas(prestamo({ excluidos: [0] }));
  assert.equal(f[0], '2026-11-09');
  assert.equal(f.length, 18);
});

test('un pago doble cubre el día del pago y el anterior', () => {
  const l = prestamo({ pagos: [{ id: 7, fecha: '2026-11-20', monto: 20, nota: '' }] });
  assert.deepEqual(distribuirPagos(l).cubre[7], [12, 13]);
});

test('un pago dirigido se asigna primero a su cuota', () => {
  const l = prestamo({ pagos: [{ id: 8, fecha: '2026-11-20', monto: 10, nota: '', cuota: 3 }] });
  assert.deepEqual(distribuirPagos(l).cubre[8], [3]);
  assert.equal(calendario(l)[2].estado, 'Pagada');
});

test('el recargo se calcula sobre el monto base y el saldo se actualiza', () => {
  const l = prestamo({ recargos: [{ id: 2, fecha: '2026-11-01', desde: '2026-11-01', pct: 20, monto: montoRecargo(prestamo(), 20) }] });
  assert.equal(montoRecargo(prestamo(), 20), 30);
  assert.equal(saldo(l), 210);
});

const vencido = () => prestamo({ id: 1, monto: 100, total: 120, pagos: [{ id: 5, fecha: '2026-11-09', monto: 50, nota: '' }] });

test('la mora crea una tarjeta encadenada: 100 + 20% = 120 y con mora del 20% sobre el capital, 140', () => {
  const nueva = crearMora(vencido(), 20, 10, '2026-12-01');
  assert.equal(nueva.total, 140);
  assert.equal(nueva.moraTotal, 20);
  assert.equal(nueva.abonoPrevio, 50);
  assert.equal(nueva.encadenadoDe, 1);
  assert.equal(nueva.inicio, '2026-12-01');
  assert.equal(saldo(nueva), 90);
  assert.equal(fechas(nueva)[0], '2026-12-01');
});

test('el cronograma de la mora reparte solo el saldo pendiente', () => {
  const nueva = crearMora(vencido(), 20, 10, '2026-12-01');
  assert.equal(deuda(nueva), 90);
  assert.equal(Math.round(calendario(nueva).reduce((a, c) => a + c.monto, 0) * 100) / 100, 90);
});

test('la etapa anterior queda cerrada y la cadena conserva sus abonos', () => {
  const l = vencido();
  const nueva = crearMora(l, 20, 10, '2026-12-01');
  l.estado = 'encadenado';
  l.encadenadoEn = nueva.id;
  estado.loans = [l, nueva];
  assert.deepEqual(cadena(nueva).map((e) => e.id), [l.id, nueva.id]);
  assert.equal(saldo(l), 0);
  assert.equal(cerrado(l), true);
  assert.equal(etapaPrevia(l), true);
  assert.equal(pagosCadena(nueva).length, 1);
  assert.equal(pagosCadena(nueva)[0].previo, true);
  estado.loans = [];
});

test('una segunda mora vuelve a sumar el porcentaje sobre el capital original', () => {
  const primera = crearMora(vencido(), 20, 10, '2026-12-01');
  const segunda = crearMora(primera, 20, 5, '2027-01-01');
  assert.equal(segunda.total, 160);
  assert.equal(segunda.moraTotal, 40);
  assert.equal(segunda.abonoPrevio, 50);
});