import { abrirEditar, abrirRefinanciar, alternarHistorial, aplicarMora, borrarPago, borrarPrestamo, borrarTodo, copiarComprobante, crearPrestamo, descargarComprobante, elegirArchivo, exportarDatos, guardarEdicion, importarDatos, imprimirComprobante, previewMora, quitarRecargo, refinanciar, registrarPagoCuota, seleccionar } from './acciones.js';
import { estado } from './estado.js';
import { ajustaModo, camposPlan, previews } from './formularios.js';
import { cambiarPestana, entrar, iniciarSesion, mostrarAcceso, restaurarSesion, salir } from './sesion.js';
import { aplicarTema, cargarConfig, elegirModo, elegirTema } from './tema.js';
import { $, formatoNombre } from './utilidades.js';
import { abrirAcerca, abrirCuota, alternarGrupo, alternarMenu, cerrarMenu, cerrarModal, copiarCorreo, irA, renderConfig } from './vistas.js';

const ACCIONES = { abrirAcerca, abrirCuota, abrirEditar, abrirRefinanciar, ajustaModo, alternarGrupo, alternarHistorial, alternarMenu, aplicarMora, borrarPago, borrarPrestamo, borrarTodo, cambiarPestana, cerrarMenu, cerrarModal, copiarComprobante, copiarCorreo, crearPrestamo, descargarComprobante, elegirArchivo, elegirModo, elegirTema, entrar, exportarDatos, guardarEdicion, imprimirComprobante, irA, previewMora, previews, quitarRecargo, refinanciar, registrarPagoCuota, salir, seleccionar };

function ejecutar(elemento, atributo) {
  const [nombre, resto = ''] = elemento.dataset[atributo].split(':');
  const accion = ACCIONES[nombre];
  if (!accion) return;
  accion(...(resto ? resto.split(',').map((a) => (/^-?\d+$/.test(a) ? Number(a) : a)) : []));
}

function escuchar(evento, selector, atributo, filtro = () => true) {
  document.addEventListener(evento, (e) => {
    const elemento = e.target.closest(selector);
    if (elemento && filtro(e, elemento)) ejecutar(elemento, atributo);
  });
}

escuchar('click', '[data-clic]', 'clic', (e, el) => !('fondo' in el.dataset) || e.target === el);
escuchar('input', '[data-input]', 'input');
escuchar('change', '[data-cambio]', 'cambio');
escuchar('keydown', '[data-enter]', 'enter', (e, el) => e.key === 'Enter' && e.target === el);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});
window.addEventListener('beforeunload', (e) => {
  if (estado.sucio) e.preventDefault();
});

async function iniciar() {
  cargarConfig();
  aplicarTema();
  renderConfig();
  $('planN').innerHTML = camposPlan('n');
  $('nombre').addEventListener('blur', () => { $('nombre').value = formatoNombre($('nombre').value); });
  $('archivo').addEventListener('change', importarDatos);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
  document.body.classList.toggle('menu-abierto', window.innerWidth >= 800);
  ajustaModo('n');
  const previa = restaurarSesion();
  if (previa) await iniciarSesion(previa);
  else mostrarAcceso();
}

iniciar();