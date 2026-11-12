import { copiarTexto } from './acciones.js';
import { APP, DIAS, MODOS, TEMAS, TITULOS } from './constantes.js';
import { esAdmin, estado, puedeVer } from './estado.js';
import { abonoPrevio, cadena, calendario, cerrado, claseEstado, debeAHoy, describirCobertura, distribuirPagos, enMora, etapaPrevia, find, inicioRecargo, limite, montoCuota, pagado, pagosCadena, saldo, sumaRecargos, vigente } from './finanzas.js';
import { ajustaModo, camposPlan, filasTabla, panelEdicion, prepararEdicion, resumenMora, tablaSaldo } from './formularios.js';
import { $, esc, fcorta, fdate, fdm, hoy, icono, money, parse, r2 } from './utilidades.js';

export function vistaRecargos(l, viejo) {
  if (!l.recargos.length) return '';
  let acumulado = r2(l.total - l.monto);
  const tarjetas = l.recargos.map((r) => {
    acumulado = r2(acumulado + r.monto);
    const activo = vigente(r);
    return '<article class="tarjeta recargo"><div class="tarjeta-cab"><span class="chip ' + (activo ? 'bad' : 'warn') + '">' + (activo ? 'Vigente' : 'Programado') + '</span>' +
      (viejo ? '' : '<button class="del" title="Quitar recargo" data-clic="quitarRecargo:' + r.id + '">' + icono('cerrar') + '</button>') + '</div>' +
      '<div class="monto">+ ' + money(r.monto) + '</div><div class="mut">' + r.pct + '% de ' + money(l.monto) + '</div>' +
      '<dl class="datos"><dt>Desde</dt><dd>' + fdate(inicioRecargo(r)) + '</dd><dt>Registro</dt><dd>' + fdate(r.fecha) +
      '</dd><dt>Interés total</dt><dd>' + money(acumulado) + '</dd></dl></article>';
  });
  return '<h2>Recargos (' + l.recargos.length + ')</h2><div class="recargos">' + tarjetas.join('') + '</div>';
}

export function renderResumenDia() {
  const t = hoy();
  const activos = estado.loans.filter((l) => !cerrado(l) && saldo(l) > 0);
  const suma = (lista, f) => r2(lista.reduce((a, x) => a + f(x), 0));
  const cobradoHoy = suma(estado.loans, (l) => suma(l.pagos.filter((p) => p.fecha === t), (p) => p.monto));
  const cuotasHoy = suma(activos, (l) => suma(calendario(l).filter((c) => c.due === t), (c) => c.monto));
  const porCobrar = suma(activos, debeAHoy);
  const moras = activos.filter((l) => enMora(l)).length;
  $('hoyCards').innerHTML = [['Cobrado hoy', money(cobradoHoy)], ['Por cobrar hoy', money(porCobrar)], ['Cuotas del día', money(cuotasHoy)], ['Préstamos en mora', String(moras)]]
    .map((k) => '<div class="stat"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>').join('');
  const pagos = [];
  estado.loans.forEach((l) => l.pagos.filter((p) => p.fecha === t).forEach((p) => pagos.push({ nombre: l.nombre, monto: p.monto, nota: p.nota })));
  $('pagosHoy').innerHTML = '<h2>Pagos recibidos hoy (' + pagos.length + ')</h2>' + (pagos.length
    ? '<ul class="lista-simple">' + pagos.map((p) => '<li><span>' + esc(p.nombre) + (p.nota ? ' <span class="mut">· ' + esc(p.nota) + '</span>' : '') +
      '</span><b>' + money(p.monto) + '</b></li>').join('') + '</ul>'
    : '<span class="mut">Sin pagos hoy.</span>');
}

export function irA(nueva) {
  if (estado.sesion && estado.sesion.rol === 'deudor') nueva = 'cliente';
  document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== 'vista-' + nueva; });
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nueva));
  $('titulo').textContent = TITULOS[nueva];
  if (window.innerWidth < 800) cerrarMenu();
  window.scrollTo(0, 0);
}

export function alternarMenu() {
  document.body.classList.toggle('menu-abierto');
}

export function cerrarMenu() {
  document.body.classList.remove('menu-abierto');
}

