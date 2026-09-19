# Verification notes

The project source was prepared for Next.js 16.3.3 and React 19.3.0.

In the build environment used to create this archive, `npm install` could not complete because package registry access timed out. A TypeScript parser/syntax pass was run against the project source; no syntax errors were found after excluding the expected missing-module diagnostics caused by dependencies not being installed.

Run these commands on a machine with npm registry access:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

If all four verification commands succeed, the project is ready for Git and Vercel deployment.
