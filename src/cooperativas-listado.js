const cheerio = require("cheerio");

const LISTADO_URL =
  "https://www.terminal-guayaquil.com/listado-cooperativas-terminal-guayaquil.php";

/**
 * Quita prefijos habituales para comparar nombres.
 */
function stripCoopPrefixes(s) {
  let x = String(s || "")
    .trim()
    .replace(/\s+/g, " ");
  const patterns = [
    /^(cooperativa|coop\.?)\s+/i,
    /^(transportes|transporte)\s+/i,
    /^trans\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of patterns) {
      const n = x.replace(p, "").trim();
      if (n !== x) {
        x = n;
        changed = true;
      }
    }
  }
  return x;
}

function foldAccents(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeForMatch(s) {
  return foldAccents(stripCoopPrefixes(s)).replace(/\./g, "");
}

/**
 * @param {string} html
 * @param {string} listPageUrl
 * @returns {{ nombre: string, imagen_url: string }[]}
 */
function parseCooperativasCatalog(html, listPageUrl) {
  const $ = cheerio.load(html);
  const base = new URL(listPageUrl);
  const catalog = [];

  $("div.card.w-100.shadow-hover-3").each((_, el) => {
    const $card = $(el);
    const $img = $card.find("img.card-img-top").first();
    const $title = $card.find("h2 a.card-title, a.card-title").first();
    const nombre = $title.text().replace(/\s+/g, " ").trim();
    const src = ($img.attr("src") || "").trim();
    if (!nombre || !src) return;
    try {
      const imagen_url = new URL(src, base).href;
      catalog.push({ nombre, imagen_url });
    } catch {
      /* ignore */
    }
  });

  return catalog;
}

function tokenSet(s) {
  return new Set(
    normalizeForMatch(s)
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter++;
  }
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function levenshteinRatio(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const d = levenshtein(na, nb);
  return 1 - d / Math.max(na.length, nb.length);
}

/**
 * @param {string} nombreData nombre en horarios.ndjson (cooperativa)
 * @param {{ nombre: string, imagen_url: string }[]} catalog
 * @param {{ minScore?: number }} opts
 * @returns {{ imagen_url: string, nombre_listado: string, score: number } | null}
 */
function findBestCooperativaMatch(nombreData, catalog, opts = {}) {
  const minScore = opts.minScore ?? 52;
  let best = null;

  const nd = normalizeForMatch(nombreData);
  if (!nd) return null;

  for (const item of catalog) {
    const nl = normalizeForMatch(item.nombre);
    if (!nl) continue;

    let score = 0;
    if (nd === nl) {
      score = 100;
    } else if (nd.includes(nl) || nl.includes(nd)) {
      score =
        88 +
        (Math.min(nd.length, nl.length) / Math.max(nd.length, nl.length)) * 10;
    } else {
      const jac = jaccard(nombreData, item.nombre);
      if (jac >= 0.34) {
        score = 55 + jac * 38;
      }
      const lev = levenshteinRatio(nombreData, item.nombre);
      score = Math.max(score, lev * 72);
    }

    if (!best || score > best.score) {
      best = {
        imagen_url: item.imagen_url,
        nombre_listado: item.nombre,
        score,
      };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

module.exports = {
  LISTADO_URL,
  parseCooperativasCatalog,
  findBestCooperativaMatch,
  normalizeForMatch,
  stripCoopPrefixes,
};
