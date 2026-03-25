#!/usr/bin/env node
/**
 * CLI unificada: barrido completo, refresh, reparación y exportación JSON.
 *
 * Uso:
 *   node scripts/terminal-scrape.js [comando] [opciones]
 *   npm run terminal -- full --region=costa
 */

const path = require("path");

const ROOT = path.join(__dirname, "..");

function resolveSrc(rel) {
  return require.resolve(rel, { paths: [ROOT] });
}

function uncacheModule(rel) {
  try {
    const abs = resolveSrc(rel);
    delete require.cache[abs];
  } catch {
    /* no cargado aún */
  }
}

function uncachePipeline() {
  [
    "../src/scrape.js",
    "../src/refresh-from-web.js",
    "../src/repair-desconocidas.js",
    "../src/config.js",
    "../src/parser.js",
    "../src/http-fetch.js",
  ].forEach(uncacheModule);
}

function parseArgs(argv) {
  const cmd =
    argv[0] && !String(argv[0]).startsWith("-") ? argv[0] : "full";
  const opts = cmd === argv[0] ? argv.slice(1) : [...argv];

  const delayArg = opts.find((a) => /^--delay=/.test(a));
  if (delayArg) {
    process.env.SCRAPE_DELAY_MS = delayArg.split("=")[1].trim();
  }

  const useBrowser = opts.includes("--browser");
  if (!useBrowser && (cmd === "full" || cmd === "scrape")) {
    process.env.SCRAPE_USE_HTTP = "1";
  }
  if (useBrowser) {
    delete process.env.SCRAPE_USE_HTTP;
  }

  return { cmd, opts };
}

function printHelp() {
  console.log(`
Terminal Terrestre Guayaquil — scraper unificado

Uso:
  node scripts/terminal-scrape.js <comando> [opciones]

Comandos:
  full, scrape   Barrido completo (lista regiones → ciudades → cooperativas).
                 Por defecto usa HTTP (estable). Salida: data/horarios.ndjson
  refresh        Vuelve a descargar cada URL única del NDJSON y reescribe el archivo
                 (mismo esquema: ruta, contactos, web, 1 registro por cooperativa).
  repair         Corrige filas con cooperativa "Desconocida" leyendo el h1.
  to-json        Genera data/horarios.json desde data/horarios.ndjson

Opciones (full / scrape):
  --region=costa|sierra|all   Por defecto: all
  --browser                   Usar Puppeteer + Chrome (si HTTP falla o prefieres navegador)
  --delay=600                 Ms entre peticiones (o variable SCRAPE_DELAY_MS)

Otros:
  --help, -h                  Esta ayuda

Ejemplos:
  node scripts/terminal-scrape.js full
  node scripts/terminal-scrape.js full --region=sierra --delay=800
  node scripts/terminal-scrape.js full --browser
  node scripts/terminal-scrape.js refresh
  node scripts/terminal-scrape.js repair
  node scripts/terminal-scrape.js to-json
`);
}

async function run() {
  const argv = process.argv.slice(2);
  if (
    argv.length === 0 ||
    argv.includes("--help") ||
    argv.includes("-h") ||
    argv[0] === "help"
  ) {
    printHelp();
    if (argv.length === 0) process.exit(0);
    return;
  }

  const { cmd } = parseArgs(argv);

  if (cmd === "help" || cmd === "--help") {
    printHelp();
    return;
  }

  uncachePipeline();

  switch (cmd) {
    case "full":
    case "scrape": {
      const { main } = require("../src/scrape");
      await main();
      break;
    }
    case "refresh": {
      const { main } = require("../src/refresh-from-web");
      await main();
      break;
    }
    case "repair": {
      const { main } = require("../src/repair-desconocidas");
      await main();
      break;
    }
    case "to-json": {
      const { main: toJson } = require("./ndjson-to-json");
      toJson();
      break;
    }
    default:
      console.error(`Comando desconocido: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
