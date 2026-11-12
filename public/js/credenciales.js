const PREFIJO = 'cobros_recordar_';
const BASE_DATOS = 'cobros_seguro';
const ALMACEN = 'llaves';
const VIGENCIA_MS = 30 * 24 * 60 * 60 * 1000;
const ESPERA_MS = 1500;
const TIEMPO_AGOTADO = 'tiempo agotado';
const ROLES = ['admin', 'deudor'];
const CODIGO = /^[A-Z0-9]{4,12}$/;
const MAX_CLAVE = 200;

const codificador = new TextEncoder();
const aBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const desdeBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

export const normalizarCodigo = (texto) => String(texto ?? '').trim().toUpperCase();

export function validarEntrada(rol, valor) {
  if (rol === 'admin') {
    if (typeof valor !== 'string' || !valor) return 'Escribe tu clave.';
    return valor.length > MAX_CLAVE ? 'La clave es demasiado larga.' : '';
  }
  return CODIGO.test(normalizarCodigo(valor)) ? '' : 'El código debe tener de 4 a 12 letras o números.';
}

export function sesionDesdeRespuesta(respuesta) {
  if (!respuesta || !ROLES.includes(respuesta.rol) || !Number.isFinite(respuesta.exp) || respuesta.exp * 1000 <= Date.now()) return null;
  if (respuesta.rol === 'deudor' && !CODIGO.test(String(respuesta.codigo))) return null;
  return Object.freeze({ rol: respuesta.rol, exp: respuesta.exp, ...(respuesta.rol === 'deudor' ? { codigo: respuesta.codigo } : {}) });
}

export const generarLlave = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

export async function cifrarCon(llave, texto, contexto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: codificador.encode(contexto) }, llave, codificador.encode(texto));
  return { iv: aBase64(iv), dato: aBase64(cifrado) };
}

export async function descifrarCon(llave, registro, contexto) {
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desdeBase64(registro.iv), additionalData: codificador.encode(contexto) }, llave, desdeBase64(registro.dato));
  return new TextDecoder().decode(claro);
}

function transaccion(modo, operacion) {
  return new Promise((resolver, rechazar) => {
    const abrir = indexedDB.open(BASE_DATOS, 1);
    abrir.onupgradeneeded = () => abrir.result.createObjectStore(ALMACEN);
    abrir.onerror = () => rechazar(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result;
      const tx = bd.transaction(ALMACEN, modo);
      const peticion = operacion(tx.objectStore(ALMACEN));
      tx.oncomplete = () => { bd.close(); resolver(peticion.result); };
      tx.onerror = () => { bd.close(); rechazar(tx.error); };
      tx.onabort = tx.onerror;
    };
  });
}

let llavePendiente;

function obtenerLlave() {
  llavePendiente ||= (async () => {
    const guardada = await transaccion('readonly', (almacen) => almacen.get('llave'));
    if (guardada) return guardada;
    const nueva = await generarLlave();
    await transaccion('readwrite', (almacen) => almacen.put(nueva, 'llave'));
    return nueva;
  })().catch((e) => {
    llavePendiente = undefined;
    throw e;
  });
  return llavePendiente;
}

const conTiempo = (promesa) => Promise.race([promesa, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(TIEMPO_AGOTADO)), ESPERA_MS))]);

export function olvidarCredencial(rol) {
  try { localStorage.removeItem(PREFIJO + rol); } catch (e) {}
}

export async function recordarCredencial(rol, valor) {
  if (rol !== 'deudor' || validarEntrada(rol, valor)) return false;
  try {
    const exp = Date.now() + VIGENCIA_MS;
    const cifrado = await conTiempo(obtenerLlave().then((llave) => cifrarCon(llave, valor, rol + '|' + exp)));
    localStorage.setItem(PREFIJO + rol, JSON.stringify({ v: 1, exp, ...cifrado }));
    return true;
  } catch (e) {
    return false;
  }
}

export async function credencialRecordada(rol) {
  let registro = null;
  try { registro = JSON.parse(localStorage.getItem(PREFIJO + rol)); } catch (e) {}
  if (!registro) return '';
  if (registro.v !== 1 || !(registro.exp > Date.now())) {
    olvidarCredencial(rol);
    return '';
  }
  try {
    return await descifrarCon(await conTiempo(obtenerLlave()), registro, rol + '|' + registro.exp);
  } catch (e) {
    if (e.message !== TIEMPO_AGOTADO) olvidarCredencial(rol);
    return '';
  }
}