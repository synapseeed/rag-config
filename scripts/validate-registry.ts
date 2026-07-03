const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const registryPath = path.join(__dirname, "../rag-registry.json");
const schemaPath = path.join(__dirname, "../schemas/registry.schema.json");

// ─── Schema validation ────────────────────────────────────────────────────────

function validate() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const validateFn = ajv.compile(schema);
  const valid = validateFn(registry);

  if (!valid) {
    console.error("❌ Registry validation failed:\n");
    validateFn.errors.forEach((e) => {
      console.error(`  • ${e.instancePath || "root"} — ${e.message}`);
    });
    process.exit(1);
  }

  return registry;
}

// ─── Semantic checks ──────────────────────────────────────────────────────────

function semanticChecks(registry) {
  const names = new Set();
  const namespaces = new Set();
  const packageNames = new Set();
  const paths = new Set();
  const errors: any[] = [];

  registry.services.forEach((service) => {
    // Duplicate name
    if (names.has(service.name)) {
      errors.push(`Duplicate service name: "${service.name}"`);
    }
    names.add(service.name);

    // Duplicate qdrant_namespace
    if (namespaces.has(service.qdrant_namespace)) {
      errors.push(
        `Duplicate qdrant_namespace: "${service.qdrant_namespace}" (in ${service.name})`
      );
    }
    namespaces.add(service.qdrant_namespace);

    // Duplicate package_json_name
    if (packageNames.has(service.package_json_name)) {
      errors.push(
        `Duplicate package_json_name: "${service.package_json_name}" (in ${service.name})`
      );
    }
    packageNames.add(service.package_json_name);

    // Duplicate path
    if (paths.has(service.path)) {
      errors.push(
        `Duplicate service path: "${service.path}" (in ${service.name})`
      );
    }
    paths.add(service.path);

    // Path must be absolute
    if (!path.isAbsolute(service.path)) {
      errors.push(
        `service.path must be absolute, got "${service.path}" (in ${service.name})`
      );
    }

    // Path must exist on disk
    if (!fs.existsSync(service.path)) {
      errors.push(
        `service.path does not exist on disk: "${service.path}" (in ${service.name})`
      );
    }

    // embedding.dimensions must be set (easy to forget, causes silent failures)
    if (!registry.config.embedding || !registry.config.embedding.dimensions) {
      errors.push(
        `config.embedding.dimensions is missing — required for Qdrant collection creation`
      );
    }

    // reranker_url must be set
    if (!registry.config.reranker_url) {
      errors.push(
        `config.reranker_url is missing — required by search and ask commands`
      );
    }

    // embedding provider must not be anthropic (no embeddings API)
    if (registry.config.embedding && registry.config.embedding.provider === "anthropic") {
      errors.push(
        `config.embedding.provider cannot be "anthropic" — Anthropic has no embeddings API. Use "ollama", "lmstudio", or "openai".`
      );
    }
  });

  if (errors.length > 0) {
    console.error("❌ Semantic validation failed:\n");
    errors.forEach((e) => console.error(`  • ${e}`));
    process.exit(1);
  }
}

// ─── Secret-leak check ────────────────────────────────────────────────────────
// rag-registry.json is committed to git and reviewed in PRs. Config must only
// ever reference an *env var name* (config.llm.api_key_env / config.embedding.api_key_env),
// never a literal API key. This walks every string value in the file, not just
// the api_key_env fields, in case a key gets pasted into model/base_url by mistake.

const SECRET_PATTERNS = [
  /^sk-ant-[A-Za-z0-9_-]{20,}$/, // Anthropic-style
  /^sk-[A-Za-z0-9_-]{20,}$/, // OpenAI-style
  /^[A-Fa-f0-9]{32,}$/, // long hex token
  /^[A-Za-z0-9+/]{40,}={0,2}$/, // long base64 token
];

function looksLikeSecret(value: unknown): boolean {
  return typeof value === "string" && SECRET_PATTERNS.some((re) => re.test(value.trim()));
}

function secretLeakCheck(registry: any) {
  const errors: string[] = [];

  function walk(node: any, pathStr: string) {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      if (looksLikeSecret(node)) {
        errors.push(
          `Value at ${pathStr} looks like a literal secret, not an env var name. ` +
            `rag-registry.json must never contain literal API keys — use config.llm.api_key_env / ` +
            `config.embedding.api_key_env to name an env var instead.`
        );
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${pathStr}[${i}]`));
      return;
    }
    if (typeof node === "object") {
      Object.entries(node).forEach(([key, value]) => walk(value, `${pathStr}.${key}`));
    }
  }

  walk(registry, "$");

  if (errors.length > 0) {
    console.error("❌ Secret-leak check failed:\n");
    errors.forEach((e) => console.error(`  • ${e}`));
    process.exit(1);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const registry = validate();
semanticChecks(registry);
secretLeakCheck(registry);
console.log(
  `✅ rag-registry.json is valid (${registry.services.length} service(s))`
);
