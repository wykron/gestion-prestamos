import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const ORIGEN = 'https://cobros.test';

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

const llamar = (env, ruta, { metodo = 'GET', cuerpo, cookie, ip = '1.1.1.1', origen = ORIGEN, tipo = 'application/json', autorizacion } = {}) => {
  const cabeceras = { 'CF-Connecting-IP': ip };
  if (tipo) cabeceras['Content-Type'] = tipo;
  if (origen) cabeceras.Origin = origen;
  if (cookie) cabeceras.Cookie = cookie;
  if (autorizacion) cabeceras.Authorization = autorizacion;
  return worker.fetch(new Request(ORIGEN + ruta, { method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env);
};

const prestamo = (id, nombre, codigo) => ({
  id, nombre, tel: '', dir: '', codigo, monto: 100, interes: 20, total: 120, modo: 'diario', cuotas: 30,
  inicio: '2026-11-08', dia: '1', excluidos: [], pagos: [], recargos: []
});

async function entrar(env, cuerpo, ip) {
  const respuesta = await llamar(env, '/api/login', { metodo: 'POST', cuerpo, ip });
  const marca = respuesta.headers.get('set-cookie');
  return { respuesta, json: await respuesta.json(), marca, cookie: marca ? marca.split(';')[0] : '' };
}

test('exige autenticación y separa los roles', async () => {
  const env = entorno();
  assert.equal((await llamar(env, '/api/datos')).status, 401);
  const admin = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const guardado = await llamar(env, '/api/datos', { metodo: 'PUT', cookie: admin.cookie, cuerpo: { version: 0, prestamos: [prestamo(1, 'Ana', 'AAA111'), prestamo(2, 'Luis', 'BBB222')] } });
  assert.equal(guardado.status, 200);

  const deudor = await entrar(env, { tipo: 'deudor', codigo: 'aaa111' });
  assert.equal(deudor.json.rol, 'deudor');
  const cuenta = await (await llamar(env, '/api/cuenta', { cookie: deudor.cookie })).json();
  assert.deepEqual(cuenta.prestamos.map((p) => p.nombre), ['Ana']);
  assert.equal((await llamar(env, '/api/datos', { cookie: deudor.cookie })).status, 403);
  assert.equal((await llamar(env, '/api/datos', { metodo: 'PUT', cookie: deudor.cookie, cuerpo: { version: 1, prestamos: [] } })).status, 403);
  assert.equal((await llamar(env, '/api/cuenta', { cookie: admin.cookie })).status, 403);
});

test('la sesión viaja en una cookie HttpOnly y nunca en el cuerpo de la respuesta', async () => {
  const env = entorno();
  const admin = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  assert.equal(admin.respuesta.status, 200);
  assert.deepEqual(Object.keys(admin.json).sort(), ['exp', 'rol']);
  assert.match(admin.marca, /^__Host-sesion=/);
  for (const atributo of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=43200']) assert.ok(admin.marca.includes(atributo), atributo);
  assert.equal(admin.marca.includes('Domain'), false);
  const token = admin.cookie.split('=')[1];
  assert.equal((await llamar(env, '/api/datos', { autorizacion: 'Bearer ' + token })).status, 401);
  assert.equal((await llamar(env, '/api/datos', { cookie: '__Host-sesion=' + token.slice(0, -3) + 'abc' })).status, 401);
});

test('mantener la sesión amplía solo la del prestamista a 30 días', async () => {
  const env = entorno();
  await entrar(env, { tipo: 'admin', clave: 'clave-segura' }).then(async (a) => {
    await llamar(env, '/api/datos', { metodo: 'PUT', cookie: a.cookie, cuerpo: { version: 0, prestamos: [prestamo(1, 'Ana', 'AAA111')] } });
  });
  const larga = await entrar(env, { tipo: 'admin', clave: 'clave-segura', recordar: true });
  assert.ok(larga.marca.includes('Max-Age=2592000'));
  const deudor = await entrar(env, { tipo: 'deudor', codigo: 'AAA111', recordar: true });
  assert.ok(deudor.marca.includes('Max-Age=28800'));
});

test('consulta y cierra la sesión', async () => {
  const env = entorno();
  const admin = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const actual = await (await llamar(env, '/api/sesion', { cookie: admin.cookie })).json();
  assert.equal(actual.rol, 'admin');
  assert.equal((await llamar(env, '/api/sesion')).status, 401);
  const cierre = await llamar(env, '/api/salir', { metodo: 'POST', cuerpo: {} });
  assert.match(cierre.headers.get('set-cookie'), /^__Host-sesion=;.*Max-Age=0/);
});

test('rechaza escrituras sin origen propio o sin JSON', async () => {
  const env = entorno();
  const { cookie } = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const enviar = (opciones) => llamar(env, '/api/datos', { metodo: 'PUT', cookie, cuerpo: { version: 0, prestamos: [] }, ...opciones });
  assert.equal((await enviar({ origen: null })).status, 403);
  assert.equal((await enviar({ origen: 'https://otro.test' })).status, 403);
  assert.equal((await enviar({ tipo: 'text/plain' })).status, 403);
  assert.equal((await enviar({})).status, 200);
  assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'admin', clave: 'clave-segura' }, origen: null })).status, 403);
});

test('rechaza credenciales inválidas y limita los intentos', async () => {
  const env = entorno();
  for (let i = 0; i < 8; i++) assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'admin', clave: 'mal' }, ip: '9.9.9.9' })).status, 401);
  assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'admin', clave: 'clave-segura' }, ip: '9.9.9.9' })).status, 429);
  assert.equal((await llamar(env, '/api/login', { metodo: 'POST', cuerpo: { tipo: 'deudor', codigo: 'ZZZ999' }, ip: '8.8.8.8' })).status, 401);
});

test('detecta versiones desactualizadas y datos manipulados', async () => {
  const env = entorno();
  const { cookie } = await entrar(env, { tipo: 'admin', clave: 'clave-segura' });
  const enviar = (cuerpo) => llamar(env, '/api/datos', { metodo: 'PUT', cookie, cuerpo });
  assert.equal((await enviar({ version: 0, prestamos: [prestamo(1, 'Ana', 'AAA111')] })).status, 200);
  assert.equal((await enviar({ version: 0, prestamos: [] })).status, 409);
  assert.equal((await enviar({ version: 1, prestamos: [{ ...prestamo(1, 'Ana', 'AAA111'), total: 1 }] })).status, 400);
  const actual = await (await llamar(env, '/api/datos', { cookie })).json();
  assert.equal(actual.version, 1);
  assert.equal(actual.prestamos.length, 1);
});

test('sirve los archivos estáticos fuera de /api y exige configuración', async () => {
  const env = entorno();
  assert.equal(await (await llamar(env, '/')).text(), 'estatico');
  assert.equal((await llamar({ ...env, ADMIN_PASSWORD: '' }, '/api/login', { metodo: 'POST', cuerpo: {} })).status, 500);
  const salud = await llamar(env, '/api/salud');
  assert.equal(salud.headers.get('cache-control'), 'no-store');
  assert.equal(salud.headers.get('cross-origin-resource-policy'), 'same-origin');
});