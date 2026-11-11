import { guardar } from './datos.js';
import { abrirGrupo, esAdmin, estado, puedeVer } from './estado.js';
import { abonoPrevio, armarPrestamo, crearMora, describirCobertura, distribuirPagos, find, generarCodigo, limite, montoRecargo, normalizarPrestamo, pagado, saldo, sumaRecargos, textoComprobante, vigente } from './finanzas.js';
import { leerPlan, resumenMora } from './formularios.js';
import { $, aviso, fdate, formatoNombre, hoy, money, r2 } from './utilidades.js';
import { cerrarModal, irA, render, renderDetalle } from './vistas.js';

export function crearPrestamo() {
  if (!esAdmin()) return;
  const nombre = formatoNombre($('nombre').value);
  const monto = parseFloat($('monto').value);
  const interes = parseFloat($('interes').value) || 0;
  const plan = leerPlan('n');
  if (!nombre) return aviso('Escribe el nombre del deudor.');
  if (!(monto > 0)) return aviso('El monto debe ser mayor que 0.');
  if (plan.error) return aviso(plan.error);
  const previo = estado.loans.find((x) => x.nombre === nombre);
  const l = armarPrestamo({ nombre, tel: $('tel').value.trim(), dir: $('dir').value.trim(), codigo: previo ? previo.codigo : generarCodigo() }, monto, interes, plan);
  estado.loans.push(l);
  estado.selId = l.id;
  abrirGrupo(l.codigo);
  estado.refAbierto = false;
  estado.editAbierto = false;
  ['nombre', 'tel', 'dir'].forEach((k) => { $(k).value = ''; });
  guardar();
  render();
  irA('prestamos');
  $('detalle').scrollIntoView({ behavior: 'smooth' });
}

export function borrarPrestamo(id) {
  if (!esAdmin()) return;
  const l = find(id);
  const previo = l && l.encadenadoDe ? find(l.encadenadoDe) : null;
  const pregunta = previo ? '¿Eliminar esta tarjeta con mora? La tarjeta anterior volverá a estar activa.' : '¿Eliminar este préstamo y todos sus pagos?';
  if (!confirm(pregunta)) return;
  if (previo && previo.encadenadoEn === id) {
    delete previo.estado;
    delete previo.encadenadoEn;
  }
  estado.loans = estado.loans.filter((x) => x.id !== id);
  if (estado.selId === id) estado.selId = previo ? previo.id : null;
  guardar();
  render();
}

export function seleccionar(id) {
  if (!esAdmin()) return;
  const elegido = find(id);
  if (elegido) abrirGrupo(elegido.codigo);
  estado.selId = id;
  estado.refAbierto = false;
  estado.editAbierto = false;
  render();
  irA('prestamos');
  $('detalle').scrollIntoView({ behavior: 'smooth' });
}

export function guardarPago(l, fecha, monto, nota, cuota) {
  if (!fecha) return aviso('Elige la fecha.');
  if (!(monto > 0)) return aviso('Escribe un monto mayor que 0.');
  if (monto > saldo(l)) return aviso('El abono (' + money(monto) + ') supera el saldo pendiente (' + money(saldo(l)) + ').');
  const pago = { id: Date.now(), fecha, monto: r2(monto), nota };
  if (cuota) pago.cuota = cuota;
  l.pagos.push(pago);
  l.pagos.sort((a, b) => (a.fecha === b.fecha ? a.id - b.id : a.fecha < b.fecha ? -1 : 1));
  guardar();
  cerrarModal();
  render();
  aviso('Pago de ' + money(pago.monto) + ' registrado el ' + fdate(fecha) + ' · ' + describirCobertura(distribuirPagos(l).cubre[pago.id]));
}

export function registrarPagoCuota(id, n) {
  if (!esAdmin()) return;
  guardarPago(find(id), $('qFecha').value, parseFloat($('qMonto').value), $('qNota').value.trim(), n);
}

export function borrarPago(pid) {
  if (!esAdmin()) return;
  const l = find(estado.selId);
  if (!confirm('¿Eliminar este pago?')) return;
  l.pagos = l.pagos.filter((p) => p.id !== pid);
  guardar();
  render();
}

export function previewMora() {
  $('mMonto').innerHTML = resumenMora(find(estado.selId), parseFloat($('mPct').value) || 0);
}