export function renderConfig() {
  $('temas').innerHTML = TEMAS.map((t) => '<button class="muestra' + (t.id === estado.config.tema ? ' activo' : '') + '" data-tema="' + t.id +
    '" title="' + t.nombre + '" aria-label="Tema ' + t.nombre + '" data-clic="elegirTema:' + t.id + '">' + icono('check') + '</button>').join('');
  $('modos').innerHTML = MODOS.map((m) => '<button class="' + (m[0] === estado.config.modo ? 'activo' : '') + '" data-clic="elegirModo:' + m[0] + '">' + m[1] + '</button>').join('');
}

export function leyendaCalendario() {
  return '<div class="leyenda"><span class="chip ok">Pagada</span><span class="chip warn">Abono parcial</span><span class="chip bad">Vencida</span><span class="chip">Pendiente</span></div>';
}

export function cerrarModal() {
  $('modal').hidden = true;
  $('modal').innerHTML = '';
}

export function copiarCorreo() {
  copiarTexto(APP.correo, 'Correo copiado.');
}

export function abrirAcerca() {
  const enlace = (titulo, url, icon) => '<a class="enlace-btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + icono(icon) + '<span>' + titulo + '</span></a>';
  $('modal').innerHTML = '<div class="modal-caja acerca" role="dialog" aria-modal="true" aria-label="Acerca de">' +
    '<div class="acerca-cab"><span class="acerca-logo">' + icono('info') + '</span><div><h2>' + esc(APP.nombre) + '</h2><span class="chip">v' + esc(APP.version) + '</span></div></div>' +
    '<p class="mut">Creado por <b>' + esc(APP.autor) + '</b></p>' +
    '<div class="acerca-enlaces">' + enlace('Sitio web', APP.web, 'web') + enlace('GitHub', APP.github, 'github') + '</div>' +
    '<div class="acerca-correo">' + icono('correo') + '<a href="mailto:' + esc(APP.correo) + '">' + esc(APP.correo) + '</a>' +
    '<button class="icono-btn" title="Copiar correo" aria-label="Copiar correo" data-clic="copiarCorreo">' + icono('copiar') + '</button></div>' +
    '<div class="row modal-acciones"><button class="sec" data-clic="cerrarModal">Cerrar</button></div></div>';
  $('modal').hidden = false;
}

export function abrirCuota(id, n) {
  const l = find(id);
  if (!puedeVer(l)) return;
  const c = calendario(l)[n - 1];
  const puede = esAdmin() && !cerrado(l) && c.falta > 0 && saldo(l) > 0;
  const detalle = filasTabla([
    ['Vence', fdate(c.due)],
    ['Cuota', money(c.monto)],
    ['Abonado', money(c.abonado)],
    ['Falta', money(c.falta), true],
    ['Estado', c.estado + (c.pagadoEl ? ' · último abono ' + fdate(c.pagadoEl) : '')]
  ]);
  const formulario = puede
    ? '<div class="grid"><div><label>Fecha del pago</label><input id="qFecha" type="date" value="' + hoy() + '"></div>' +
    '<div><label>Monto (Bs.)</label><input id="qMonto" type="number" min="0" step="any" value="' + c.falta + '"></div>' +
    '<div class="full"><label>Nota (opcional)</label><input id="qNota"></div></div>'
    : '';
  const acciones = '<div class="row modal-acciones"><button class="sec" data-clic="cerrarModal">' + (puede ? 'Cancelar' : 'Cerrar') + '</button>' +
    (puede ? '<button data-clic="registrarPagoCuota:' + id + ',' + n + '">Registrar pago</button>' : '') + '</div>';
  $('modal').innerHTML = '<div class="modal-caja" role="dialog" aria-modal="true"><h2>' + esc(l.nombre) + ' · Cuota #' + n + '</h2>' + detalle + formulario + acciones + '</div>';
  $('modal').hidden = false;
}

export function botonesComprobante(l) {
  const boton = (titulo, atributo, icon) => '<button class="icono-btn" title="' + titulo + '" aria-label="' + titulo + '" ' + atributo + '>' + icono(icon) + '</button>';
  return boton('Copiar resumen', 'data-clic="copiarComprobante:' + l.id + '"', 'copiar') +
    boton('Descargar .txt', 'data-clic="descargarComprobante:' + l.id + '"', 'download') +
    boton('Imprimir / PDF', 'data-clic="imprimirComprobante:' + l.id + '"', 'imprimir');
}

