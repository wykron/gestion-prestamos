import { DIAS } from './constantes.js';
import { estado } from './estado.js';
import { abonoPrevio, fechas, find, montoRecargo, pagado, resumenFinanciero, saldo } from './finanzas.js';
import { $, esc, fdate, hoy, money, r2 } from './utilidades.js';

export function camposPlan(p) {
  const dias = DIAS.map((d, i) => '<label class="chk"><input type="checkbox" name="' + p + 'Exc" value="' + i + '" data-cambio="previews"> ' + d + '</label>').join('');
  return '<div><label>Modalidad</label><select id="' + p + 'Modo" data-cambio="ajustaModo:' + p + '"><option value="diario">Diario</option><option value="semanal">Semanal</option></select></div>' +
    '<div><label id="' + p + 'Lbl">Días</label><input id="' + p + 'Cuotas" type="number" min="1" step="1" value="30" data-input="previews"></div>' +
    '<div id="' + p + 'WDia" style="display:none"><label>Día de cobro</label><select id="' + p + 'Dia" data-cambio="previews">' +
    DIAS.slice(1).concat(DIAS[0]).map((d) => '<option value="' + DIAS.indexOf(d) + '">' + d + '</option>').join('') + '</select></div>' +
    '<div><label>Inicio</label><input id="' + p + 'Inicio" type="date" value="' + hoy() + '" data-input="previews"></div>' +
    '<div class="full" id="' + p + 'WExc"><label>Días sin cobro</label>' + dias + '</div>';
}

export function ajustaModo(p, reiniciar = true) {
  const diario = $(p + 'Modo').value === 'diario';
  $(p + 'WDia').style.display = diario ? 'none' : 'block';
  $(p + 'WExc').style.display = diario ? 'block' : 'none';
  $(p + 'Lbl').textContent = diario ? 'Días' : 'Semanas';
  if (reiniciar) $(p + 'Cuotas').value = diario ? 30 : 4;
  previews();
}

export function leerPlan(p) {
  const modo = $(p + 'Modo').value;
  const cuotas = parseInt($(p + 'Cuotas').value);
  const inicio = $(p + 'Inicio').value;
  let excluidos = Array.from(document.querySelectorAll('input[name="' + p + 'Exc"]:checked')).map((x) => Number(x.value));
  if (modo === 'semanal') excluidos = [];
  if (!(cuotas >= 1)) return { error: 'El número de cuotas debe ser al menos 1.' };
  if (!inicio) return { error: 'Elige la fecha de inicio.' };
  if (excluidos.length >= 7) return { error: 'No puedes excluir todos los días de la semana.' };
  return { modo, cuotas, inicio, excluidos, dia: $(p + 'Dia').value };
}

export function filasTabla(filas) {
  return '<div class="scroll"><table class="resumen">' + filas.map((f) =>
    '<tr' + (f[2] ? ' class="total"' : '') + '><td>' + f[0] + '</td><td>' + f[1] + '</td></tr>').join('') + '</table></div>';
}

export function filasPlan(capital, interes, plan, mora = 0, abono = 0) {
  const total = r2(capital * (1 + interes / 100) + mora);
  const dias = fechas(plan);
  return [
    ['Interés (' + interes + '% de ' + money(capital) + ')', '+ ' + money(r2(capital * interes / 100))],
    ...(mora ? [['Mora', '+ ' + money(mora)]] : []),
    ['Total a pagar', money(total), true],
    ...(abono ? [['Abonos previos', '− ' + money(abono)]] : []),
    ['Plan ' + (plan.modo === 'diario' ? 'diario' : 'semanal'), plan.cuotas + ' cuotas de ' + money(r2(total - abono) / plan.cuotas)],
    ['Primera – última', fdate(dias[0]) + ' – ' + fdate(dias[dias.length - 1])]
  ];
}

