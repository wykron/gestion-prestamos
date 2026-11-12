import { api } from './api.js';
import { credencialRecordada, normalizarCodigo, olvidarCredencial, recordarCredencial, sesionDesdeRespuesta, validarEntrada } from './credenciales.js';
import { cargarDatos } from './datos.js';
import { estado } from './estado.js';
import { $, aviso } from './utilidades.js';
import { cerrarModal, irA, render } from './vistas.js';

const VISTAS_PANEL = ['hoyCards', 'cobrosHoy', 'pagosHoy', 'stats', 'lista', 'detalle', 'cuentaCliente'];
let entrando = false;
let cierre;

export async function restaurarSesion() {
  try {
    return sesionDesdeRespuesta(await api.sesion());
  } catch (e) {
    return null;
  }
}

async function precargarCredencial(rol) {
  if (rol !== 'deudor') return;
  const guardada = await credencialRecordada(rol);
  const campo = $('dCodigo');
  if (!guardada || estado.pestanaAcceso !== rol || !campo || campo.value) return;
  campo.value = guardada;
  $('recordar').checked = true;
}

export function renderAcceso() {
  const rol = estado.pestanaAcceso;
  const admin = rol === 'admin';
  if (admin) olvidarCredencial('admin');
  $('acceso').innerHTML = '<div class="acceso-caja"><h1>Login</h1>' +
    '<div class="segmentos"><button class="' + (admin ? 'activo' : '') + '" data-clic="cambiarPestana:admin">Prestamista</button>' +
    '<button class="' + (admin ? '' : 'activo') + '" data-clic="cambiarPestana:deudor">Deudor</button></div>' +
    (admin
      ? '<div><label>Clave</label><input id="aClave" type="password" maxlength="200" autocomplete="current-password" spellcheck="false" data-enter="entrar"></div>'
      : '<div><label>Código de acceso</label><input id="dCodigo" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" data-enter="entrar"></div>') +
    '<div><label class="chk"><input type="checkbox" id="recordar">' + (admin ? ' Mantener sesión 30 días' : ' Recordar en este dispositivo') + '</label></div>' +
    '<div class="bad" id="accesoError" role="alert"></div><button id="botonEntrar" data-clic="entrar">Entrar</button></div>';
  precargarCredencial(rol);
}

export function mostrarAcceso() {
  estado.pestanaAcceso = 'admin';
  renderAcceso();
  $('acceso').hidden = false;
}

export function cambiarPestana(pestana) {
  estado.pestanaAcceso = pestana;
  renderAcceso();
}

function errorAcceso(texto) {
  $('accesoError').textContent = texto;
}

function marcarOcupado(ocupado) {
  const boton = $('botonEntrar');
  if (!boton) return;
  boton.disabled = ocupado;
  boton.textContent = ocupado ? 'Entrando…' : 'Entrar';
}

async function pedirSesion(rol, cuerpo) {
  const sesion = sesionDesdeRespuesta(await api.login(cuerpo));
  if (!sesion || sesion.rol !== rol) throw Object.assign(new Error('Respuesta de acceso inválida'), { status: 502 });
  return sesion;
}

function programarCierre(exp) {
  clearTimeout(cierre);
  const espera = exp * 1000 - Date.now();
  if (espera <= 0 || espera >= 2 ** 31) return;
  cierre = setTimeout(() => {
    aviso('Sesión expirada.');
    salir();
  }, espera);
}

export async function iniciarSesion(s) {
  if (!s) return salir();
  estado.sesion = s;
  document.body.dataset.rol = s.rol;
  programarCierre(s.exp);
  try {
    await cargarDatos();
  } catch (e) {
    return salir();
  }
  $('acceso').hidden = true;
  render();
  irA(s.rol === 'deudor' ? 'cliente' : estado.loans.length ? 'resumen' : 'nuevo');
}

export async function entrar() {
  if (entrando) return;
  const rol = estado.pestanaAcceso;
  const valor = rol === 'admin' ? $('aClave').value : normalizarCodigo($('dCodigo').value);
  const recordar = $('recordar').checked;
  const problema = validarEntrada(rol, valor);
  errorAcceso(problema);
  if (problema) return;
  entrando = true;
  marcarOcupado(true);
  try {
    const cuerpo = rol === 'admin' ? { tipo: 'admin', clave: valor, recordar } : { tipo: 'deudor', codigo: valor };
    const sesion = await pedirSesion(rol, cuerpo);
    if (rol === 'deudor' && recordar) {
      if (!(await recordarCredencial(rol, valor))) aviso('No se pudo guardar la credencial en este navegador.');
    } else {
      olvidarCredencial(rol);
    }
    await iniciarSesion(sesion);
  } catch (e) {
    if (e.status === 401) olvidarCredencial(rol);
    errorAcceso(e.status ? e.message : 'Sin conexión');
  } finally {
    entrando = false;
    marcarOcupado(false);
  }
}

export function salir() {
  clearTimeout(cierre);
  api.salir().catch(() => {});
  cerrarModal();
  Object.assign(estado, { sesion: null, selId: null, refAbierto: false, editAbierto: false, loans: [], version: 0, sucio: false });
  delete document.body.dataset.rol;
  VISTAS_PANEL.forEach((id) => { $(id).innerHTML = ''; });
  mostrarAcceso();
}