export function aplicarMora() {
  if (!esAdmin()) return;
  const l = find(estado.selId);
  const pct = parseFloat($('mPct').value);
  const cuotas = parseInt($('mCuotas').value);
  const desde = $('mDesde').value;
  if (!(pct > 0)) return aviso('Escribe un porcentaje mayor que 0.');
  if (!(cuotas >= 1)) return aviso('Las cuotas deben ser al menos 1.');
  if (!desde) return aviso('Elige la fecha de inicio del nuevo cronograma.');
  if (desde < limite(l)) return aviso('El nuevo cronograma no puede empezar antes del vencimiento (' + fdate(limite(l)) + ').');
  const nuevo = crearMora(l, pct, cuotas, desde);
  const mensaje = 'Se creará una tarjeta encadenada con mora de ' + pct + '% sobre ' + money(l.monto) + ' (+ ' + money(montoRecargo(l, pct)) + ').\nTotal ' + money(nuevo.total) +
    ' · abonos conservados ' + money(nuevo.abonoPrevio) + ' · saldo ' + money(r2(saldo(l) + montoRecargo(l, pct))) + '.\nEl cronograma empieza el ' + fdate(desde) + '. ¿Continuar?';
  if (!confirm(mensaje)) return;
  l.estado = 'encadenado';
  l.encadenadoEn = nuevo.id;
  estado.loans.push(nuevo);
  estado.selId = nuevo.id;
  abrirGrupo(nuevo.codigo);
  estado.refAbierto = false;
  estado.editAbierto = false;
  guardar();
  render();
  aviso('Tarjeta con mora creada.');
}

export function quitarRecargo(rid) {
  if (!esAdmin()) return;
  const l = find(estado.selId);
  const r = l.recargos.find((x) => x.id === rid);
  if (vigente(r) && saldo(l) - r.monto < 0) return aviso('No se puede quitar: ya se pagó parte de este recargo.');
  if (!confirm('¿Quitar este recargo?')) return;
  l.recargos = l.recargos.filter((x) => x.id !== rid);
  guardar();
  render();
}

export function abrirRefinanciar() {
  estado.refAbierto = !estado.refAbierto;
  estado.editAbierto = false;
  renderDetalle();
}

export function refinanciar() {
  if (!esAdmin()) return;
  const l = find(estado.selId);
  const extra = parseFloat($('rExtra').value) || 0;
  const interes = parseFloat($('rInteres').value) || 0;
  const plan = leerPlan('r');
  const pendiente = saldo(l);
  if (plan.error) return aviso(plan.error);
  if (pendiente <= 0) return aviso('Este préstamo no tiene saldo pendiente.');
  if (extra < 0) return aviso('El dinero nuevo no puede ser negativo.');
  if (interes < 0) return aviso('El interés no puede ser negativo.');
  const capital = r2(pendiente + extra);
  const total = r2(capital * (1 + interes / 100));
  const mensaje = 'Se cerrará este préstamo (saldo real ' + money(pendiente) + ') y se creará uno nuevo:\nCapital ' + money(capital) +
    ' + ' + interes + '% = ' + money(total) + ' en ' + plan.cuotas + ' cuotas de ' + money(total / plan.cuotas) + '.\n¿Continuar?';
  if (!confirm(mensaje)) return;
  const nuevo = armarPrestamo({ nombre: l.nombre, tel: l.tel, dir: l.dir, arrastre: pendiente, origen: l.id, codigo: l.codigo }, capital, interes, plan);
  l.estado = 'refinanciado';
  l.saldoTrasladado = pendiente;
  l.refinanciadoEn = nuevo.id;
  abrirGrupo(nuevo.codigo);
  estado.loans.push(nuevo);
  estado.selId = nuevo.id;
  estado.refAbierto = false;
  estado.editAbierto = false;
  guardar();
  render();
}

export function exportarDatos() {
  if (!esAdmin()) return;
  const contenido = JSON.stringify({ version: 1, exportado: new Date().toISOString(), prestamos: estado.loans }, null, 2);
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  enlace.download = 'cobros-' + hoy() + '.json';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  aviso('Copia exportada (' + estado.loans.length + ' préstamos).');
}