export function resumenMora(l, pct) {
  const mora = montoRecargo(l, pct);
  return filasTabla([
    ['Mora (' + pct + '% de ' + money(l.monto) + ')', '+ ' + money(mora)],
    ['Total de la nueva tarjeta', money(r2(l.total + mora))],
    ['Abonos conservados', '− ' + money(r2(abonoPrevio(l) + pagado(l)))],
    ['Saldo', money(r2(saldo(l) + mora)), true]
  ]);
}

export function previewRefinanciar() {
  const l = find(estado.selId);
  const extra = Math.max(0, parseFloat($('rExtra').value) || 0);
  const plan = leerPlan('r');
  const capital = r2(saldo(l) + extra);
  $('previewR').innerHTML = plan.error ? '<span class="bad">' + plan.error + '</span>' : filasTabla([
    ['Saldo', money(saldo(l))],
    ['+ Dinero nuevo', money(extra)],
    ['Nuevo capital', money(capital), true]
  ].concat(filasPlan(capital, parseFloat($('rInteres').value) || 0, plan)));
}

export function previewEdicion() {
  const l = find(estado.selId);
  const plan = leerPlan('e');
  const monto = parseFloat($('eMonto').value) || 0;
  const interes = parseFloat($('eInteres').value) || 0;
  $('previewE').innerHTML = plan.error ? '<span class="bad">' + plan.error + '</span>' : filasTabla(
    [['Capital prestado', money(monto)]].concat(filasPlan(monto, interes, plan, l.moraTotal || 0, abonoPrevio(l))).concat([['Ya pagado', money(pagado(l) + abonoPrevio(l))]]));
}

export function previews() {
  const plan = leerPlan('n');
  const monto = parseFloat($('monto').value) || 0;
  const interes = parseFloat($('interes').value) || 0;
  $('previewN').innerHTML = plan.error ? '' : filasTabla([['Capital prestado', money(monto)]].concat(filasPlan(monto, interes, plan)));
  if ($('rExtra')) previewRefinanciar();
  if ($('eMonto')) previewEdicion();
}

export function tablaSaldo(l) {
  const r = resumenFinanciero(l);
  return filasTabla([
    ['Total', money(r.total)],
    ['Recargos', money(r.recargos)],
    ['Pagado (' + r.cuotasPagadas + ' de ' + r.cuotasTotales + ' cuotas)', '− ' + money(r.pagado)],
    ['Saldo', money(r.saldo), true]
  ]);
}

export function panelEdicion(l) {
  return '<div class="panel"><b>Editar</b><div class="grid">' +
    '<div><label>Nombre del deudor</label><input id="eNombre" value="' + esc(l.nombre) + '" autocomplete="off"></div>' +
    '<div><label>Teléfono</label><input id="eTel" type="tel" value="' + esc(l.tel) + '"></div>' +
    '<div><label>Dirección</label><input id="eDir" value="' + esc(l.dir) + '"></div>' +
    '<div><label>Código de acceso</label><input id="eCodigo" value="' + esc(l.codigo) + '" autocapitalize="characters"></div>' +
    '<div><label>Monto (Bs.)</label><input id="eMonto" type="number" min="0" step="any" value="' + l.monto + '" data-input="previews"' + (l.encadenadoDe ? ' readonly' : '') + '></div>' +
    '<div><label>Interés (%)</label><input id="eInteres" type="number" min="0" step="any" value="' + l.interes + '" data-input="previews"' + (l.encadenadoDe ? ' readonly' : '') + '></div>' +
    camposPlan('e') + '</div><div id="previewE"></div>' +
    '<div class="row"><button data-clic="guardarEdicion">Guardar cambios</button></div></div>';
}

export function prepararEdicion(l) {
  $('eModo').value = l.modo;
  $('eCuotas').value = l.cuotas;
  $('eInicio').value = l.inicio;
  $('eDia').value = l.dia ?? '1';
  document.querySelectorAll('input[name="eExc"]').forEach((c) => { c.checked = (l.excluidos || []).includes(Number(c.value)); });
  ajustaModo('e', false);
}