import { api } from './api.js';
import { esAdmin, estado } from './estado.js';
import { salir } from './sesion.js';
import { $, aviso } from './utilidades.js';
import { render } from './vistas.js';

const ESPERA = 1100;
let temporizador;
let reintento;
let enviando = false;
let repetir = false;

function indicar(texto) {
  const marca = $('sync');
  if (marca) marca.textContent = texto;
}

export async function cargarDatos() {
  if (esAdmin()) {
    const { version, prestamos } = await api.datos();
    estado.version = version;
    estado.loans = prestamos;
    indicar('Sincronizado');
  } else {
    estado.loans = (await api.cuenta()).prestamos;
    indicar('');
  }
}

export async function recargar() {
  await cargarDatos();
  render();
}

export function guardar() {
  if (!esAdmin()) return;
  estado.sucio = true;
  indicar('Guardando…');
  clearTimeout(temporizador);
  clearTimeout(reintento);
  temporizador = setTimeout(enviar, ESPERA);
}

async function manejarError(e) {
  if (e.status === 401) {
    aviso('Sesión expirada.');
    return salir();
  }
  if (e.status === 409 || e.status === 400) {
    estado.sucio = false;
    aviso(e.status === 409 ? 'Otro dispositivo modificó los datos. Se recargaron.' : e.message);
    return recargar();
  }
  indicar('Sin conexión');
  reintento = setTimeout(enviar, 5000);
}

async function enviar() {
  if (!estado.sucio || !esAdmin()) return;
  if (enviando) {
    repetir = true;
    return;
  }
  enviando = true;
  try {
    const { version } = await api.guardarDatos(estado.version, estado.loans);
    estado.version = version;
    estado.sucio = repetir;
    indicar(repetir ? 'Guardando…' : 'Sincronizado');
  } catch (e) {
    repetir = false;
    await manejarError(e);
  } finally {
    enviando = false;
  }
  if (repetir) {
    repetir = false;
    temporizador = setTimeout(enviar, ESPERA);
  }
}