export function importarDatos(evento) {
  if (!esAdmin()) return;
  const archivo = evento.target.files[0];
  evento.target.value = '';
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);
      const validos = (Array.isArray(datos) ? datos : datos.prestamos).map(normalizarPrestamo).filter(Boolean);
      if (!validos.length) return aviso('El archivo no contiene préstamos válidos.');
      if (!confirm('Se importarán ' + validos.length + ' préstamos. Los que ya existan se reemplazarán. ¿Continuar?')) return;
      validos.forEach((p) => {
        const i = estado.loans.findIndex((l) => l.id === p.id);
        if (i >= 0) estado.loans[i] = p;
        else estado.loans.push(p);
      });
      guardar();
      render();
      aviso('Importación completada.');
    } catch (e) {
      aviso('No se pudo leer el archivo.');
    }
  };
  lector.readAsText(archivo);
}

export function borrarTodo() {
  if (!esAdmin()) return;
  if (!confirm('Se borrarán todos los préstamos y pagos. Esta acción no se puede deshacer. ¿Continuar?')) return;
  estado.loans = [];
  estado.selId = null;
  guardar();
  render();
  aviso('Datos borrados.');
}

export function copiarTexto(texto, mensaje = 'Resumen copiado') {
  const copiado = () => aviso(mensaje);
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(copiado, () => aviso('No se pudo copiar.'));
  const area = document.createElement('textarea');
  area.value = texto;
  document.body.appendChild(area);
  area.select();
  if (document.execCommand('copy')) copiado();
  else aviso('No se pudo copiar.');
  area.remove();
}

export function copiarComprobante(id) {
  const l = find(id);
  if (puedeVer(l)) copiarTexto(textoComprobante(l));
}

export function descargarComprobante(id) {
  const l = find(id);
  if (!puedeVer(l)) return;
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([textoComprobante(l)], { type: 'text/plain;charset=utf-8' }));
  enlace.download = 'comprobante-' + l.nombre.toLowerCase().replace(/\s+/g, '-') + '-' + hoy() + '.txt';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

export function imprimirComprobante(id) {
  const l = find(id);
  if (!puedeVer(l)) return;
  $('comprobante').textContent = textoComprobante(l);
  window.print();
}

export function alternarHistorial() {
  estado.historialAbierto = !estado.historialAbierto;
  $('cuerpoHistorial').hidden = !estado.historialAbierto;
  $('flechaHistorial').classList.toggle('arriba', estado.historialAbierto);
  $('toggleHistorial').setAttribute('aria-expanded', String(estado.historialAbierto));
}

export function abrirEditar() {
  estado.editAbierto = !estado.editAbierto;
  estado.refAbierto = false;
  renderDetalle();
}

export function guardarEdicion() {
  if (!esAdmin()) return;
  const l = find(estado.selId);
  const nombre = formatoNombre($('eNombre').value);
  const monto = parseFloat($('eMonto').value);
  const interes = parseFloat($('eInteres').value);
  const codigo = $('eCodigo').value.trim().toUpperCase();
  const plan = leerPlan('e');
  if (!nombre) return aviso('Escribe el nombre del deudor.');
  if (!(monto > 0)) return aviso('El monto debe ser mayor que 0.');
  if (monto < (l.arrastre || 0)) return aviso('El monto no puede ser menor al saldo arrastrado (' + money(l.arrastre) + ').');
  if (!(interes >= 0)) return aviso('El interés no puede ser negativo.');
  if (plan.error) return aviso(plan.error);
  if (codigo.length < 4) return aviso('El código debe tener al menos 4 caracteres.');
  if (estado.loans.some((x) => x.id !== l.id && x.codigo === codigo && x.nombre !== nombre)) return aviso('Ese código ya pertenece a otro deudor.');
  const total = r2(monto * (1 + interes / 100) + (l.moraTotal || 0));
  if (pagado(l) + abonoPrevio(l) > total + sumaRecargos(l)) return aviso('El nuevo total (' + money(total) + ') es menor que lo ya pagado (' + money(pagado(l) + abonoPrevio(l)) + ').');
  Object.assign(l, { nombre, tel: $('eTel').value.trim(), dir: $('eDir').value.trim(), codigo, monto, interes, total },
    { modo: plan.modo, cuotas: plan.cuotas, inicio: plan.inicio, dia: plan.dia, excluidos: plan.excluidos });
  estado.editAbierto = false;
  guardar();
  render();
  aviso('Préstamo actualizado.');
}

export function elegirArchivo() {
  $('archivo').click();
}