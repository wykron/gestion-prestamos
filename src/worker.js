import { firmar, verificar, igualesSeguro } from './token.js';
import { validarPrestamos } from './validar.js';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin'
};
const DURACION = { admin: 12 * 3600, deudor: 8 * 3600 };
const DURACION_RECORDADA = 30 * 24 * 3600;
const MAX_INTENTOS = 8;
const VENTANA_SEGUNDOS = 900;
const MAX_CUERPO = 2_000_000;
const RETENCION_COPIAS = 30 * 24 * 3600;
const CODIGO = /^[A-Z0-9]{4,12}$/;

const responder = (cuerpo, status = 200, extra = {}) => new Response(JSON.stringify(cuerpo), { status, headers: { ...CABECERAS, ...extra } });

const esSeguro = (url) => url.protocol === 'https:';
const nombreCookie = (url) => (esSeguro(url) ? '__Host-sesion' : 'sesion');
const crearCookie = (url, valor, segundos) => nombreCookie(url) + '=' + valor + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + segundos + (esSeguro(url) ? '; Secure' : '');

function leerCookie(request, nombre) {
  const par = (request.headers.get('Cookie') || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(nombre + '='));
  return par ? par.slice(nombre.length + 1) : '';
}

const leerDatos = async (env) => (await env.COBROS.get('datos', 'json')) || { version: 0, prestamos: [] };

async function leerJSON(request) {
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return null;
  try {
    return JSON.parse(texto);
  } catch (e) {
    return null;
  }
}

function peticionValida(request, url) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  return request.headers.get('Origin') === url.origin && (request.headers.get('Content-Type') || '').startsWith('application/json');
}

const autenticar = (request, env, url) => verificar(leerCookie(request, nombreCookie(url)), env.SESSION_SECRET);

async function credenciales(cuerpo, env) {
  if (cuerpo.tipo === 'admin') {
    const valida = typeof cuerpo.clave === 'string' && cuerpo.clave.length <= 200 && (await igualesSeguro(cuerpo.clave, env.ADMIN_PASSWORD));
    return valida ? { rol: 'admin' } : null;
  }
  if (cuerpo.tipo === 'deudor' && typeof cuerpo.codigo === 'string') {
    const codigo = cuerpo.codigo.trim().toUpperCase();
    if (!CODIGO.test(codigo)) return null;
    const { prestamos } = await leerDatos(env);
    return prestamos.some((p) => p.codigo === codigo) ? { rol: 'deudor', codigo } : null;
  }
  return null;
}

async function login(request, env, url) {
  const clave = 'rl:' + (request.headers.get('CF-Connecting-IP') || 'local');
  const intentos = Number(await env.COBROS.get(clave)) || 0;
  if (intentos >= MAX_INTENTOS) return responder({ error: 'Demasiados intentos. Intenta más tarde.' }, 429);
  const cuerpo = await leerJSON(request);
  const sesion = cuerpo ? await credenciales(cuerpo, env) : null;
  if (!sesion) {
    await env.COBROS.put(clave, String(intentos + 1), { expirationTtl: VENTANA_SEGUNDOS });
    return responder({ error: 'Credenciales inválidas' }, 401);
  }
  const duracion = sesion.rol === 'admin' && cuerpo.recordar === true ? DURACION_RECORDADA : DURACION[sesion.rol];
  const exp = Math.floor(Date.now() / 1000) + duracion;
  const token = await firmar({ ...sesion, exp }, env.SESSION_SECRET);
  return responder({ ...sesion, exp }, 200, { 'Set-Cookie': crearCookie(url, token, duracion) });
}

async function guardarDatos(request, env) {
  const cuerpo = await leerJSON(request);
  if (!cuerpo || !Number.isInteger(cuerpo.version)) return responder({ error: 'Solicitud inválida' }, 400);
  const actual = await leerDatos(env);
  if (cuerpo.version !== actual.version) return responder({ error: 'Versión desactualizada', version: actual.version }, 409);
  const { prestamos, error } = validarPrestamos(cuerpo.prestamos);
  if (error) return responder({ error }, 400);
  const copia = 'backup:' + new Date().toISOString().slice(0, 10);
  if (!(await env.COBROS.get(copia))) await env.COBROS.put(copia, JSON.stringify(actual), { expirationTtl: RETENCION_COPIAS });
  const nuevo = { version: actual.version + 1, prestamos, actualizado: new Date().toISOString() };
  await env.COBROS.put('datos', JSON.stringify(nuevo));
  return responder({ version: nuevo.version });
}

const noPermitido = () => responder({ error: 'Método no permitido' }, 405);

async function enrutar(request, env, url) {
  const ruta = url.pathname;
  const metodo = request.method;
  if (ruta === '/api/salud') return responder({ ok: true });
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return responder({ error: 'Servidor sin configurar' }, 500);
  if (!peticionValida(request, url)) return responder({ error: 'Origen no permitido' }, 403);
  if (ruta === '/api/login') return metodo === 'POST' ? login(request, env, url) : noPermitido();
  if (ruta === '/api/salir') return metodo === 'POST' ? responder({ ok: true }, 200, { 'Set-Cookie': crearCookie(url, '', 0) }) : noPermitido();
  const sesion = await autenticar(request, env, url);
  if (!sesion) return responder({ error: 'No autorizado' }, 401);
  if (ruta === '/api/sesion') {
    if (metodo !== 'GET') return noPermitido();
    return responder({ rol: sesion.rol, exp: sesion.exp, ...(sesion.codigo ? { codigo: sesion.codigo } : {}) });
  }
  if (ruta === '/api/datos') {
    if (sesion.rol !== 'admin') return responder({ error: 'Prohibido' }, 403);
    if (metodo === 'GET') {
      const { version, prestamos } = await leerDatos(env);
      return responder({ version, prestamos });
    }
    return metodo === 'PUT' ? guardarDatos(request, env) : noPermitido();
  }
  if (ruta === '/api/cuenta') {
    if (sesion.rol !== 'deudor') return responder({ error: 'Prohibido' }, 403);
    if (metodo !== 'GET') return noPermitido();
    const { prestamos } = await leerDatos(env);
    return responder({ prestamos: prestamos.filter((p) => p.codigo === sesion.codigo) });
  }
  return responder({ error: 'No encontrado' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await enrutar(request, env, url);
    } catch (e) {
      return responder({ error: 'Error interno' }, 500);
    }
  }
};