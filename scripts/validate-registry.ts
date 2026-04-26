const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const registryPath = path.join(__dirname, "../rag-registry.json");
const schemaPath = path.join(__dirname, "../schemas/registry.schema.json");

function validate() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(registry);

  if (!valid) {
    console.error("❌ Registry validation failed:\n");
    console.error(validate.errors);
    process.exit(1);
  }

  console.log("✅ rag-registry.json is valid");
  return registry;
}

function semanticChecks(registry) {
  const names = new Set();
  const namespaces = new Set();
  const packageNames = new Set();

  registry.services.forEach((service) => {
    if (names.has(service.name)) {
      throw new Error(`Duplicate service name: ${service.name}`);
    }
    names.add(service.name);

    if (namespaces.has(service.qdrant_namespace)) {
      throw new Error(`Duplicate namespace: ${service.qdrant_namespace}`);
    }
    namespaces.add(service.qdrant_namespace);

    if (packageNames.has(service.package_json_name)) {
      throw new Error(
        `Duplicate package_json_name: ${service.package_json_name}`
      );
    }
    packageNames.add(service.package_json_name);
  });
}

const registry = validate();
semanticChecks(registry);
