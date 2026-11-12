async function llamar(ruta, opciones = {}) {
  const respuesta = await fetch('/api' + ruta, { ...opciones, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw Object.assign(new Error(datos.error || 'Error de red'), { status: respuesta.status });
  return datos;
}

export const api = {
  login: (cuerpo) => llamar('/login', { method: 'POST', body: JSON.stringify(cuerpo) }),
  sesion: () => llamar('/sesion'),
  salir: () => llamar('/salir', { method: 'POST', body: '{}' }),
  datos: () => llamar('/datos'),
  guardarDatos: (version, prestamos) => llamar('/datos', { method: 'PUT', body: JSON.stringify({ version, prestamos }) }),
  cuenta: () => llamar('/cuenta')
};