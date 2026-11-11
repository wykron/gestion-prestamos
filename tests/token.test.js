import test from 'node:test';
import assert from 'node:assert/strict';
import { firmar, verificar, igualesSeguro } from '../src/token.js';

const secreto = 'x'.repeat(32);
const futuro = () => Math.floor(Date.now() / 1000) + 60;

test('verifica un token firmado', async () => {
  const token = await firmar({ rol: 'admin', exp: futuro() }, secreto);
  assert.equal((await verificar(token, secreto)).rol, 'admin');
});

test('rechaza tokens alterados, expirados o firmados con otro secreto', async () => {
  const token = await firmar({ rol: 'deudor', codigo: 'ABC123', exp: futuro() }, secreto);
  const [cuerpo, firma] = token.split('.');
  const alterado = Buffer.from(JSON.stringify({ rol: 'admin', exp: futuro() })).toString('base64url') + '.' + firma;
  assert.equal(await verificar(alterado, secreto), null);
  assert.equal(await verificar(token, 'y'.repeat(32)), null);
  assert.equal(await verificar(await firmar({ rol: 'admin', exp: 1 }, secreto), secreto), null);
  assert.equal(await verificar('basura', secreto), null);
  assert.ok(cuerpo);
});

test('compara claves sin filtrar diferencias', async () => {
  assert.equal(await igualesSeguro('clave', 'clave'), true);
  assert.equal(await igualesSeguro('clave', 'clavE'), false);
});
