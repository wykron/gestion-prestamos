import { CONFIG_KEY, MODOS, TEMAS } from './constantes.js';
import { estado } from './estado.js';
import { renderConfig } from './vistas.js';

export function cargarConfig() {
  try { Object.assign(estado.config, JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}); } catch (e) {}
  if (!TEMAS.some((t) => t.id === estado.config.tema)) estado.config.tema = 'violeta';
  if (!MODOS.some((m) => m[0] === estado.config.modo)) estado.config.modo = 'auto';
}

export function guardarConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(estado.config)); } catch (e) {}
}

export function modoEfectivo() {
  if (estado.config.modo !== 'auto') return estado.config.modo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function aplicarTema() {
  document.documentElement.dataset.tema = estado.config.tema;
  document.documentElement.dataset.modo = modoEfectivo();
}

export function elegirTema(id) {
  estado.config.tema = id;
  guardarConfig();
  aplicarTema();
  renderConfig();
}

export function elegirModo(modo) {
  estado.config.modo = modo;
  guardarConfig();
  aplicarTema();
  renderConfig();
}
