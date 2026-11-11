import { firmar, verificar, igualesSeguro } from './token.js';
import { validarPrestamos } from './validar.js';

const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const DURACION = { admin: 12 * 3600, deudor: 8 * 3600 };
const MAX_INTENTOS = 8;
const VENTANA_SEGUNDOS = 900;
const MAX_CUERPO = 2_000_000;
const RETENCION_COPIAS = 30 * 24 * 3600;
const CODIGO = /^[A-Z0-9]{4,12}$/;

const responder = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: CABECERAS });

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

function autenticar(request, env) {
  const cabecera = request.headers.get('Authorization') || '';
  return cabecera.startsWith('Bearer ') ? verificar(cabecera.slice(7), env.SESSION_SECRET) : null;
}

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

async function login(request, env) {
  const clave = 'rl:' + (request.headers.get('CF-Connecting-IP') || 'local');
  const intentos = Number(await env.COBROS.get(clave)) || 0;
  if (intentos >= MAX_INTENTOS) return responder({ error: 'Demasiados intentos. Intenta más tarde.' }, 429);
  const cuerpo = await leerJSON(request);
  const sesion = cuerpo ? await credenciales(cuerpo, env) : null;
  if (!sesion) {
    await env.COBROS.put(clave, String(intentos + 1), { expirationTtl: VENTANA_SEGUNDOS });
    return responder({ error: 'Credenciales inválidas' }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + DURACION[sesion.rol];
  return responder({ token: await firmar({ ...sesion, exp }, env.SESSION_SECRET), exp, ...sesion });
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

async function enrutar(request, env, url) {
  const ruta = url.pathname;
  const metodo = request.method;
  if (ruta === '/api/salud') return responder({ ok: true });
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return responder({ error: 'Servidor sin configurar' }, 500);
  const origen = request.headers.get('Origin');
  if (metodo !== 'GET' && origen && origen !== url.origin) return responder({ error: 'Origen no permitido' }, 403);
  if (ruta === '/api/login') return metodo === 'POST' ? login(request, env) : responder({ error: 'Método no permitido' }, 405);
  const sesion = await autenticar(request, env);
  if (!sesion) return responder({ error: 'No autorizado' }, 401);
  if (ruta === '/api/datos') {
    if (sesion.rol !== 'admin') return responder({ error: 'Prohibido' }, 403);
    if (metodo === 'GET') {
      const { version, prestamos } = await leerDatos(env);
      return responder({ version, prestamos });
    }
    return metodo === 'PUT' ? guardarDatos(request, env) : responder({ error: 'Método no permitido' }, 405);
  }
  if (ruta === '/api/cuenta') {
    if (sesion.rol !== 'deudor') return responder({ error: 'Prohibido' }, 403);
    if (metodo !== 'GET') return responder({ error: 'Método no permitido' }, 405);
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
