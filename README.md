# 🚌 Data Terminal Terrestre Guayaquil

Herramientas en **Node.js** para extraer información pública de cooperativas, rutas, contactos y sitio web desde la página oficial del [Terminal Terrestre de Guayaquil](https://www.terminal-guayaquil.com/horarios-terminal-guayaquil.php) (regiones **Costa** y **Sierra**). Los datos se guardan en NDJSON/JSON para alimentar otras aplicaciones.

---

## ✨ Qué obtienes

Por cada cooperativa (una fila por URL de horarios):

| Campo | Descripción |
|--------|-------------|
| 🗺️ `region` | `Costa` o `Sierra` |
| 🏙️ `ciudad_destino` | Ciudad de destino |
| 🏢 `cooperativa` | Nombre de la cooperativa |
| 🛣️ `ruta` | Descripción de ruta (incluye sub-rutas del sitio o destino terminal) |
| 📍 `con_destino` | Texto “Con destino a: …” (terminal) |
| 🌐 `pagina_web` | URL del botón “Visitar Web” |
| 📱 `whatsapp` | WhatsApp (texto visible) |
| ☎️ `telefono` | Teléfono |
| ✉️ `email` | Correo |
| 🔗 `source_url` | Página origen en terminal-guayaquil.com |
| 🕐 `scraped_at` | Fecha ISO del scrape |

No se almacenan listas de horas sueltas; el foco es metadatos de ruta y contacto.

---

## 📋 Requisitos

- **Node.js** `16.20.2` (recomendado; ver `engines` en `package.json`)
- Conexión a Internet

---

## 🚀 Instalación

```bash
cd data-terminal-terrestre
npm install
```

La primera vez con **Puppeteer**, si hace falta Chromium:

```bash
node node_modules/puppeteer/install.js
```

---

## 🎮 Uso principal (CLI unificada)

El script definitivo es **`scripts/terminal-scrape.js`**:

```bash
npm run terminal -- <comando> [opciones]
# o
node scripts/terminal-scrape.js <comando> [opciones]
```

### Comandos

| Comando | Icono | Acción |
|---------|--------|--------|
| `full` o `scrape` | 🔍 | Barrido completo: listados regionales → ciudades → páginas de cooperativas. Escribe `data/horarios.ndjson`. Por defecto usa **HTTP** (sin navegador). |
| `refresh` | 🔄 | Vuelve a descargar cada **URL única** del NDJSON actual y reescribe el archivo con el mismo esquema. |
| `repair` | 🛠️ | Corrige filas con cooperativa `"Desconocida"` leyendo el `h1` de la página. |
| `to-json` | 📄 | Genera `data/horarios.json` a partir del NDJSON. |

### Opciones (`full` / `scrape`)

- `--region=costa` | `sierra` | `all` (por defecto: **all**)
- `--browser` — usa **Puppeteer + Chrome** en lugar de HTTP (útil si HTTP falla en tu red)
- `--delay=600` — milisegundos entre peticiones (por defecto **600**; también `SCRAPE_DELAY_MS`)

### Ejemplos

```bash
# Ayuda
npm run terminal -- --help

# Barrido completo (recomendado)
npm run terminal -- full

# Solo Sierra, más pausa
npm run terminal -- full --region=sierra --delay=800

# Con navegador headless
npm run terminal -- full --browser

# Actualizar datos ya descargados
npm run terminal -- refresh

# Reparar nombres
npm run terminal -- repair

# Exportar JSON bonito
npm run terminal -- to-json
```

---

## 📁 Salida

| Archivo | Descripción |
|---------|-------------|
| `data/horarios.ndjson` | Una línea JSON por cooperativa (streaming / append). |
| `data/horarios.json` | Array completo (tras `to-json`). |
| `data/errors.ndjson` | Errores por URL durante el barrido (si ocurren). |

`.gitignore` puede ignorar `*.ndjson` / `horarios.json` si no quieres versionar datos.

---

## 🧩 Scripts npm (alternativos)

Puedes seguir llamando los módulos directamente:

| Script | Descripción |
|--------|-------------|
| `npm run terminal` | CLI unificada (recomendado). |
| `npm run scrape` | Solo `src/scrape.js` (respeta `SCRAPE_USE_HTTP`). |
| `npm run scrape:http` | Scrape forzando HTTP. |
| `npm run refresh:data` | Solo refresh. |
| `npm run repair:desconocidas` | Solo repair. |
| `npm run ndjson-to-json` | Solo conversión a JSON. |

---

## 🗂️ Estructura del código

```
├── scripts/
│   ├── terminal-scrape.js   # 🎯 Entrada principal
│   └── ndjson-to-json.js
├── src/
│   ├── scrape.js            # Barrido completo
│   ├── refresh-from-web.js  # Regenerar desde URLs
│   ├── repair-desconocidas.js
│   ├── parser.js            # Cheerio: h1, rutas, contactos, web
│   ├── http-fetch.js        # GET + redirecciones
│   └── config.js
└── data/
    └── …
```

---

## ⚠️ Notas

- Usa la herramienta con **criterio**: respeta la carga del servidor (delays razonables).
- El HTML del sitio puede cambiar; los selectores viven sobre todo en `src/parser.js`.
- Si ves `net::ERR_HTTP2_PROTOCOL_ERROR` con Chrome, el modo **HTTP** (`full` sin `--browser`) suele evitar el problema.

---

## 📜 Licencia

Uso del proyecto bajo tu propia responsabilidad; los datos pertenecen a sus respectivos titulares (Terminal / cooperativas).