export function render() {
  $('hoy').textContent = fdate(hoy());
  if (!estado.sesion) return;
  if (estado.sesion.rol === 'deudor') return renderCliente();

  let prestado = 0, cobrado = 0, porCobrar = 0;
  estado.loans.forEach((l) => {
    if (!l.encadenadoDe) prestado += l.monto - (l.arrastre || 0);
    cobrado += pagado(l);
    porCobrar += saldo(l);
  });
  $('stats').innerHTML = [['Total prestado', prestado], ['Cobrado', cobrado], ['Por cobrar', porCobrar]]
    .map((s) => '<div class="stat"><span class="mut">' + s[0] + '</span><b>' + money(s[1]) + '</b></div>').join('');

  const deben = estado.loans.filter((l) => debeAHoy(l) > 0);
  $('cobrosHoy').innerHTML = '<h2>Por cobrar hoy</h2>' + (deben.length
    ? '<div class="scroll"><table><tr><th>Deudor</th><th>Teléfono</th><th>Debe a hoy</th><th>Situación</th><th></th></tr>' +
    deben.map((l) => '<tr><td>' + esc(l.nombre) + '</td><td>' + esc(l.tel) + '</td><td class="bad"><b>' + money(debeAHoy(l)) + '</b></td><td>' +
      (enMora(l) ? '<span class="chip bad">Plazo vencido</span>' : '<span class="chip warn">Con atraso</span>') + '</td><td><a class="l" data-clic="seleccionar:' + l.id + '">Abrir</a></td></tr>').join('') +
    '</table></div>'
    : '<span class="mut">Nada pendiente hoy.</span>');

  $('lista').innerHTML = vistaClientes();

  renderResumenDia();
  renderDetalle();
}

