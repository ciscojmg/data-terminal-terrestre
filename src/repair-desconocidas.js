const fs = require("fs");
const path = require("path");

const config = require("./config");
const fetchUrl = require("./http-fetch");
const { parseCoopTitleFromHtml } = require("./parser");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const delayMs = Number(process.env.SCRAPE_DELAY_MS) || 600;
  const inPath = path.join(config.outputDir, config.horariosFile);
  if (!fs.existsSync(inPath)) {
    console.error("No existe el archivo:", inPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(inPath, "utf8");
  const lines = raw.trim() ? raw.trim().split("\n") : [];
  const records = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Línea ${i + 1}: JSON inválido`);
    }
  });

  const urlsToFix = new Set();
  for (const rec of records) {
    if (rec.cooperativa === "Desconocida" && rec.source_url) {
      urlsToFix.add(rec.source_url);
    }
  }

  if (urlsToFix.size === 0) {
    console.log("No hay registros con cooperativa \"Desconocida\". Nada que hacer.");
    return;
  }

  console.log(
    `${urlsToFix.size} URL(s) distintas a consultar para corregir nombres…`
  );

  /** @type {Map<string, { cooperativa: string|null, ciudad_destino: string|null }>} */
  const cache = new Map();
  let n = 0;
  for (const url of urlsToFix) {
    n += 1;
    try {
      console.log(`[${n}/${urlsToFix.size}] ${url}`);
      const html = await fetchUrl(url);
      const meta = parseCoopTitleFromHtml(html);
      cache.set(url, meta);
      if (meta.cooperativa) {
        console.log(`  → cooperativa: ${meta.cooperativa}`);
      } else {
        console.log("  → no se pudo parsear el h1");
      }
    } catch (e) {
      console.error(`  → error: ${e.message}`);
      cache.set(url, { cooperativa: null, ciudad_destino: null });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const backupPath = path.join(
    config.outputDir,
    "horarios antes-reparar.ndjson"
  );
  fs.copyFileSync(inPath, backupPath);

  const outLines = records.map((rec) => {
    if (rec.cooperativa !== "Desconocida" || !rec.source_url) {
      return JSON.stringify(rec);
    }
    const meta = cache.get(rec.source_url);
    if (!meta || !meta.cooperativa) {
      return JSON.stringify(rec);
    }
    const next = { ...rec, cooperativa: meta.cooperativa };
    if (meta.ciudad_destino) {
      next.ciudad_destino = meta.ciudad_destino;
    }
    return JSON.stringify(next);
  });

  fs.writeFileSync(inPath, outLines.join("\n") + "\n", "utf8");
  console.log(`Listo. Copia de seguridad: ${backupPath}`);
  console.log(`Archivo actualizado: ${inPath}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
