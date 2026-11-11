import { estado } from './estado.js';

async function llamar(ruta, opciones = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (estado.sesion) cabeceras.Authorization = 'Bearer ' + estado.sesion.token;
  const respuesta = await fetch('/api' + ruta, { ...opciones, headers: cabeceras });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw Object.assign(new Error(datos.error || 'Error de red'), { status: respuesta.status });
  return datos;
}

export const api = {
  login: (cuerpo) => llamar('/login', { method: 'POST', body: JSON.stringify(cuerpo) }),
  datos: () => llamar('/datos'),
  guardarDatos: (version, prestamos) => llamar('/datos', { method: 'PUT', body: JSON.stringify({ version, prestamos }) }),
  cuenta: () => llamar('/cuenta')
};
