import test from 'node:test';
import assert from 'node:assert/strict';
import { cifrarCon, descifrarCon, generarLlave, normalizarCodigo, recordarCredencial, sesionDesdeRespuesta, validarEntrada } from '../public/js/credenciales.js';

const futuro = () => Math.floor(Date.now() / 1000) + 600;

test('valida la clave y el código antes de llamar al servidor', () => {
  assert.equal(validarEntrada('admin', 'clave-segura'), '');
  assert.ok(validarEntrada('admin', ''));
  assert.ok(validarEntrada('admin', 'x'.repeat(201)));
  assert.equal(validarEntrada('deudor', ' abc123 '), '');
  assert.ok(validarEntrada('deudor', 'ab'));
  assert.ok(validarEntrada('deudor', 'ab cd!'));
  assert.equal(normalizarCodigo(' abc123 '), 'ABC123');
});

test('construye una sesión inmutable desde la respuesta y rechaza datos inválidos', () => {
  const admin = sesionDesdeRespuesta({ rol: 'admin', exp: futuro(), token: 'no-debe-copiarse' });
  assert.deepEqual(Object.keys(admin).sort(), ['exp', 'rol']);
  assert.equal(Object.isFrozen(admin), true);
  assert.equal(sesionDesdeRespuesta({ rol: 'deudor', exp: futuro(), codigo: 'ABC123' }).codigo, 'ABC123');
  assert.equal(sesionDesdeRespuesta({ rol: 'deudor', exp: futuro(), codigo: 'a b' }), null);
  assert.equal(sesionDesdeRespuesta({ rol: 'root', exp: futuro() }), null);
  assert.equal(sesionDesdeRespuesta({ rol: 'admin', exp: 1 }), null);
  assert.equal(sesionDesdeRespuesta({ rol: 'admin' }), null);
  assert.equal(sesionDesdeRespuesta(null), null);
});

test('la clave del prestamista nunca se guarda en el navegador', async () => {
  assert.equal(await recordarCredencial('admin', 'clave-segura'), false);
});

test('cifra con AES-GCM y detecta datos, contexto o llave alterados', async () => {
  const llave = await generarLlave();
  const registro = await cifrarCon(llave, 'ABC123', 'deudor|1');
  assert.equal(JSON.stringify(registro).includes('ABC123'), false);
  assert.equal(await descifrarCon(llave, registro, 'deudor|1'), 'ABC123');
  await assert.rejects(descifrarCon(llave, registro, 'admin|1'));
  await assert.rejects(descifrarCon(llave, registro, 'deudor|2'));
  await assert.rejects(descifrarCon(await generarLlave(), registro, 'deudor|1'));
});