#!/usr/bin/env node
// scripts/generate-manifest.js
// Escanea las carpetas configuradas en SCAN_DIRS y genera
// assets-manifest.json con todas las URLs relativas encontradas.
// El SW lee este archivo al instalar para precachear todo.

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

// ── Configuración ─────────────────────────────────────────────
// Carpetas a escanear (relativas a la raíz del repo)
const SCAN_DIRS = [
  'assets',
  'data',
  'modules',
  'themes',
  'core',
];

// Extensiones a incluir en el precache
const INCLUDE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif',
  '.mp3', '.ogg', '.wav', '.m4a',
  '.mp4', '.webm',
  '.json',
  '.js',
  '.css',
  '.woff', '.woff2',
]);

// Archivos o carpetas a excluir explícitamente
const EXCLUDE = new Set([
  'assets-manifest.json',
  'node_modules',
  '.git',
  '.github',
  'scripts',
]);

// ── Escaneo recursivo ─────────────────────────────────────────
function scan(dir, root) {
  const urls = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return urls; }

  for (const entry of entries) {
    if (EXCLUDE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      urls.push(...scan(full, root));
    } else {
      const ext = entry.slice(entry.lastIndexOf('.')).toLowerCase();
      if (INCLUDE_EXT.has(ext)) {
        // Ruta relativa con ./ para que coincida con fetch URLs
        urls.push('./' + relative(root, full).replace(/\\/g, '/'));
      }
    }
  }
  return urls;
}

// ── Archivos raíz siempre incluidos ───────────────────────────
const ROOT_FILES = [
  './index.html',
  './app.js',
  './manifest.json',
  './app.config.json',
];

// ── Generar ───────────────────────────────────────────────────
const root = process.cwd();
const urls = [...ROOT_FILES];

for (const dir of SCAN_DIRS) {
  urls.push(...scan(join(root, dir), root));
}

// Deduplicar y ordenar
const unique = [...new Set(urls)].sort();

const manifest = {
  generado:    new Date().toISOString(),
  totalAssets: unique.length,
  urls:        unique,
};

writeFileSync('assets-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`✓ assets-manifest.json — ${unique.length} archivos`);