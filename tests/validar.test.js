import test from 'node:test';
import assert from 'node:assert/strict';
import { validarPrestamos } from '../src/validar.js';

const base = (extra = {}) => ({
  id: 1, nombre: 'Ana', tel: '', dir: '', codigo: 'ABC123', monto: 150, interes: 20, total: 180,
  modo: 'diario', cuotas: 18, inicio: '2026-11-08', dia: '1', excluidos: [], pagos: [], recargos: [], ...extra
});

test('acepta un préstamo válido y descarta campos desconocidos', () => {
  const r = validarPrestamos([base({ admin: true })]);
  assert.equal(r.error, undefined);
  assert.equal('admin' in r.prestamos[0], false);
});

test('rechaza un total manipulado', () => {
  assert.match(validarPrestamos([base({ total: 10 })]).error, /total/);
});

test('rechaza pagos que superan el total', () => {
  const pagos = [{ id: 5, fecha: '2026-11-09', monto: 500, nota: '' }];
  assert.match(validarPrestamos([base({ pagos })]).error, /superan/);
});

test('rechaza fechas inexistentes y valores fuera de rango', () => {
  assert.ok(validarPrestamos([base({ inicio: '2026-02-31' })]).error);
  assert.ok(validarPrestamos([base({ cuotas: 0 })]).error);
  assert.ok(validarPrestamos([base({ codigo: 'ab' })]).error);
});

test('rechaza identificadores duplicados y códigos compartidos entre deudores', () => {
  assert.match(validarPrestamos([base(), base()]).error, /duplicado/);
  assert.match(validarPrestamos([base(), base({ id: 2, nombre: 'Luis' })]).error, /código/);
  assert.equal(validarPrestamos([base(), base({ id: 2 })]).error, undefined);
});

const previa = (extra = {}) => base({ id: 1, monto: 100, total: 120, estado: 'encadenado', encadenadoEn: 2, pagos: [{ id: 9, fecha: '2026-11-09', monto: 50, nota: '' }], ...extra });
const mora = (extra = {}) => base({ id: 2, monto: 100, total: 140, moraTotal: 20, moraPct: 20, abonoPrevio: 50, encadenadoDe: 1, ...extra });

test('acepta una tarjeta encadenada por mora con abonos conservados', () => {
  const r = validarPrestamos([previa(), mora()]);
  assert.equal(r.error, undefined);
  assert.equal(r.prestamos[1].moraTotal, 20);
  assert.equal(r.prestamos[1].abonoPrevio, 50);
  assert.equal(r.prestamos[0].estado, 'encadenado');
});

test('rechaza una mora que no cuadra con el total', () => {
  assert.match(validarPrestamos([previa(), mora({ total: 130 })]).error, /total/);
});

test('rechaza abonos previos y pagos que superan el total encadenado', () => {
  const pagos = [{ id: 10, fecha: '2026-11-10', monto: 100, nota: '' }];
  assert.match(validarPrestamos([previa(), mora({ pagos })]).error, /superan/);
});

test('rechaza estados y vínculos de cadena inválidos', () => {
  assert.ok(validarPrestamos([base({ estado: 'otro' })]).error);
  assert.ok(validarPrestamos([base({ encadenadoDe: 'x' })]).error);
});