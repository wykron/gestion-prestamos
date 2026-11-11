import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');

test('el HTML declara noindex y nofollow', () => {
  assert.match(leer('public/index.html'), /<meta name="robots" content="noindex, nofollow/);
});

test('robots.txt bloquea a todos los rastreadores', () => {
  assert.match(leer('public/robots.txt'), /User-agent: \*\s+Disallow: \//);
});

test('los archivos estáticos y la API envían X-Robots-Tag', () => {
  assert.match(leer('public/_headers'), /X-Robots-Tag: noindex, nofollow/);
  assert.match(leer('src/worker.js'), /'X-Robots-Tag': 'noindex, nofollow/);
});