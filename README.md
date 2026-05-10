# RAG Config 🛠️

Centralized governance and configuration hub for the **Multi-Pass RAG Infrastructure**. This repository serves as the single source of truth for service registration, indexing policies, and global model configurations used by the RAG CLI and retrieval services.

## 🌟 Overview

The `rag-config` repository manages the metadata and rules required to index over 25+ services into our unified vector knowledge base. It ensures consistency across embeddings, namespaces, and chunking strategies, enabling high-precision code retrieval and cross-service dependency mapping.

## 🏗️ Project Structure

```text
rag-config/
├── rag-registry.json       # The core manifest (Services, Templates, Global Config)
├── schemas/                # JSON Schemas for configuration validation
│   └── registry.schema.json
├── scripts/                # Validation and automation utilities
│   └── validate-registry.ts
├── .ragignore.template     # Standard ignore rules for code indexing
└── bitbucket-pipelines.yml # Automated validation on every PR
```

## ⚙️ Core Configuration (`rag-registry.json`)

The registry is divided into three primary sections:

### 1. Global Config (`config`)

Defines the infrastructure endpoints and model parameters:

- **`qdrant_url`**: Endpoint for the Vector Database.
- **`ollama_url`**: Endpoint for the LLM/Embedding engine.
- **`embed_model`**: The model used for generating vector representations (e.g., `nomic-embed-text`).
- **`embed_dimensions`**: Vector size (e.g., `768`). Must match the model's output.
- **`reranker_url`**: Endpoint for the cross-encoder reranking service.

### 2. Templates (`templates`)

Reusable RAG profiles for different service types (e.g., `backend-nestjs`). Templates define:

- **Include/Exclude**: Glob patterns for files to be indexed.
- **Chunking Strategy**: Method for splitting code (e.g., `function`, `ast`).
- **Plugins**: specialized processors like `dependency-graph`, `api-contract`, or `babel`.

### 3. Service Registry (`services`)

An array of services to be indexed. Each entry requires:

- `name`: Human-readable service name.
- `template`: Reference to a defined template.
- `path`: **Absolute path** to the local repository.
- `qdrant_namespace`: Unique collection name in Qdrant.
- `package_json_name`: The exact `name` field from the service's `package.json`.

## 🧪 Validation

To maintain the integrity of the RAG system, all changes must pass validation. This checks both JSON structure (via Ajv) and semantic rules.

```bash
# Install dependencies
npm install

# Run validation suite
npm run validate
```

### Semantic Rules

The validator enforces the following:

- ✅ **Uniqueness**: Service names, Qdrant namespaces, and package names must be unique.
- ✅ **Path Integrity**: Service paths must be absolute and exist on the local filesystem.
- ✅ **Mandatory Fields**: Global config must include `embed_dimensions` and `reranker_url`.

## 🚀 Adding a New Service

1. Clone the service repository to your local machine.
2. Open `rag-registry.json`.
3. Add a new object to the `services` array:
   ```json
   {
     "name": "new-microservice",
     "template": "backend-nestjs",
     "path": "/absolute/path/to/new-microservice",
     "repo_slug": "new-microservice",
     "bounded_context": "payments",
     "package_json_name": "new-service-pkg",
     "type": "backend",
     "primary_framework": "nestjs",
     "qdrant_namespace": "qa__new_microservice"
   }
   ```
4. Run `npm run validate` to ensure the config is correct.
5. Commit and push the changes.

---

> [IMPORTANT]
> Always update `rag-registry.json` when a service is renamed, moved, or a new bounded context is introduced. Misconfigurations here can lead to stale or fragmented knowledge in the RAG system.
