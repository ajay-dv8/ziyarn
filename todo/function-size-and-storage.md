# Function Size & Knowledge Storage — Deferred TODO

**Created:** 2026-11-14
**Status:** Deferred. Do when function size, cold starts, or storage cost becomes a problem.
**Scope:** Vercel function tracing and knowledge-file storage (Vercel Blob, local disk, R2).

## Why this exists

The root `@repo/api` barrel import was pulling the knowledge/PDF stack into dashboard
functions. That one fix is done, but the knowledge and chat functions are still large
because they import the full knowledge service.

Local production build after the barrel fix:

| Function | Traced size |
|---|---:|
| `/dashboard/knowledge` | 43.3 MB |
| `/api/chat` | 41.1 MB |
| `/api/knowledge/upload` | 39.3 MB |
| `/api/knowledge/crawl` | 39.3 MB |
| `/api/knowledge/[id]/file` | 39.3 MB |
| `/api/knowledge/[id]` | 39.3 MB |
| Normal dashboard pages | 8.8–9.0 MB |

Cause: `apps/web/services/knowledge-service.ts` imports `createKnowledgeService`, whose
module imports the PDF/XLSX/DOCX extraction stack and the crawler at the top level.
Every route that imports the service traces all of it, even when it only calls
`listDocuments`, `queryKnowledge`, `getFile`, or `deleteDocument`.

The native `@napi-rs/canvas` / `skia.linux-x64-gnu.node` binary is about 30 MB of that.

## Already done

- [x] Remove the root barrel import in `apps/web/lib/actions/domains.ts`.
  - `DomainServiceError` now comes from `@repo/api/domains`.
  - `PlanLimitError` now comes from `@repo/api/plans`.
  - Local build result: dashboard pages 42–43 MB → 8.8–9.0 MB; total traced files
    ~1.27 GB → ~0.71 GB; functions over 40 MB: 19 → 2.
  - The change was uncommitted at the time of writing. Deploy it and confirm the Vercel
    function-size numbers before treating this as closed.

---

## A. Split knowledge read paths from upload/crawl (do this first)

**Why first:** no database or storage migration; removes the PDF stack from chat,
dashboard listing, file downloads, and document deletion.

