# RAG Config

Central configuration for code RAG system.

## Files

- rag-registry.json → service registry
- .ragignore.template → indexing rules
- schemas/ → validation schemas

## Rules

- Every service must be registered
- Namespaces must be unique
- package_json_name must match repo

## Validation

Run:
npm run validate
