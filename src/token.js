const codificador = new TextEncoder();

const aBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeBase64 = (texto) => Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const clave = (secreto) => crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function firmar(carga, secreto) {
  const cuerpo = aBase64(codificador.encode(JSON.stringify(carga)));
  const firma = await crypto.subtle.sign('HMAC', await clave(secreto), codificador.encode(cuerpo));
  return cuerpo + '.' + aBase64(firma);
}

export async function verificar(token, secreto) {
  const [cuerpo, firma] = String(token).split('.');
  if (!cuerpo || !firma) return null;
  try {
    const valida = await crypto.subtle.verify('HMAC', await clave(secreto), desdeBase64(firma), codificador.encode(cuerpo));
    if (!valida) return null;
    const carga = JSON.parse(new TextDecoder().decode(desdeBase64(cuerpo)));
    return carga.exp > Date.now() / 1000 ? carga : null;
  } catch (e) {
    return null;
  }
}

export async function igualesSeguro(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', codificador.encode(String(t))))));
  let diferencia = 0;
  for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i];
  return diferencia === 0;
}
