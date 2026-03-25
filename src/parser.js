const cheerio = require("cheerio");

function normalizeSpace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parseH1($) {
  let $h1 = $("div.mb-1 h1.font-size-23").first();
  if (!$h1.length) $h1 = $("div.mb-1 h1").first();
  if (!$h1.length) $h1 = $("h1.font-size-23").first();
  if (!$h1.length) $h1 = $("h1").first();
  if (!$h1.length) return { cooperativa: null, ciudad_destino: null };

  const text = normalizeSpace($h1.text());

  let m = text.match(/^Horarios\s+(.+?)\s+a\s+(.+?)\s+desde\s+Guayaquil$/i);
  if (m) {
    return { cooperativa: m[1].trim(), ciudad_destino: m[2].trim() };
  }
  m = text.match(/^(.+?)\s+horarios\s+a\s+(.+?)\s+desde\s+Guayaquil$/i);
  if (m) {
    return { cooperativa: m[1].trim(), ciudad_destino: m[2].trim() };
  }
  return { cooperativa: null, ciudad_destino: null };
}

/** Parsea solo el título (cooperativa / ciudad) desde el HTML de una página horarios-coop. */
function parseCoopTitleFromHtml(html) {
  const $ = cheerio.load(html);
  return parseH1($);
}

/**
 * Texto "Con destino a: …" y URL de "Visitar Web".
 */
function parsePageExtras($) {
  let con_destino = null;
  const $direct = $("a.ml-1.d-block.d-md-inline").first();
  if ($direct.length) {
    const t = normalizeSpace($direct.text());
    if (t) con_destino = t;
  }
  if (!con_destino) {
    $("div.d-block.d-md-flex, div.flex-horizontal-center").each((_, el) => {
      const $el = $(el);
      if (!/Con destino a:/i.test($el.text())) return;
      const $a = $el.find("a").first();
      const t = normalizeSpace($a.text());
      if (t) {
        con_destino = t;
        return false;
      }
    });
  }

  let pagina_web = null;
  $("button").each((_, el) => {
    const label = normalizeSpace($(el).text());
    if (!/^visitar web$/i.test(label)) return;
    const href = $(el).closest("a").attr("href");
    if (href && /^https?:\/\//i.test(href)) {
      pagina_web = href.trim();
      return false;
    }
  });

  return { con_destino, pagina_web };
}

function parsePageExtrasFromHtml(html) {
  const $ = cheerio.load(html);
  return parsePageExtras($);
}

/**
 * Whatsapp, teléfono y e-mail del bloque cuyo h3 empieza por "Contactos".
 */
function parseContactos($) {
  const out = { whatsapp: null, telefono: null, email: null };

  $("h3.font-size-21").each((_, h) => {
    const ht = normalizeSpace($(h).text());
    if (!/^contactos\b/i.test(ht)) return;

    let $el = $(h).next();
    while ($el.length && !$el.is("h3")) {
      if ($el.hasClass("flex-horizontal-center")) {
        const line = normalizeSpace($el.text());
        const $a = $el.find("a").first();
        const linkText = normalizeSpace($a.text());
        const href = ($a.attr("href") || "").trim();

        if (/whatsapp/i.test(line)) {
          out.whatsapp = linkText || href || null;
        } else if (/tel[eé]fono/i.test(line)) {
          out.telefono =
            linkText || (href ? href.replace(/^tel:/i, "") : null) || null;
        } else if (/e-?mail|correo/i.test(line)) {
          out.email =
            linkText || (href ? href.replace(/^mailto:/i, "") : null) || null;
        }
      }
      $el = $el.next();
    }
    return false;
  });

  return out;
}

/**
 * Bloques "Horarios de salidas" / "Horarios de salidas ruta: …" (solo el nombre de ruta del sitio).
 */
function parseScheduleRouteBlocks($) {
  const blocks = [];
  $("div.border-bottom.position-relative").each((_, el) => {
    const $div = $(el);
    const h3Text = normalizeSpace($div.find("h3").first().text());
    if (!/^Horarios de salidas/i.test(h3Text)) return;

    let ruta = null;
    if (/Horarios de salidas ruta:/i.test(h3Text)) {
      ruta = h3Text.replace(/^Horarios de salidas ruta:\s*/i, "").trim() || null;
    } else if (!/^Horarios de salidas:?$/i.test(h3Text)) {
      return;
    }

    blocks.push({ ruta });
  });
  return blocks;
}

/**
 * Una sola línea descriptiva de ruta: rutas nombradas del sitio, o terminal, o ciudad.
 */
function buildRutaDescripcion(blocks, con_destino, ciudad_destino) {
  const named = [...new Set(blocks.map((b) => b.ruta).filter(Boolean))];
  if (named.length > 0) {
    return named.join(" | ");
  }
  if (con_destino) {
    return `${con_destino} → ${ciudad_destino}`;
  }
  return `A ${ciudad_destino} desde Guayaquil`;
}

/**
 * Un registro por página cooperativa (sin listas de horarios).
 * @param {string} html
 * @param {{ region: string, source_url: string, ciudad_fallback: string }} ctx
 * @returns {object[]}
 */
function parseSchedulePage(html, ctx) {
  const $ = cheerio.load(html);
  const { cooperativa, ciudad_destino } = parseH1($);
  const city = ciudad_destino || ctx.ciudad_fallback;
  const coop = cooperativa || "Desconocida";
  const blocks = parseScheduleRouteBlocks($);
  const { con_destino, pagina_web } = parsePageExtras($);
  const { whatsapp, telefono, email } = parseContactos($);
  const scraped_at = new Date().toISOString();

  const ruta = buildRutaDescripcion(blocks, con_destino, city);

  return [
    {
      region: ctx.region,
      ciudad_destino: city,
      cooperativa: coop,
      ruta,
      con_destino,
      pagina_web,
      whatsapp,
      telefono,
      email,
      source_url: ctx.source_url,
      scraped_at,
    },
  ];
}

module.exports = {
  parseSchedulePage,
  parseCoopTitleFromHtml,
  parsePageExtrasFromHtml,
  normalizeSpace,
};
