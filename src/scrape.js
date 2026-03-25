const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const config = require("./config");
const fetchUrl = require("./http-fetch");
const { parseSchedulePage } = require("./parser");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function parseRegionsFromArgv() {
  const arg = process.argv.find((a) => a.startsWith("--region="));
  const mode = arg ? arg.split("=")[1].toLowerCase().trim() : "all";
  if (mode === "costa") return [["Costa", config.REGION_PAGES.Costa]];
  if (mode === "sierra") return [["Sierra", config.REGION_PAGES.Sierra]];
  if (mode === "all" || mode === "both")
    return [
      ["Costa", config.REGION_PAGES.Costa],
      ["Sierra", config.REGION_PAGES.Sierra],
    ];
  console.error('Uso: node src/scrape.js [--region=costa|sierra|all]');
  process.exit(1);
}

function cityNameFromHorariosLink(text) {
  const t = text.replace(/\s+/g, " ").trim();
  let m = t.match(/^Horarios\s+(?:a|al)\s+(.+)$/i);
  if (m) return m[1].trim();
  m = t.match(/^Horarios\s+el\s+(.+)$/i);
  if (m) return m[1].trim();
  return null;
}

function slugToTitleFromHref(href) {
  const file = href.split("/").pop().split("?")[0];
  const slug = file.replace(/^guayaquil-a-/i, "").replace(/\.php$/i, "");
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Enlaces a páginas guayaquil-a-*.php en el listado regional.
 */
function extractCityJobs($, listPageUrl, regionLabel) {
  const seen = new Set();
  const jobs = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const pathOnly = href.split("?")[0];
    if (!/^guayaquil-a-.+\.php$/i.test(pathOnly)) return;
    const url = resolveUrl(href, listPageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const linkText = $(a).text().replace(/\s+/g, " ").trim();
    const ciudad = cityNameFromHorariosLink(linkText) || slugToTitleFromHref(href);
    jobs.push({
      region: regionLabel,
      ciudad_destino: ciudad,
      cityPageUrl: url,
    });
  });
  return jobs;
}

/**
 * URLs únicas horarios-coop-*.php en la página de una ciudad.
 */
function extractCoopUrls($, cityPageUrl) {
  const set = new Set();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const pathOnly = href.split("?")[0];
    if (!/^horarios-coop-.+\.php$/i.test(pathOnly)) return;
    const url = resolveUrl(href, cityPageUrl);
    if (url) set.add(url);
  });
  return [...set];
}

async function gotoPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (config.delayMs > 0) await sleep(config.delayMs);
}

async function loadHtml(url, page) {
  if (config.useHttp) {
    const html = await fetchUrl(url);
    if (config.delayMs > 0) await sleep(config.delayMs);
    return html;
  }
  await gotoPage(page, url);
  return page.content();
}

function appendNdjson(filePath, records) {
  if (!records.length) return;
  const chunk = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.appendFileSync(filePath, chunk, "utf8");
}

async function main() {
  const regions = parseRegionsFromArgv();
  const horariosPath = path.join(config.outputDir, config.horariosFile);
  const errorsPath = path.join(config.outputDir, config.errorsFile);

  const modo = config.useHttp ? "HTTP (sin Chrome)" : "Puppeteer (Chrome)";
  console.log(
    `[scrape] Modo: ${modo}. Regiones: ${regions.map((r) => r[0]).join(", ")}. Delay: ${config.delayMs} ms`
  );
  console.log(
    "[scrape] Fase 1: recorrer ciudades para armar la cola (aquí aún no verás líneas por cooperativa)."
  );

  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(horariosPath, "", "utf8");
  fs.writeFileSync(errorsPath, "", "utf8");

  let browser;
  let page;
  if (!config.useHttp) {
    const puppeteer = require("puppeteer");
    const exe =
      process.env.PUPPETEER_EXECUTABLE_PATH &&
      process.env.PUPPETEER_EXECUTABLE_PATH.trim();
    console.log(
      exe
        ? `[scrape] Abriendo Chrome: ${exe}`
        : "[scrape] Abriendo Chromium incluido con Puppeteer…"
    );
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: exe || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // Evita net::ERR_HTTP2_PROTOCOL_ERROR con algunos hosts / redes
        "--disable-http2",
        "--disable-quic",
      ],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; TerminalGuayaquilScraper/1.0; +educational)"
    );
    console.log("[scrape] Navegador listo.");
  }

  const queue = [];

  try {
    for (const [regionName, listUrl] of regions) {
      console.log(`[${regionName}] Listado regional: ${listUrl}`);
      const listHtml = await loadHtml(listUrl, page);
      const $list = cheerio.load(listHtml);
      const cityJobs = extractCityJobs($list, listUrl, regionName);
      console.log(
        `[${regionName}] ${cityJobs.length} ciudades. Recolectando cooperativas (una petición por ciudad)…`
      );

      let cityIdx = 0;
      for (const job of cityJobs) {
        cityIdx += 1;
        const logEvery = 5;
        if (
          cityIdx === 1 ||
          cityIdx % logEvery === 0 ||
          cityIdx === cityJobs.length
        ) {
          console.log(
            `[${regionName}]   ciudad ${cityIdx}/${cityJobs.length}: ${job.ciudad_destino}`
          );
        }
        const cityHtml = await loadHtml(job.cityPageUrl, page);
        const $city = cheerio.load(cityHtml);
        const coopUrls = extractCoopUrls($city, job.cityPageUrl);
        for (const coopUrl of coopUrls) {
          queue.push({
            region: job.region,
            ciudad_destino: job.ciudad_destino,
            coopUrl,
          });
        }
      }
    }

    const total = queue.length;
    if (total === 0) {
      console.warn(
        "[scrape] Cola vacía: no se encontraron cooperativas. Comprueba conexión o prueba SCRAPE_USE_HTTP=1."
      );
    } else {
      console.log(
        `[scrape] Fase 2: ${total} cooperativas en cola. Extrayendo datos (1 registro por URL, sin listas de horas)…`
      );
    }

    let idx = 0;

    for (const item of queue) {
      idx += 1;
      try {
        const html = await loadHtml(item.coopUrl, page);
        const records = parseSchedulePage(html, {
          region: item.region,
          source_url: item.coopUrl,
          ciudad_fallback: item.ciudad_destino,
        });
        appendNdjson(horariosPath, records);
        const coopName = records[0] && records[0].cooperativa;
        console.log(
          `[${item.region}] (${idx}/${total}) ${item.ciudad_destino} — ${coopName}`
        );
      } catch (err) {
        const payload = {
          region: item.region,
          ciudad_destino: item.ciudad_destino,
          coopUrl: item.coopUrl,
          error: String(err && err.message ? err.message : err),
          scraped_at: new Date().toISOString(),
        };
        fs.appendFileSync(errorsPath, JSON.stringify(payload) + "\n", "utf8");
        console.error(
          `[ERROR] [${item.region}] ${item.ciudad_destino} ${item.coopUrl}: ${payload.error}`
        );
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(`Listo. Datos: ${horariosPath}`);
  if (fs.statSync(errorsPath).size > 0) {
    console.log(`Errores registrados en: ${errorsPath}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
