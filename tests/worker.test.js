import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const memoria = () => {
  const datos = new Map();
  return {
    async get(clave, tipo) {
      if (!datos.has(clave)) return null;
      return tipo === 'json' ? JSON.parse(datos.get(clave)) : datos.get(clave);
    },
    async put(clave, valor) {
      datos.set(clave, String(valor));
    }
  };
};

const entorno = () => ({ COBROS: memoria(), ADMIN_PASSWORD: 'clave-segura', SESSION_SECRET: 's'.repeat(40), ASSETS: { fetch: async () => new Response('estatico') } });
const llamar = (env, ruta, { metodo = 'GET', cuerpo, token, ip = '1.1.1.1' } = {}) => worker.fetch(new Request('https://cobros.test' + ruta, {
  method: metodo,
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: cuerpo ? JSON.stringify(cuerpo) : undefined
}), env);

const prestamo = (id, nombre, codigo) => ({
  id, nombre, tel: '', dir: '', codigo, monto: 100, interes: 20, total: 120, modo: 'diario', cuotas: 30,
  inicio: '2026-11-08', dia: '1', excluidos: [], pagos: [], recargos: []
});

const entrar = async (env, cuerpo, ip) => (await llamar(env, '/api/login', { metodo: 'POST', cuerpo, ip })).json();

test('exige autenticación y separa los roles', async () => {
  const env = entorno();
  assert.equal((await llamar(env, '/api/datos')).status, 401);
  const admin = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const guardado = await llamar(env, '/api/datos', { metodo: 'PUT', token: admin.token, cuerpo: { version: 0, prestamos: [prestamo(1, 'Ana', 'AAA111'), prestamo(2, 'Luis', 'BBB222')] } });
  assert.equal(guardado.status, 200);

  const deudor = await entrar(env, { tipo: 'deudor', codigo: 'aaa111' });
  assert.equal(deudor.rol, 'deudor');
  const cuenta = await (await llamar(env, '/api/cuenta', { token: deudor.token })).json();
  assert.deepEqual(cuenta.prestamos.map((p) => p.nombre), ['Ana']);
  assert.equal((await llamar(env, '/api/datos', { token: deudor.token })).status, 403);
  assert.equal((await llamar(env, '/api/datos', { metodo: 'PUT', token: deudor.token, cuerpo: { version: 1, prestamos: [] } })).status, 403);
  assert.equal((await llamar(env, '/api/cuenta', { token: admin.token })).status, 403);
});

test('rechaza credenciales inválidas y limita los intentos', async () => {
  const env = entorno();
  for (let i = 0; i < 8; i++) assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'admin', clave: 'mal' }, ip: '9.9.9.9' })).status, 401);
  assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'admin', clave: 'clave-segura' }, ip: '9.9.9.9' })).status, 429);
  assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'deudor', codigo: 'ZZZ999' }, ip: '8.8.8.8' })).status, 401);
});

test('detecta versiones desactualizadas y datos manipulados', async () => {
  const env = entorno();
  const { token } = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const enviar = (cuerpo) => llamar(env, '/api/datos', { metodo: 'PUT', token, cuerpo });
  assert.equal((await enviar({ version: 0, prestamos: [prestamo(1, 'Ana', 'AAA111')] })).status, 200);
  assert.equal((await enviar({ version: 0, prestamos: [] })).status, 409);
  assert.equal((await enviar({ version: 1, prestamos: [{ ...prestamo(1, 'Ana', 'AAA111'), total: 1 }] })).status, 400);
  const actual = await (await llamar(env, '/api/datos', { token })).json();
  assert.equal(actual.version, 1);
  assert.equal(actual.prestamos.length, 1);
});

test('sirve los archivos estáticos fuera de /api y exige configuración', async () => {
  const env = entorno();
  assert.equal(await (await llamar(env, '/')).text(), 'estatico');
  assert.equal((await llamar({ ...env, ADMIN_PASSWORD: '' }, '/api/login', { metodo: 'POST', cuerpo: {} })).status, 500);
});
