import { MONEDA } from './constantes.js';

export const $ = (id) => document.getElementById(id);

export const r2 = (n) => Math.round(n * 100) / 100;

export const pad = (n) => String(n).padStart(2, '0');

export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const parse = (s) => new Date(s + 'T00:00:00');

export const hoy = () => iso(new Date());

export const fdate = (s) => s.split('-').reverse().join('/');

export const money = (n) => MONEDA + ' ' + r2(n).toLocaleString('es-BO', { maximumFractionDigits: 2 });

export const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const icono = (nombre) => '<svg class="ico" aria-hidden="true"><use href="/icons/sprite.svg#i-' + nombre + '"/></svg>';

let avisoTimer;

export function aviso(texto) {
  const barra = $('snackbar');
  barra.textContent = texto;
  barra.classList.add('show');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => barra.classList.remove('show'), 4000);
}

export const fdm = (s) => s.slice(8) + '/' + s.slice(5, 7);

export const fcorta = (s) => {
  const p = s.split('-');
  return p[2] + '/' + p[1] + '/' + p[0].slice(2);
};

export function formatoNombre(texto) {
  return String(texto || '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s'’-])(\p{L})/gu, (m, separador, letra) => separador + letra.toLocaleUpperCase('es'));
}
