// Charge les variables d'environnement depuis .env (local) puis ../.env (parent)
// sans écraser celles déjà définies. Permet de placer la clé LLMaaS dans l'un
// ou l'autre fichier. Le programme lit sa propre config ; rien n'est affiché.
const fs = require("node:fs");
const path = require("node:path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", ".env")
  ];
  for (const file of candidates) {
    const vars = parseEnvFile(file);
    for (const [k, v] of Object.entries(vars)) {
      if (process.env[k] === undefined || process.env[k] === "") {
        process.env[k] = v;
      }
    }
  }
}

module.exports = { loadEnv, parseEnvFile };
