import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estado } from '../public/js/estado.js';
import { vistaClientes } from '../public/js/vistas.js';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

const prestamo = (id, nombre, codigo) => ({
  id, nombre, tel: '', dir: '', codigo, monto: 100, interes: 20, total: 120, modo: 'diario', cuotas: 30,
  inicio: '2026-11-08', dia: '1', excluidos: [], pagos: [], recargos: []
});

test('las tarjetas individuales forman una sola cuadrícula continua y los grupos fluyen debajo', () => {
  estado.loans = [prestamo(1, 'Ana', 'AAA111'), prestamo(2, 'Ana', 'AAA111'), prestamo(3, 'Luis', 'BBB222'), prestamo(4, 'Eva', 'CCC333'), prestamo(5, 'Leo', 'DDD444')];
  const html = vistaClientes();
  const inicioGrupos = html.indexOf('<div class="grupos">');
  const cuadricula = html.slice(html.indexOf('<div class="tarjetas">'), inicioGrupos);
  assert.equal((cuadricula.match(/class="prestamo-card/g) || []).length, 3);
  assert.equal(cuadricula.includes('class="grupo'), false);
  assert.ok(inicioGrupos > html.indexOf('<div class="tarjetas">'));
  assert.equal((html.match(/<section class="grupo/g) || []).length, 1);
  estado.loans = [];
});

test('no deja contenedores vacíos cuando solo hay un tipo de tarjeta', () => {
  estado.loans = [prestamo(1, 'Ana', 'AAA111'), prestamo(2, 'Luis', 'BBB222')];
  assert.equal(vistaClientes().includes('class="grupos"'), false);
  estado.loans = [prestamo(1, 'Ana', 'AAA111'), prestamo(2, 'Ana', 'AAA111')];
  assert.equal(vistaClientes().includes('class="tarjetas"'), false);
  estado.loans = [];
});

test('el CSS no obliga a los grupos a ocupar filas dentro de la cuadrícula', () => {
  assert.match(css, /\.tarjetas \{[^}]*repeat\(auto-fill, minmax\(min\(100%, 190px\), 1fr\)\)/);
  assert.equal(/\.grupo \{[^}]*grid-column/.test(css), false);
});