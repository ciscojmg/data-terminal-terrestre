/**
 * Añade imagen_cooperativa a cada línea de data/horarios.ndjson
 * usando el listado oficial de cooperativas.
 */
const fs = require("fs");
const path = require("path");

const config = require("./config");
const fetchUrl = require("./http-fetch");
const {
  LISTADO_URL,
  parseCooperativasCatalog,
  findBestCooperativaMatch,
} = require("./cooperativas-listado");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const delayMs = Number(process.env.SCRAPE_DELAY_MS) || 600;
  const inPath = path.join(config.outputDir, config.horariosFile);
  if (!fs.existsSync(inPath)) {
    console.error("No existe:", inPath);
    process.exit(1);
  }

  console.log(`Descargando listado: ${LISTADO_URL}`);
  const html = await fetchUrl(LISTADO_URL);
  if (delayMs > 0) await sleep(delayMs);

  const catalog = parseCooperativasCatalog(html, LISTADO_URL);
  console.log(`${catalog.length} cooperativas en el catálogo del sitio.`);

  const raw = fs.readFileSync(inPath, "utf8");
  const lines = raw.trim() ? raw.trim().split("\n") : [];
  const records = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Línea ${i + 1}: JSON inválido`);
    }
  });

  const backupPath = path.join(
    config.outputDir,
    "horarios antes-enriquecer-imagenes.ndjson"
  );
  fs.copyFileSync(inPath, backupPath);

  /** @type {Map<string, { imagen_url: string, nombre_listado: string, score: number } | null>} */
  const cache = new Map();

  let matched = 0;
  let unmatched = 0;

  for (const rec of records) {
    const name = rec.cooperativa;
    if (!name) {
      rec.imagen_cooperativa = null;
      unmatched++;
      continue;
    }
    if (!cache.has(name)) {
      const hit = findBestCooperativaMatch(name, catalog);
      cache.set(name, hit);
    }
    const hit = cache.get(name);
    if (hit) {
      rec.imagen_cooperativa = hit.imagen_url;
      matched++;
    } else {
      rec.imagen_cooperativa = null;
      unmatched++;
      console.warn(`Sin coincidencia clara: "${name}"`);
    }
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(inPath, out, "utf8");

  console.log(
    `Listo. Con imagen: ${matched} filas; sin match: ${unmatched}. Backup: ${backupPath}`
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
