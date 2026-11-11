import test from 'node:test';
import assert from 'node:assert/strict';
import { firmar } from '../src/token.js';
import { cifrarCon, descifrarCon, generarLlave, leerToken, normalizarCodigo, sesionDesdeToken, validarEntrada } from '../public/js/credenciales.js';

const secreto = 's'.repeat(40);
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

test('construye la sesión desde el token y rechaza roles, códigos o caducidades inválidos', async () => {
  const admin = await firmar({ rol: 'admin', exp: futuro() }, secreto);
  assert.deepEqual(sesionDesdeToken(admin), { token: admin, rol: 'admin', exp: sesionDesdeToken(admin).exp });
  const deudor = await firmar({ rol: 'deudor', codigo: 'ABC123', exp: futuro() }, secreto);
  assert.equal(sesionDesdeToken(deudor).codigo, 'ABC123');
  assert.equal(sesionDesdeToken(await firmar({ rol: 'deudor', codigo: 'a b', exp: futuro() }, secreto)), null);
  assert.equal(sesionDesdeToken(await firmar({ rol: 'root', exp: futuro() }, secreto)), null);
  assert.equal(sesionDesdeToken(await firmar({ rol: 'admin', exp: 1 }, secreto)), null);
  assert.equal(sesionDesdeToken('basura'), null);
  assert.equal(sesionDesdeToken(null), null);
  assert.equal(leerToken(undefined), null);
});

test('cifra con AES-GCM y detecta datos, contexto o llave alterados', async () => {
  const llave = await generarLlave();
  const registro = await cifrarCon(llave, 'clave-segura', 'admin|1');
  assert.equal(JSON.stringify(registro).includes('clave-segura'), false);
  assert.equal(await descifrarCon(llave, registro, 'admin|1'), 'clave-segura');
  await assert.rejects(descifrarCon(llave, registro, 'deudor|1'));
  await assert.rejects(descifrarCon(llave, registro, 'admin|2'));
  await assert.rejects(descifrarCon(await generarLlave(), registro, 'admin|1'));
});