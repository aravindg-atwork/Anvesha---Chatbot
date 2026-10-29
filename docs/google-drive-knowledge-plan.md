# User folders and Google Drive knowledge: implementation plan

Status: implementation now covers Drive OAuth, folder inventory/import, scheduled reconciliation, native Docs/Sheets/Slides exports, Office parsing and opt-in media transcription. See [google-drive-setup.md](google-drive-setup.md) for the shipped behavior and activation steps. The design below retains later work such as stable folder IDs, Shared Drives, changes-feed sync and capacity benchmarks.

## Product behavior

Users create and name their own Anvesha folders. Examples such as HR/Policies are suggestions, never fixed categories. Use stable folder IDs with parent IDs and display names so renaming a folder does not break source membership. Allow duplicate names under different parents. Keep server storage paths independent of display names to safely support names in different languages and punctuation.

Within a project: Knowledge > Connect Google Drive > authorize an account > choose one or more folders > optionally include subfolders > choose an Anvesha destination > preview contents > Import and prepare.

The preview shows file name, original folder, type, size when known, supported/skipped status, and totals by type. Users can exclude files or subfolders. Preserve the selected Drive hierarchy under the destination by default. Anvesha display names can be changed independently; importing never renames, moves or edits originals in Drive.

Show source counts, prepared passages, last successful sync, failures, skipped files and Sync now. Keep local uploads available alongside connected sources. Offer folder filters when asking questions; default to all eligible project sources.

## File coverage

| Source | Import and conversion | Citation |
|---|---|---|
| Google Docs | Export DOCX; reuse document parser | Heading and Drive link |
| Google Sheets | Export XLSX; add workbook parser that preserves every sheet, headers and cell coordinates | Sheet and cell range |
| Google Slides | Export PDF for first release; extract text and OCR | Slide/page and Drive link |
| Uploaded PDF, DOCX, TXT, Markdown | Download and reuse existing parsers | Page, heading or passage |
| PNG, JPEG, WEBP, TIFF, BMP and scanned PDFs | Download and OCR through existing pipeline | Image/page with OCR warning |
| CSV | Parse tabular content; offer a separate Q&A import action when appropriate | Row range |
| XLSX | Add workbook parser before enabling import | Sheet and cell range |
| PPTX | Later: add slide parser and embedded-image OCR | Slide |
| Audio, video, archives, executables, unsupported Workspace types | List as unsupported; do not mark as prepared | None |

Do not claim arbitrary files are understood. Google-native files require export rather than ordinary binary download. Handle Google export limits and download permissions separately from Anvesha limits. Initial binary imports retain the existing 15 MB cap, PDF 250-page cap and extraction safeguards. Display the reason for each skipped or failed file. Sheets need row/header preservation; vector retrieval alone cannot guarantee calculations across large tables. Do not promise spreadsheet analytics in the first release.

## Connection and authorization

Implement server-side OAuth authorization-code flow with state validation, PKCE where supported, explicit account linking and registered callback URLs. Encrypt refresh tokens at rest with an environment-managed encryption key. Keep credentials out of browser storage, source data, logs and chatbot prompts. Reconnect after revocation or refresh failure.

For recursive sync of existing folder contents, plan for Drive read-only access and enforce selected-folder boundaries in Anvesha. Explain that this OAuth scope is broader than the selected folders. Do not assume selecting a folder with the per-file drive.file scope grants access to all existing descendants. Validate scope behavior in an early integration spike. Public distribution using restricted scopes may require Google verification and a security assessment; account for that before launch.

First release: personal My Drive. Add Shared Drives explicitly later with drive IDs, membership tests and the appropriate API flags. Skip shortcuts initially with an explanation; later resolve targets only when the target is authorized and within configured import boundaries.

## Fetch, prepare and answer

