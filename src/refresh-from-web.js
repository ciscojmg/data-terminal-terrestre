/**
 * Regenera data/horarios.ndjson a partir de las URLs únicas del archivo actual
 * (un registro por cooperativa: ruta, contactos, web, sin horarios).
 */
const fs = require("fs");
const path = require("path");

const config = require("./config");
const fetchUrl = require("./http-fetch");
const { parseSchedulePage } = require("./parser");

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

  const lines = fs.readFileSync(inPath, "utf8").trim().split("\n").filter(Boolean);
  const records = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Línea ${i + 1}: JSON inválido`);
    }
  });

  /** @type {Map<string, { region: string, ciudad_destino: string }>} */
  const byUrl = new Map();
  for (const rec of records) {
    const u = rec.source_url;
    if (!u || byUrl.has(u)) continue;
    byUrl.set(u, {
      region: rec.region,
      ciudad_destino: rec.ciudad_destino,
    });
  }

  const urls = [...byUrl.keys()];
  console.log(
    `Regenerando ${urls.length} URL(s) desde la web (delay ${delayMs} ms)…`
  );

  const out = [];
  let n = 0;
  for (const url of urls) {
    n += 1;
    const ctx = byUrl.get(url);
    try {
      console.log(`[${n}/${urls.length}] ${url}`);
      const html = await fetchUrl(url);
      const rows = parseSchedulePage(html, {
        region: ctx.region,
        source_url: url,
        ciudad_fallback: ctx.ciudad_destino,
      });
      out.push(rows[0]);
    } catch (e) {
      console.error(`  error: ${e.message}`);
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const backup = path.join(
    config.outputDir,
    "horarios antes-refresh.ndjson"
  );
  fs.copyFileSync(inPath, backup);

  const outPath = inPath;
  fs.writeFileSync(outPath, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`Listo. ${out.length} registros. Backup: ${backup}`);
  console.log(`Escrito: ${outPath}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
