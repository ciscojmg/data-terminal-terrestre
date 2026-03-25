const http = require("http");
const https = require("https");

/**
 * GET HTML siguiendo redirecciones (sin dependencias extra).
 */
function fetchUrl(urlString) {
  return new Promise((resolve, reject) => {
    const maxRedirects = 10;

    function doRequest(url, depth) {
      if (depth > maxRedirects) {
        reject(new Error("Demasiadas redirecciones"));
        return;
      }
      let u;
      try {
        u = new URL(url);
      } catch (e) {
        reject(e);
        return;
      }
      const lib = u.protocol === "https:" ? https : http;
      const opts = {
        hostname: u.hostname,
        path: u.pathname + u.search,
        port: u.port || undefined,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; TerminalGuayaquilScraper/1.0)",
          Accept: "text/html,*/*",
        },
      };

      const req = lib.request(opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          doRequest(new URL(res.headers.location, url).href, depth + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.end();
    }

    doRequest(urlString, 0);
  });
}

module.exports = fetchUrl;
