# Gradias Legal Navigator

A responsive legal research library for AI-assisted exam grading, using Gradias branding and the supplied research snapshot of **10 October 2026**.

## Features

- Requirements matrix: 60 requirements across 97 instruments, source notes, filters and CSV export.
- Country views: Germany, United Kingdom, United States, and all 16 German states' guidance.
- Q&A: 22 searchable answers from the supplied document.
- Sources: 222 links with provenance and 59 original document downloads with SHA-256 hashes.
- Competitors: 55 companies, 138 sourced legal positions, 236 links, 62 archived files and searchable text from 1,657 pages.
- Ask Gradias: contextual source retrieval, navigation and server-side OpenAI Responses integration. Without credentials it clearly shows source-search mode.

## Development

Requires Node.js 22.13+.

```sh
npm ci
npm run dev
```

The server prints its local URL (normally http://127.0.0.1:5173).

```sh
npm run typecheck
npm test
npm run test:api # while the development server is running
npm run build
```

`npm start` previews the production Worker build. Built with React, TypeScript, Vinext/Vite and the Sites Cloudflare Worker integration.

## Assistant

The server uses `OPENAI_API_KEY` and optional `OPENAI_MODEL` (default `gpt-4.1-mini`). Production credentials are held in Sites runtime secrets; no key is included in this repository.

Configure credentials through the approved credential and hosting-secret workflows. Never include secrets in browser code or the repository. Local `.env*` files are ignored. The public assistant does not require sign-in. Same-origin checks, input/output limits and best-effort per-isolate limits apply: six AI calls per client IP per minute, thirty total per minute and four concurrent calls. These limits reset with an isolate and are not an account-wide spending cap. Navigation and requests without matching evidence do not call OpenAI. Provider-level spend limits must be configured separately in the OpenAI project.

When live AI is enabled, questions, recent conversation and retrieved passages are sent to OpenAI with `store:false`. Chat stays in the current browser component session. Answers use only imported evidence; citation IDs are validated. This validation does not independently establish legal accuracy. The assistant reports missing evidence and does not browse the wider web.

## Content provenance

- `data/spreadsheet-snapshot.json`: original spreadsheet values and notes.
- `data/document-snapshot.json`: final-revision DOCX text, retaining insertions and excluding deletions.
- `data/provenance.json`: import counts and document hashes.
- `public/documents/`: original files, including tracked changes and clearly marked historical material.

To refresh, use `python scripts/extract-documents.py SOURCE_FOLDER EXTRACTED_FOLDER`, place the fresh Sheets API snapshot (including formatted values and notes) in `EXTRACTED_FOLDER/sheets.json`, and run `python scripts/import-content.py SOURCE_FOLDER EXTRACTED_FOLDER`. Refresh inputs together, review the changes, and deliberately update the research cut-off before publishing.

The content test compares every matrix cell and source note, validates source references, and checks every file hash.

Yes means a requirement is stated in the reviewed provisions with its qualifications. It does not confirm applicability or compliance. No is not permission. Guidance, future duties and scope remain distinct. US coverage includes selected state instruments, not a complete 50-state survey. The generic US contract register is preserved outside the binary matrix.

## Publication and rights

`.openai/hosting.json` identifies the public Site. Use the Sites source/build/package workflow so the deployed archive matches the pushed commit. GitHub repository visibility is managed separately from Site access.

Gradias logos are supplied brand assets. Research and linked materials retain their respective rights; this repository grants no additional licence to those materials. Inter uses the SIL Open Font License in `public/brand/Inter-OFL.txt`.

## Competitor archive

The Competitors tab covers 55 competitors from the supplied `Website privacy archive - 2026-10-10`: 231 captured source documents, 236 links, 55 PDF bundles (1,657 pages), and 62 downloadable files including preserved originals. Coverage distinguishes 52 policy collections, two statement-only entries (Gradie, Markr), and one links-only entry (Graide Network).

Legal positions are summaries of captured vendor claims, each paired with an exact excerpt, PDF page and source URL. They are not independent compliance findings. Source language is preserved in quotes and archive text. Position translations and summaries preserve product/tier qualifications and identified conflicts. The archive is a dated snapshot rather than a live monitor.

Re-import with `python scripts/import-competitors.py ARCHIVE_FOLDER POSITION_SUMMARIES_JSON` (requires pypdf). The position JSON uses the schema in `data/competitor-positions.json`. `npm test` checks every quote against its stated archive page, every source mapping and every file hash.

The deployed Site is publicly accessible without sign-in. Source search, competitor evidence and downloads work anonymously. Live OpenAI generation remains inactive because no key has been provisioned; its existing paid-inference identity check is separate from public browsing.
