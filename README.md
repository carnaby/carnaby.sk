# carnaby.sk v2

A modern rewrite of the carnaby.sk platform using a monorepo architecture with **pnpm** and **Nx**.

## Stack

- **Monorepo**: pnpm workspace + Nx for task orchestration
- **Web**: Next.js 
- **API**: NestJS with tRPC
- **Database**: PostgreSQL with migrations
- **Package Manager**: pnpm

## Monorepo Layout

```
apps/
  ├── web/        # Next.js frontend application
  └── api/        # NestJS backend API
packages/
  ├── shared/     # Shared utilities and types
  └── db/         # Database schema and migrations
tools/
  └── migrate-legacy/  # Legacy data migration utilities
```

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start the development environment**:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   pnpm dev
   ```

3. **Build for production**:
   ```bash
   pnpm build
   ```

## Available Scripts

- `pnpm dev` - Start development servers (web + api)
- `pnpm build` - Build all applications
- `pnpm test` - Run tests across the workspace
- `pnpm lint` - Lint code
- `pnpm typecheck` - Check TypeScript types

## Documentation

- See `.superpowers/sdd/` for the implementation spec and detailed planning documents
- Legacy codebase: See `carnaby-sk-origin` branch for v1 history

## Environment Configuration

Copy `.env.example` to `.env` and configure your local environment variables. For database and API configuration details, see the API documentation.
