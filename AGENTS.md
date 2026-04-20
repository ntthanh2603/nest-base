# Nest-Base Guide for AI Agents

High-performance NestJS backend template.

## Essential Commands

```bash
# Development
npm run start:dev       # Start dev server with watch mode
task dev                # Start stack (if using taskfile)

# Testing
npm run test           # Run unit tests
npm run test:cov       # Run unit tests with coverage
npm run test:e2e       # Run E2E tests

# Database
npm run migration:run  # Run migrations
npm run migration:generate -- -n Name  # Generate migration

# Linting
npm run lint           # Check and fix lint issues
```

## Quick Coding Rules
- **No `any`**: Strictly forbidden. Use types or `unknown`.
- **Comments**: MANDATORY JSDoc for all methods and internal step-by-step logic comments.
- **DTOs**: Always validate inputs with `class-validator`.
- **Kafka**: Use `KafkaTopic` enum for topic names.
- **Errors**: Throw custom exceptions from `@/commons/exceptions`.
- **Documentation**: Use `@Doc()` for all controller methods.

## Agent Personas (Behavior Roles)

You should adopt these personas based on the task context:

- **Code Review**: Focus on type safety (No `any`), consistent patterns, and logic correctness.
- **Security Auditor**: Focus on Auth config, RBAC guards, and S3 presigned URL security.
- **DB Architect**: Focus on schema design, query optimization (N+1 prevention), and transaction atomicity.
- **Integration/Kafka**: Focus on Claim Check pattern for payloads and DLQ implementation.
- **Testing Specialist**: Target 80%+ coverage for critical services.

## 🛠 Key Workflows

| Task | Workflow File | Focus |
| :--- | :--- | :--- |
| Developing new API | `.agents/workflows/api.md` | Design, DTOs, @Doc, Migrations |
| Troubleshooting/Bugfix | `.agents/workflows/bugfix.md` | Root cause, Regression |
| Code Optimization | `.agents/workflows/refactor.md` | Clean code, No behavior change |
| CI/CD & Pipeline | `.agents/workflows/ci-cd.md` | Deployment, Perf |
| Testing | `.agents/workflows/test.md` | 80%+ Coverage, TDD |
| Self-Improvement | `.agents/workflows/self-improvement.md` | Reflective analysis, Rule updates |
| PR Review | `.agents/workflows/pr-review.md` | Final quality & style check |

## Key Paths
- **Workflows**: `.agents/workflows/*.md`
- **Skills**: `.agents/skills/*.md`
- **Architecture Map**: `.agents/ARCHITECTURE.md`

---
> [!TIP]
> **To the Agent**: Always reference this file at the start of every session to ensure perfect alignment with project standards.