1. Enumerate selected folders recursively with pagination, exclusions and cancellation. Dedupe overlapping selected roots by Drive file ID.
2. Persist a resumable inventory before downloading; never rely on folder names as identities.
3. Download or export in bounded batches. Handle quota errors with exponential backoff and jitter; show per-file progress.
4. Stage each new revision separately, then parse, OCR where needed, normalize and chunk with source locators.
5. Embed prepared chunks and index them in Qdrant using account, project, connection, source and revision filters.
6. Publish a consistent prepared revision after successful indexing. Replace older chunks without creating duplicate sources. Quarantine known revoked/deleted sources immediately, even while a replacement index is pending.
7. Answer only from permitted prepared passages. Cite document title, page/section/sheet, original Drive URL and source revision. If the material does not support an answer, say so.

Reuse backend/extraction.py, backend/worker.py, backend/vectors.py and the existing grounded-answer path. Extend their file types, job stages, locator types and failure states rather than building a parallel chatbot pipeline. Imported content is untrusted text and cannot override assistant instructions.

## Ongoing sync

Start with manual Sync now, then configurable polling (proposed default: every 15 minutes). Record a Drive changes cursor before initial traversal and replay changes afterward to cover edits made during import. Advance the cursor only after durable processing. Use the changes feed plus periodic reconciliation of selected folder membership; folder moves can change eligibility for many descendants.

Track identity by connection and Drive file ID, with revision/modified time and content hash where available. Content changes trigger extraction and reindexing. Name or path changes update metadata. Folder exclusions, trashing, permanent deletion, movement outside the selected tree, or lost permissions remove affected knowledge from retrieval on detection. A transient outage should show stale sync status and retry; it should not be mistaken for deletion.

Revalidate access when a Drive source is used for an answer; if authorization cannot be established, withhold that source. Background polling alone is insufficient for promptly detecting revoked access. On disconnect, stop jobs, revoke/delete stored credentials, and disable connected sources immediately. Provide a separate explicit action to delete cached documents and extracted data.

Current app accounts have isolated projects. First release keeps connected content private to its owner and excludes it from public publishing. Shared projects or public assistants require a separate authorization design; the connector owner's access does not automatically authorize every chatbot user.

## Data and API changes

- knowledge_folders: id, project_id, parent_id, display_name; migrate existing folderPath values without losing memberships.
- drive_connections: id, user_id, provider_account_id, encrypted credentials, scopes, status.
- drive_roots: connection_id, project_id, drive_folder_id, destination_folder_id, recursive, exclusions.
- drive_items: connection_id, project_id, drive_file_id, source_id, parent IDs, MIME type, original/display names, modified time, revision/hash, access and sync state. Uniqueness prevents duplicate imports.
- sync_runs: connection/root, cursor/checkpoint, inventory counters, retries, timestamps, errors; reuse durable jobs for fetch/ingest/index.
- New backend routes for OAuth start/callback, connection status/disconnect, folder browsing, import preview, import confirmation, sync status/start/cancel and cached-data deletion.
- UI: connection card, folder selector, inventory preview, sync controls and source provenance. Use the existing branched menu to browse Anvesha folders.

## Delivery order and acceptance checks

1. Folder model: stable IDs, create/rename/move, user-chosen names, existing-folder migration; test reload and source membership.
2. OAuth and inventory: real Google test account, recursive scope proof, paginated browsing, selected-root enforcement and type counts. Requires a configured Google Cloud OAuth client, Drive API, callback and token encryption key.
3. Initial import: reuse PDF/DOCX/text/image ingestion; add native Docs/Slides exports, XLSX/Sheets parsing and exact locators. Verify nested import and cited answers end to end.
4. Sync lifecycle: edits, renamed/moved folders, new files, deletions, permission loss, disconnect, overlapping roots, restart recovery and quota retries. Verify removed content cannot appear in answers.
5. Capacity: benchmark proposed pilot datasets of 100, 1,000 and 10,000 mixed files. Measure inventory time, bytes downloaded, OCR/indexing time, disk/RAM, query latency and sync lag. Set supported limits from measured results, not an unlimited-capacity claim.

## Official references

- OAuth scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Download and export: https://developers.google.com/workspace/drive/api/guides/manage-downloads
- Export formats: https://developers.google.com/workspace/drive/api/guides/ref-export-formats
- Change tracking: https://developers.google.com/workspace/drive/api/guides/manage-changes