export function etiquetaMes(fecha) {
  const texto = parse(fecha).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function celdaCuota(c, hoyIso, id) {
  const f = parse(c.due);
  const dia = f.toLocaleDateString('es-BO', { weekday: 'short' }).replace('.', '');
  const detalle = c.estado === 'Pagada' ? icono('check') + ' Pagó ' + fdm(c.pagadoEl) : c.abonado > 0 ? 'Falta ' + money(c.falta) : c.estado;
  return '<div class="celda ' + claseEstado(c.estado) + (c.due === hoyIso ? ' hoy' : '') + '" role="button" tabindex="0" title="Cuota ' + c.n + ' · ' + c.estado + '" data-clic="abrirCuota:' + id + ',' + c.n + '" data-enter="abrirCuota:' + id + ',' + c.n + '">' +
    '<span class="cab"><span>' + dia + ' ' + f.getDate() + '</span><span>#' + c.n + '</span></span>' +
    '<b>' + money(c.monto) + '</b><span class="det">' + detalle + '</span></div>';
}

export function vistaCalendario(l) {
  const hoyIso = hoy();
  const meses = [];
  calendario(l).forEach((c) => {
    const clave = c.due.slice(0, 7);
    let grupo = meses.find((m) => m.clave === clave);
    if (!grupo) {
      grupo = { clave, titulo: etiquetaMes(c.due), cuotas: [] };
      meses.push(grupo);
    }
    grupo.cuotas.push(c);
  });
  return leyendaCalendario() + meses.map((m) =>
    '<div class="mes">' + m.titulo + '</div><div class="agenda">' + m.cuotas.map((c) => celdaCuota(c, hoyIso, l.id)).join('') + '</div>').join('');
}

export function vistaCadena(l, admin) {
  const etapas = cadena(l);
  if (etapas.length < 2) return '';
  const paso = (e, i) => {
    const actual = e.id === l.id;
    const accion = admin && !actual ? ' role="button" tabindex="0" data-clic="seleccionar:' + e.id + '" data-enter="seleccionar:' + e.id + '"' : '';
    return '<div class="paso' + (actual ? ' actual' : '') + '"' + accion + '><span class="paso-n">' + (i === 0 ? 'Original' : 'Mora ' + i) + '</span><b>' + money(e.total) + '</b><span class="mut">' + fdate(e.inicio) + '</span></div>';
  };
  return '<div class="cadena" role="group" aria-label="Cadena de préstamos">' + etapas.map(paso).join('<span class="enlace-cadena">' + icono('expandir') + '</span>') + '</div>';
}

export function listaHistorial(l, soloLectura) {
  const { cubre } = distribuirPagos(l);
  let corrido = r2(l.total + sumaRecargos(l));
  const items = pagosCadena(l).map((p) => {
    corrido = r2(corrido - p.monto);
    const cobertura = p.previo ? 'etapa anterior' : describirCobertura(cubre[p.id] || []);
    return '<li' + (p.previo ? ' class="previo"' : '') + ' title="' + cobertura + '"><span class="mut">' + fcorta(p.fecha) + '</span><b>' + money(p.monto) + '</b><span class="nota">' +
      (esc(p.nota) || cobertura) + '</span><span class="mut saldo">saldo ' + money(corrido) + '</span>' +
      (soloLectura || p.previo ? '' : '<button class="del" title="Quitar pago" data-clic="borrarPago:' + p.id + '">' + icono('cerrar') + '</button>') + '</li>';
  }).reverse();
  return items.length ? '<ul class="historial">' + items.join('') + '</ul>' : '<span class="mut">Sin pagos.</span>';
}

export function vistaHistorial(l, soloLectura) {
  const cabecera = '<button class="toggle" id="toggleHistorial" aria-expanded="' + estado.historialAbierto + '" data-clic="alternarHistorial">' +
    '<span>Historial (' + pagosCadena(l).length + ')</span><span id="flechaHistorial" class="flecha' + (estado.historialAbierto ? ' arriba' : '') + '">' + icono('expandir') + '</span></button>';
  return cabecera + '<div id="cuerpoHistorial"' + (estado.historialAbierto ? '' : ' hidden') + '>' + listaHistorial(l, soloLectura) + '</div>';
}

const abonado = (l) => r2(pagado(l) + abonoPrevio(l));

const esActivo = (l) => !cerrado(l) && saldo(l) > 0;

function chipEstado(l) {
  if (l.estado === 'refinanciado') return '<span class="chip">Refinanciado</span>';
  if (l.estado === 'encadenado') return '<span class="chip">Encadenado</span>';
  if (saldo(l) <= 0) return '<span class="chip ok">Liquidado</span>';
  if (enMora(l)) return '<span class="chip bad">En mora</span>';
  if (debeAHoy(l) > 0) return '<span class="chip warn">Con atraso</span>';
  return '<span class="chip ok">Al día</span>';
}

export function tarjetaPrestamo(l, admin) {
  const total = r2(l.total + sumaRecargos(l));
  const pct = Math.min(100, Math.round(abonado(l) / total * 100));
  const clic = admin ? ' role="button" tabindex="0" data-clic="seleccionar:' + l.id + '" data-enter="seleccionar:' + l.id + '"' : '';
  return '<article class="prestamo-card' + (admin && l.id === estado.selId ? ' sel' : '') + '"' + clic + '>' +
    '<div class="tarjeta-cab"><b>' + esc(l.nombre) + '</b>' + chipEstado(l) + '</div>' +
    '<div class="monto-total">' + money(total) + '</div>' +
    '<div class="tarjeta-sub"><span class="mut">' + (l.modo === 'diario' ? 'Diario' : 'Semanal') + ' × ' + l.cuotas + '</span>' +
    (l.moraTotal ? '<span class="chip mora">Mora + ' + money(l.moraTotal) + '</span>' : '') + '</div>' +
    '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="tarjeta-pie"><span class="mut">Pagado ' + money(abonado(l)) + '</span><b>' + (cerrado(l) ? '—' : 'Saldo ' + money(saldo(l))) + '</b>' +
    (admin ? '<button class="del" title="Eliminar préstamo" data-clic="borrarPrestamo:' + l.id + '">' + icono('borrar') + '</button>' : '') + '</div></article>';
}

function filaPrestamo(l) {
  const total = r2(l.total + sumaRecargos(l));
  const pct = Math.min(100, Math.round(abonado(l) / total * 100));
  const accion = ' role="button" tabindex="0" data-clic="seleccionar:' + l.id + '" data-enter="seleccionar:' + l.id + '"';
  return '<div class="fila' + (l.id === estado.selId ? ' sel' : '') + '"' + accion + '>' +
    '<div class="fila-texto"><b>' + money(total) + '</b><span class="mut">' + (l.modo === 'diario' ? 'Diario' : 'Semanal') + ' × ' + l.cuotas + ' · pagado ' + money(abonado(l)) +
    (l.moraTotal ? ' · mora ' + money(l.moraTotal) : '') + '</span></div>' +
    '<div class="fila-fin"><b>' + (cerrado(l) ? '—' : money(saldo(l))) + '</b>' + chipEstado(l) + '</div>' +
    '<button class="icono-btn" title="Eliminar préstamo" aria-label="Eliminar préstamo" data-clic="borrarPrestamo:' + l.id + '">' + icono('borrar') + '</button>' +
    '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
}

function grupoCliente(lista) {
  const activos = lista.filter(esActivo);
  const clave = String(lista[0].codigo);
  const abierto = estado.gruposAbiertos.includes(clave);
  const saldoTotal = r2(activos.reduce((a, l) => a + saldo(l), 0));
  const moras = activos.filter((l) => enMora(l)).length;
  const accion = 'data-clic="alternarGrupo:' + esc(clave) + '" data-enter="alternarGrupo:' + esc(clave) + '"';
  return '<section class="grupo' + (abierto ? ' abierto' : '') + '" data-grupo="' + esc(clave) + '">' +
    '<div class="grupo-cab" role="button" tabindex="0" aria-expanded="' + abierto + '" ' + accion + '>' +
    '<span class="avatar">' + esc(lista[0].nombre.charAt(0).toUpperCase()) + '</span>' +
    '<div class="grupo-info"><b>' + esc(lista[0].nombre) + '</b><span class="mut">' + activos.length + ' préstamos · saldo ' + money(saldoTotal) + '</span></div>' +
    (moras ? '<span class="chip bad">' + moras + ' en mora</span>' : '') +
    '<span class="flecha">' + icono('expandir') + '</span></div>' +
    '<div class="grupo-cuerpo"><div class="grupo-lista">' + lista.map((l) => filaPrestamo(l)).join('') + '</div></div></section>';
}

export function vistaClientes() {
  const visibles = estado.loans.filter((l) => !etapaPrevia(l));
  if (!visibles.length) return '<span class="mut">Sin préstamos.</span>';
  const porDeudor = new Map();
  visibles.forEach((l) => porDeudor.set(l.codigo, [...(porDeudor.get(l.codigo) || []), l]));
  const individuales = [];
  const agrupados = [];
  porDeudor.forEach((lista) => {
    if (lista.filter(esActivo).length >= 2) agrupados.push(grupoCliente(lista));
    else lista.forEach((l) => individuales.push(tarjetaPrestamo(l, true)));
  });
  return (individuales.length ? '<div class="tarjetas">' + individuales.join('') + '</div>' : '') +
    (agrupados.length ? '<div class="grupos">' + agrupados.join('') + '</div>' : '');
}

export function alternarGrupo(codigo) {
  const clave = String(codigo);
  const abierto = !estado.gruposAbiertos.includes(clave);
  estado.gruposAbiertos = abierto ? [...estado.gruposAbiertos, clave] : estado.gruposAbiertos.filter((c) => c !== clave);
  const grupo = [...$('lista').querySelectorAll('.grupo')].find((g) => g.dataset.grupo === clave);
  if (!grupo) return;
  grupo.classList.toggle('abierto', abierto);
  grupo.querySelector('.grupo-cab').setAttribute('aria-expanded', String(abierto));
}

export function renderCliente() {
  const propios = estado.loans.filter((l) => l.codigo === estado.sesion.codigo && !etapaPrevia(l));
  const nombre = propios.length ? propios[0].nombre : '';
  $('cuentaCliente').innerHTML = '<h2 class="saludo">Hola, ' + esc(nombre) + '</h2>' + propios.map((l) =>
    '<section>' + tarjetaPrestamo(l, false) + '<div class="acciones fin">' + botonesComprobante(l) + '</div>' + vistaCadena(l, false) +
    (cerrado(l) ? '' : vistaCalendario(l)) + '<h2>Historial (' + pagosCadena(l).length + ')</h2>' + listaHistorial(l, true) + '</section>').join('');
}

export function renderDetalle() {
  const box = $('detalle');
  const l = find(estado.selId);
  if (!l) { box.style.display = 'none'; return; }
  box.style.display = 'block';

  const viejo = cerrado(l);
  const pendiente = saldo(l);
  const recargos = sumaRecargos(l);
  const dias = (l.excluidos || []).map((d) => DIAS[d]).join(', ');
  const contacto = [l.tel, l.dir, 'Código ' + l.codigo].filter(Boolean).map(esc).join(' · ');
  const plan = money(l.monto) + ' + ' + l.interes + '%' + (l.moraTotal ? ' + mora ' + money(l.moraTotal) : '') + (recargos ? ' + recargos ' + money(recargos) : '') + ' · ' +
    (l.modo === 'diario' ? 'Diario' : 'Semanal') + ' × ' + l.cuotas + ' de ' + money(montoCuota(l, 0)) + (dias ? ' · sin ' + dias : '') +
    (abonoPrevio(l) ? ' · abonos previos ' + money(abonoPrevio(l)) : '') + (l.arrastre ? ' · incluye saldo anterior ' + money(l.arrastre) : '');
  const acciones = (viejo ? '' :
    '<button class="icono-btn' + (estado.editAbierto ? ' activo' : '') + '" title="Editar" aria-label="Editar" data-clic="abrirEditar">' + icono('editar') + '</button>' +
    (pendiente > 0 ? '<button class="icono-btn' + (estado.refAbierto ? ' activo' : '') + '" title="Refinanciar" aria-label="Refinanciar" data-clic="abrirRefinanciar">' + icono('refinanciar') + '</button>' : '')) +
    botonesComprobante(l);

  let html = '<div class="detalle-cab"><div><h2>' + esc(l.nombre) + '</h2><div class="mut">' + contacto + '</div></div><div class="acciones">' + acciones + '</div></div>' +
    '<div class="kpis"><div class="kpi"><span>Total</span><b>' + money(l.total + recargos) + '</b></div>' +
    '<div class="kpi"><span>Pagado</span><b>' + money(abonado(l)) + '</b></div>' +
    '<div class="kpi saldo-kpi"><span>Saldo</span><b>' + money(pendiente) + '</b></div></div><div class="mut">' + plan + '</div>' + vistaCadena(l, true);

  if (l.estado === 'encadenado') {
    html += '<p class="warn">Encadenado con mora · sus abonos pasaron a la tarjeta siguiente. ' +
      (find(l.encadenadoEn) ? '<a class="l" data-clic="seleccionar:' + l.encadenadoEn + '">Ver tarjeta con mora</a>' : '') + '</p>';
  } else if (viejo) {
    html += '<p class="warn">Refinanciado · saldo trasladado ' + money(l.saldoTrasladado) + ' (pagado ' + money(pagado(l)) + '). ' +
      (find(l.refinanciadoEn) ? '<a class="l" data-clic="seleccionar:' + l.refinanciadoEn + '">Ver préstamo nuevo</a>' : '') + '</p>';
  } else {
    if (enMora(l)) {
      html += '<div class="banner"><b>' + icono('alerta') + ' Vencido el ' + fdate(limite(l)) + '</b> · saldo ' + money(pendiente) +
        '<div class="row"><div class="corta"><label>Mora %</label><input id="mPct" type="number" min="0" step="any" value="' + l.interes + '" data-input="previewMora"></div>' +
        '<div class="corta"><label>Cuotas</label><input id="mCuotas" type="number" min="1" step="1" value="' + l.cuotas + '"></div>' +
        '<div class="media"><label>Nuevo inicio</label><input id="mDesde" type="date" value="' + hoy() + '" min="' + limite(l) + '"></div>' +
        '<button data-clic="aplicarMora">Aplicar mora</button></div><div id="mMonto">' + resumenMora(l, l.interes) + '</div></div>';
    }
    if (estado.refAbierto) {
      html += '<div class="panel"><b>Refinanciar</b>' + tablaSaldo(l) +
        '<div class="grid"><div><label>Dinero nuevo (Bs.)</label><input id="rExtra" type="number" min="0" step="any" value="0" data-input="previews"></div>' +
        '<div><label>Interés (%)</label><input id="rInteres" type="number" min="0" step="any" value="' + l.interes + '" data-input="previews"></div>' +
        camposPlan('r') + '</div><div id="previewR"></div>' +
        '<div class="row"><button data-clic="refinanciar">Confirmar</button></div></div>';
    }
    if (estado.editAbierto) html += panelEdicion(l);
    html += vistaCalendario(l);
  }

  html += vistaRecargos(l, viejo) + vistaHistorial(l, viejo);
  box.innerHTML = html;
  if (estado.refAbierto) ajustaModo('r');
  if (estado.editAbierto && !viejo) prepararEdicion(l);
}