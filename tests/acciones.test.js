import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL('../public/' + ruta, import.meta.url), 'utf8');
const archivos = ['index.html', ...readdirSync(new URL('../public/js', import.meta.url)).map((f) => 'js/' + f)];
const usadas = new Set(archivos.flatMap((a) => [...leer(a).matchAll(/data-(?:clic|input|cambio|enter)="(\w+)/g)].map((m) => m[1])));
const main = leer('js/main.js');
const registradas = new Set((main.match(/const ACCIONES = \{([^}]*)\}/)[1]).split(',').map((n) => n.trim()).filter(Boolean));
const importadas = new Set([...main.matchAll(/import \{([^}]*)\} from/g)].flatMap((m) => m[1].split(',').map((n) => n.trim())));

test('todas las acciones usadas en el HTML y en las vistas están registradas', () => {
  assert.deepEqual([...usadas].filter((n) => !registradas.has(n)), []);
});

test('toda acción registrada está importada en main.js', () => {
  assert.deepEqual([...registradas].filter((n) => !importadas.has(n)), []);
});

test('no quedan manejadores en línea', () => {
  assert.deepEqual(archivos.filter((a) => /\son(click|input|change|keydown)=/.test(leer(a))), []);
});

test('ningún módulo declara variables locales que oculten el objeto estado', () => {
  const ocultan = archivos.filter((a) => a.startsWith('js/') && a !== 'js/estado.js' && /(?:let|const|var)\s+estado\b|function\s+\w+\s*\([^)]*\bestado\b/.test(leer(a)));
  assert.deepEqual(ocultan, []);
});