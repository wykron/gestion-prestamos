export const esAdmin = () => Boolean(estado.sesion && estado.sesion.rol === 'admin');

export const puedeVer = (l) => Boolean(l && estado.sesion && (estado.sesion.rol === 'admin' || l.codigo === estado.sesion.codigo));

export const estado = {
  loans: [],
  version: 0,
  selId: null,
  refAbierto: false,
  editAbierto: false,
  historialAbierto: true,
  gruposAbiertos: [],
  sesion: null,
  pestanaAcceso: 'admin',
  config: { tema: 'violeta', modo: 'auto' },
  sucio: false
};

export function abrirGrupo(codigo) {
  const clave = String(codigo);
  if (!estado.gruposAbiertos.includes(clave)) estado.gruposAbiertos.push(clave);
}