Suggested split (adjust names to match the codebase's conventions):

- [ ] Move `KnowledgeServiceError` into a lightweight
      `services/api/src/knowledge/errors.ts` module and expose it through a subpath.
      Read routes currently import `{ KnowledgeServiceError }` from the
      `@repo/api/knowledge` barrel, which also exports the heavy service; importing
      the barrel can still pull the PDF stack into the trace.
- [ ] Create `services/api/src/knowledge/read-server.ts` with only:
      `queryKnowledge`, `listDocuments`, `getFile`, `deleteDocument`, and
      `getCrawlStatus` if it does not pull in the crawler.
      It should import database/schema helpers, storage, and error helpers only.
- [ ] Create a shared `services/api/src/knowledge/ingest.ts` for ownership checks,
      chunk/embed/persist, and other logic shared by upload and crawl. Keep its
      imports limited to what both paths need.
- [ ] Create `services/api/src/knowledge/upload-server.ts` for `uploadDocument` and
      `uploadFile`. Only this module should import `extract.ts` and the PDF/XLSX
      packages.
- [ ] Create `services/api/src/knowledge/crawl-server.ts` for `startCrawl` and the
      crawl runner. It should import the crawler, not `extract.ts`.
- [ ] Keep `services/api/src/knowledge/index.ts` for the ingest/upload/crawl surface,
      or narrow its exports so read paths cannot accidentally import the heavy stack.
      Do not use the knowledge barrel from read routes.
- [ ] Split the web wiring in `apps/web/services/knowledge-service.ts` into read and
      ingest services (two exports or two files), with one shared storage instance.
- [ ] Update callers:
  - [ ] `apps/web/app/api/chat/route.ts` → read service
  - [ ] `apps/web/app/dashboard/knowledge/page.tsx` → read service
  - [ ] `apps/web/app/api/knowledge/[id]/file/route.ts` → read service
  - [ ] `apps/web/app/api/knowledge/[id]/route.ts` → read service
  - [ ] `apps/web/app/api/knowledge/upload/route.ts` → upload service
  - [ ] `apps/web/app/api/knowledge/crawl/route.ts` → crawl service

### Acceptance

- [ ] `pnpm --filter web check-types`
- [ ] `pnpm --filter web lint`
- [ ] `pnpm --filter web test`
- [ ] `pnpm --filter web build`
- [ ] `/api/chat`, `/dashboard/knowledge`, `/api/knowledge/[id]/file`, and
      `/api/knowledge/[id]` traces are under ~10 MB and contain none of
      `pdf-parse`, `pdfjs-dist`, `mammoth`, `xlsx`, `word-extractor`, or
      `@napi-rs/canvas`.
- [ ] `/api/knowledge/crawl` no longer traces the extraction packages either.
      It is fine for `/api/knowledge/upload` to stay large because it genuinely
      parses PDFs/XLSX/DOCX.
- [ ] Upload a PDF, a DOCX, and an XLSX; verify extraction, listing, chat retrieval,
      download, and delete.
- [ ] Start a crawl and verify status, page ingestion, and re-crawl replacement.

### Do not

- Do not only add `@napi-rs/canvas` to `serverExternalPackages` or ignore it.
  Excluding it alone caused `ReferenceError: DOMMatrix is not defined`; the PDF
  stack needs the native module at runtime.

---

## B. Remove knowledge files when a domain or agent is deleted

`deleteDocument` already removes its storage key before deleting the row.
`deleteDomain` and `deleteAgent` rely on database cascades, so uploaded files stay in
storage as orphaned objects.

- [ ] Inject `KnowledgeFileStorage` into `createDomainsService` and
      `createAgentsService`, or add a dedicated cleanup helper that both call before
      the cascade delete.
- [ ] Select `knowledge_documents.storage_key` for the domain/agent before deleting.
- [ ] Remove each key through the storage adapter. For R2, batch deletes; for Blob,
      use the SDK's delete call.
- [ ] Decide failure behavior. Suggested: fail before the database delete for an
      explicit domain/agent deletion, so the rows remain and the user can retry.
      Use best-effort logging plus an orphan report only for a one-off cleanup job.
- [ ] Add a test: upload a file, delete its agent/domain, assert the object is gone.

---

## C. R2 adapter and migration (only before switching storage)

R2 env vars are already added locally and to Vercel. The code still uses Vercel Blob.
Existing production objects are in Blob, so **do not auto-select R2 just because the
R2 env vars exist** — that would make old files return 404.

### Adapter

- [ ] Add `services/api/src/knowledge/r2-storage.ts` implementing
      `KnowledgeFileStorage` (`save`, `load`, `remove`).
- [ ] Use a private bucket. Do not enable public `r2.dev` access.
- [ ] S3 endpoint: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`; region `auto`.
- [ ] Choose the signer with bundle size in mind:
      `aws4fetch` is small and enough for simple PUT/GET/DELETE (and presigning);
      `@aws-sdk/client-s3` is larger and must be lazy-loaded if used. Measure the
      route traces before choosing. Do not put the AWS SDK at the top level of a
      read service.
- [ ] `load` returns `null` on 404; `remove` treats 404 as already deleted;
      `save` overwrites (same as the Blob adapter).
- [ ] Add an explicit `KNOWLEDGE_STORAGE_DRIVER` (`local` | `blob` | `r2`), or an
      equivalent explicit selection. Keep Blob as the production default until
      migration is complete.
- [ ] Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
      `R2_BUCKET` to `apps/web/.env.example` and `turbo.json` `globalEnv`.
      Confirm they exist in Vercel for Production, Preview, and Development.

### Migration

- [ ] Count production knowledge files:
      `select count(*), coalesce(sum(file_size), 0) from knowledge_documents where storage_key is not null;`
      The configured database currently has 5 files / 260,025 bytes. Re-check the
      actual production database before migrating.
- [ ] Copy each Blob object to R2 with the same storage key. Verify byte size and
      checksum.
- [ ] Keep the Blob copies until the R2 build has passed upload, list, download,
      delete, chat, and crawl checks.
- [ ] Set `KNOWLEDGE_STORAGE_DRIVER=r2` in Preview first, test, then promote to
      Production.
- [ ] Rollback is `KNOWLEDGE_STORAGE_DRIVER=blob`; do not delete Blob objects until
      the rollback window has passed.

### Download route

- [ ] Keep the existing `/api/knowledge/[id]/file` proxy first. It is the smallest
      change and preserves ownership checks and `Content-Disposition`.
- [ ] Optional later: after the ownership check, return a short-lived presigned GET
      URL (about 60 seconds) instead of streaming the bytes through the function.
      That reduces function egress but adds signing and URL-handling code. Only do it
      when download traffic actually matters.
- [ ] No CORS changes are needed for a server-side proxy. Add CORS only if the browser
      talks to R2 directly.

---

## D. Verification and triggers

### Size check

After a production build:

```bash
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";

const serverDirectory = path.resolve("apps/web/.next/server");
const traceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(filePath);
    else if (entry.name.endsWith(".nft.json")) traceFiles.push(filePath);
  }
}
collect(serverDirectory);

let totalBytes = 0;
const rows = [];
for (const traceFile of traceFiles) {
  const payload = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  const baseDirectory = path.dirname(traceFile);
  const seenPaths = new Set();
  let bytes = 0;
  for (const relativePath of payload.files ?? []) {
    const absolutePath = path.resolve(baseDirectory, relativePath);
    if (seenPaths.has(absolutePath)) continue;
    seenPaths.add(absolutePath);
    try {
      bytes += fs.statSync(absolutePath).size;
    } catch {}
  }
  totalBytes += bytes;
  rows.push({ name: path.relative(serverDirectory, traceFile), bytes });
}
rows.sort((left, right) => right.bytes - left.bytes);
console.log(`traces: ${rows.length}; total: ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
for (const row of rows.slice(0, 15)) {
  console.log(`${(row.bytes / 1024 / 1024).toFixed(1)} MB\t${row.name}`);
}
EOF
```

### When to do each item

- **A now:** the remaining 39–43 MB functions are still large; this is the next
  meaningful win and has no data migration.
- **B before C:** clean up deletion behavior before adding a second storage backend.
- **C when storage cost or egress matters:** current knowledge data is about 260 KB,
  so Blob is effectively free. R2 becomes worthwhile at multi-GB storage or
  meaningful download traffic.
- **D only if download traffic becomes significant.**

## Non-goals

- Multipart uploads, public buckets, lifecycle deletion, virus scanning, CDN
  integration, per-file quotas, and a new general-purpose storage abstraction.
- Migrating local `.uploads` files; they are development-only.

## Risks / notes

- Splitting the service can drift behavior. Move shared logic instead of copying it,
  and keep the existing ownership checks.
- Adding the AWS SDK carelessly can make function sizes worse. Measure after adding it.
- Do not switch the storage driver before copying existing Blob objects.
- Do not commit any R2 secret. `R2_SECRET_ACCESS_KEY` is server-only.
