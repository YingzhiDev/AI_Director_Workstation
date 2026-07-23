# Security Boundary

The primary release rule for this repository is that public showcase code must never become a channel for accessing DirectorWorkspace's private knowledge assets or production credentials.

## Content excluded from the public repository

- Private knowledge bases, training or curation data, and database files.
- Private source mappings, research reports, review material, and generation scripts.
- Production API keys, database credentials, deployment metadata, and local environment files.
- Local uploads, generation history, asset records, and build output.
- Private repository `.git` history.

## Public-edition safeguards

- Rebuild from an allowlist of public files instead of copying a private repository and deleting selected material afterward.
- Use an independent public showcase runtime and `SHOWCASE-*` categories.
- Resolve model connections from server-side environment variables; the frontend never reads the default API key.
- Exclude local data directories, environment files, and build directories in `.gitignore`.
- Run `npm run security:check` to identify dangerous directories, file types, absolute paths, and common credential patterns.

## Deployment note

Create a separate public Vercel project. Do not reuse the complete product's project configuration, database workspace, or private Git history. Configure model credentials only through Vercel environment variables.
