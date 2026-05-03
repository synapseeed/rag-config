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

    // embed_dimensions must be set (easy to forget, causes silent failures)
    if (!registry.config.embed_dimensions) {
      errors.push(
        `config.embed_dimensions is missing — required for Qdrant collection creation`
      );
    }

    // reranker_url must be set
    if (!registry.config.reranker_url) {
      errors.push(
        `config.reranker_url is missing — required by search and ask commands`
      );
    }
  });

  if (errors.length > 0) {
    console.error("❌ Semantic validation failed:\n");
    errors.forEach((e) => console.error(`  • ${e}`));
    process.exit(1);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const registry = validate();
semanticChecks(registry);
console.log(
  `✅ rag-registry.json is valid (${registry.services.length} service(s))`
);
