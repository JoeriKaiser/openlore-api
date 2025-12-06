# Code Style Guide

## Core Principles

- **Concise over verbose** - less code, same functionality
- **DRY** - extract patterns into reusable utilities
- **Let TypeScript infer** - only annotate when necessary

---

## Do
```typescript
// Arrow functions for simple operations
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Early returns
if (!user) return unauthorized();
if (!id) return badRequest("Invalid id");

// Ternary for simple conditionals
return row ? json(row) : notFound();

// Destructuring
const { key } = await getUserKey(id);
const [row] = await db.select()...

// Filter falsy values
const parts = [a, b, c].filter(Boolean);

// Inline catch for simple cases
const body = await readJson(req).catch(() => ({}));

// Fire-and-forget with void
void indexCharacterBio({ userId, ...row });

// Nullish coalescing
const port = config.port ?? 3000;
```

## Don't
```typescript
// ❌ Unnecessary type annotations
const getName = (user: User): string => user.name;

// ❌ Deep nesting
if (user) { if (valid) { if (row) { return json(row); } } }

// ❌ Verbose conditionals
if (row !== null && row !== undefined) { return json(row); }

// ❌ Redundant null checks
const value = alreadyNullable ?? null;

// ❌ Copy-paste CRUD - use factories instead
```

---

## Patterns

| Pattern | Example |
|---------|---------|
| Single row query | `const [row] = await db.select()...` |
| Optional chaining | `body.model?.trim() \|\| defaultModel` |
| Spread conditions | `where(and(...conds))` |
| Promise chaining | `void deleteX().then(() => indexY())` |

---

## Naming

| Type | Style | Example |
|------|-------|---------|
| Files | kebab-case | `user-service.ts` |
| Functions | camelCase | `getUserKey` |
| Types | PascalCase | `SourceType` |
| Booleans | is/has/can | `isProd`, `hasKey` |

---

## File Structure

- **controllers/** - request handlers, business logic
- **routes/** - route registration only, no logic
- **utils/** - pure helper functions
- **lib/** - shared config and domain logic
