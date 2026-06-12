# Contributing to GlyphConnect

**Note:** This project is now complete (v1.0.0) and is no longer under active development. New feature contributions and pull requests are generally no longer accepted, though critical bug fixes may still be considered.

Thank you for taking the time to read this. This document covers the development workflow, branch strategy, and code standards used during the active development phase.

---

## Development Workflow

1. Fork the repository and clone your fork
2. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
3. Make your changes and test locally (`npm run dev`)
4. Commit using [Conventional Commits](#commit-messages)
5. Push your branch and open a Pull Request against `main`

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

Optional longer body explaining what and why.
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `chore` | Tooling, deps, config |
| `docs` | Documentation only |
| `test` | Adding or updating tests |

Examples:

```
feat(auth): add Google OAuth2 sign-in flow
fix(electron): clear localStorage tokens on before-quit
docs(readme): update local setup instructions
chore(deps): bump electron from 28.3.3 to 28.4.0
```

---

## Branch Naming

| Pattern | Purpose |
|---|---|
| `feat/short-description` | New feature |
| `fix/short-description` | Bug fix |
| `chore/short-description` | Tooling or dependency updates |
| `docs/short-description` | Documentation changes |

---

## What Not to Commit

The `.gitignore` already covers most of these, but always double-check before pushing:

- `.env` files in any directory — they contain secrets
- `dist/` or `build/` compiled output
- `node_modules/`
- `*.zip` archives
- `GoogleAuthID.json` or any credentials file
- `*.pem` key files

Run `git status` before every commit to confirm.

---

## Code Style

- TypeScript strict mode is enabled — no `any` types without a comment explaining why
- Functional React components with hooks — no class components
- All new files should have a comment at the top explaining their purpose
- Keep IPC handlers in `backend/src/main.ts` at the module level, not inside `createWindow()`

---

## Reporting Issues

Open a GitHub Issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS, Node version, and Electron version