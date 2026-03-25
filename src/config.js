const path = require("path");

const BASE_URL = "https://www.terminal-guayaquil.com";

module.exports = {
  BASE_URL,
  REGION_PAGES: {
    Costa: `${BASE_URL}/destinos-costa-terminal-guayaquil.php`,
    Sierra: `${BASE_URL}/destinos-sierra-terminal-guayaquil.php`,
  },
  /**
   * Si es true, usa solo HTTPS (sin Chromium). Útil en CI o si Puppeteer no arranca.
   * Activa con: SCRAPE_USE_HTTP=1
   */
  useHttp: process.env.SCRAPE_USE_HTTP === "1",
  /** Retraso entre peticiones (ms) */
  delayMs: Number(process.env.SCRAPE_DELAY_MS) || 600,
  outputDir: path.join(__dirname, "..", "data"),
  horariosFile: "horarios.ndjson",
  errorsFile: "errors.ndjson",
};
