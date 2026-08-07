# Architecture

Technical decisions, stack, and structural patterns for ClinicOS.

**See:** [05-ARCHITECTURE.md](./05-ARCHITECTURE.md) for the complete architectural specification.

## Current Technology Stack

- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Code Quality**: ESLint, Prettier

## Project Structure

```
/components      - React components and UI
/lib             - Utilities and helper functions
/types           - TypeScript type definitions
/styles          - Global styles
/docs            - Documentation
/app             - Next.js App Router pages and layouts
/public          - Static assets
```

## Architecture Principles

1. **Simplicity first** — The best architecture allows the platform to be maintained and evolved with minimal team size
2. **One person maintainability** — Preferring standard, well-documented solutions over clever, difficult ones
3. **Consistency** — Same patterns across all Areas and components
4. **Declarative over imperative** — Clear intent over hidden complexity

## Building New Features

Before implementing:
1. Check [07-BUILD_PLAN.md](./07-BUILD_PLAN.md) for the construction phase and priority
2. Review [DECISIONS.md](./DECISIONS.md) for existing decisions that may apply
3. Consult the specific architectural section in [05-ARCHITECTURE.md](./05-ARCHITECTURE.md)

## Notes for Evolution

This document will grow as the codebase matures. Technical decisions should be recorded in [DECISIONS.md](./DECISIONS.md) with their rationale and date.
