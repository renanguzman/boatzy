<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Feature Development Protocol

Before implementing any new feature or functionality:
1. Read `PRD.md` to understand product requirements and priorities.
2. Read `SPEC.md` to understand technical specifications and contracts.

After implementing each feature:
1. Update `SPEC.md` to reflect any new or changed technical details (endpoints, data models, component interfaces, etc.).
2. Update `PRD.md` to mark the feature as implemented and note any scope changes or decisions made during implementation.

Keep both files as the source of truth — they should always reflect the current state of the product.
