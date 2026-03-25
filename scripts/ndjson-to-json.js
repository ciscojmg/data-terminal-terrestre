const fs = require("fs");
const path = require("path");

function main() {
  const src = path.join(__dirname, "..", "data", "horarios.ndjson");
  const out = path.join(__dirname, "..", "data", "horarios.json");

  if (!fs.existsSync(src)) {
    console.error("No existe:", src);
    process.exit(1);
  }

  const raw = fs.readFileSync(src, "utf8").trim();
  const lines = raw ? raw.split("\n").filter(Boolean) : [];
  const data = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      throw new Error(`Línea ${i + 1}: ${e.message}`);
    }
  });

  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  console.log("Registros:", data.length);
  console.log("Escrito:", out);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = { main };
