# Google Drive and expanded document imports

The implementation adds Google Drive folder import, native Google Docs/Sheets/Slides exports, XLSX, PPTX, general CSV documents, and opt-in audio/video speech transcription. The service runs at http://127.0.0.1:8000.

## Activate Google Drive

1. In the Google Cloud project that owns your OAuth client, enable the **Google Drive API**.
2. Open **Google Auth Platform > Clients** (or **APIs & Services > Credentials**) and edit the **Web application** OAuth client.
3. Add this exact **Authorized redirect URI**: `http://127.0.0.1:8000/api/drive/callback`.
4. Configure the consent screen for the Drive read-only scope: `https://www.googleapis.com/auth/drive.readonly`. If the app is in testing, add the Google accounts that will connect as test users. Public distribution with this restricted scope has additional Google verification requirements; consult the scope documentation below.
5. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in the server `.env`. Keep these values private and never use `VITE_` prefixes. An existing local Web OAuth client has already been copied into the ignored `.env` on this installation; its downloaded metadata did not list a redirect URI, so check step 3 in Cloud Console.
6. Run `docker compose up -d app` after changing environment settings. Open Anvesha on **127.0.0.1**, sign in, open a project's **Upload** screen and select **Connect Google Drive**. Complete Google's consent screen yourself.

Google Drive OAuth credentials and the Gemini API key serve different purposes. A Gemini key does not grant Drive access. No Google password is entered into Anvesha. Live OAuth authorization cannot be completed by automated tests without the user's Google consent.

## Use the connector

Choose folders in My Drive, optionally include their subfolders, and choose an Anvesha upload destination. Preview shows file types, supported/skipped files, folder paths and counts. Exclude individual files before importing. One selection can contain up to 10 roots and 1,000 files, with up to 10 folder levels and 240 path characters. Overlapping selected roots are deduplicated by Google file ID.

Import creates durable background download, ingestion and indexing jobs. Training shows the real job stages. The preview does not mean a source is ready: download, parsing/OCR and indexing must complete before answers are available. Sync uses the existing source identity rather than making a new copy every time. Changed files are reprocessed, and sources removed from the selected tree are removed from current retrieval after a complete inventory.

Use **Sync now** for manual updates. Enable automatic checking to reconcile selected folders every 15 minutes while the service runs. This initial implementation uses bounded full-folder reconciliation rather than a Drive changes cursor or webhooks. It does not sync when the local service is stopped.

Original files in Google Drive are read-only. Local folder segments are normalized for filesystem safety; original document titles and Drive links remain visible. Changing the selected roots replaces the project's previous Drive selection. Local moves of imported sources can be reset to the import destination on the next sync. Remove a connected source to exclude it from later syncs; importing a new selection can include it again. Replace the original in Drive and sync to update it; the local Replace file action is unavailable for connected sources.

Before a newly generated answer uses a Drive source, the server rechecks file access, selected-folder membership and the provider revision. Revoked, moved-out or changed material is withheld until the selection is valid and the latest revision is synced. Network errors block that Drive-backed answer rather than silently using unchecked access. Connected sources are private to the signed-in owner and are excluded from publication snapshots.

Disconnect applies to this Google account across all of its Anvesha projects, disables connected sources, deletes stored tokens and attempts provider revocation. Cached files remain in the local data volume for recovery. There is no automatic deletion of cached originals or historical conversation text in this release.

## Formats and limits

| Source | Processing | References |
|---|---|---|
| Google Docs | Export DOCX and parse locally | Headings and original Drive link |
| Google Sheets | Export XLSX; read every sheet | Sheet name and cell/row range |
| Google Slides | Export PPTX; text, tables, notes and image OCR | Slide number |
| Excel `.xlsx` | Read rows with column headers; no macro execution | Sheet and cell range |
| PowerPoint `.pptx` | Text, tables, speaker notes, group shapes and image OCR | Slide number |
| CSV | Choose Q&A import or document/table data on Upload | Rows/passages |
| PDF, DOCX, TXT, Markdown, images | Existing local parsers and OCR | Pages, headings or positions |
| MP3, WAV, M4A, OGG, FLAC | Opt-in Gemini speech transcription | Approximate timestamps |
| MP4, WEBM, MOV | Opt-in Gemini speech transcription of audio | Approximate timestamps; visuals are not indexed |

Documents are limited to 15 MB. Google native exports are limited to 10 MB by Google. Audio/video clips are limited to 10 MB to fit inline request limits. Existing limits include 250 PDF pages, 50 image frames and 3 MB of extracted text. XLSX: 100 sheets, 50,000 rows per sheet, 200 columns and 500,000 cells total. PPTX: 250 slides and 100 embedded images for OCR. Office packages expanding above 100 MB are rejected.

Workbook formulas are not recalculated: saved cached values are read. Charts, workbook layouts, slide animations and embedded media are not treated as text. Large-table arithmetic and business analytics are not guaranteed by passage retrieval. Legacy `.xls`, `.ppt`, `.doc`, archives, Shared Drives, shortcuts, and unsupported Google Workspace types are skipped or rejected with an explanation. Export legacy Office files into current formats before uploading.

## Media consent

Audio/video do not process without explicit consent to send them to Google Gemini. Configure `GOOGLE_API_KEY` and optionally `GOOGLE_MEDIA_MODEL`; otherwise the configured `GOOGLE_MODEL` is used. Provider access and quota are required and provider usage may be billed. Transcription produces stored source passages; subsequent chat uses those passages rather than uploading the recording for every question. Model output and timestamps may be inaccurate, so inspect the transcript before relying on it.

Drive media has a separate consent checkbox during import. Files are skipped when consent or the API key is missing. Automated tests mock the transcription transport; no live recordings have been transcribed for validation.

## Storage and credentials

Tokens are encrypted using `ANVESHA_TOKEN_KEY` (a Fernet key), or a separately generated `.drive-token-key` in the persistent data directory. Back up the key with the database; losing it requires reconnecting. For a managed deployment, provide a stable environment-managed key. Tokens are never placed in browser storage, model prompts, source metadata or API responses. OAuth uses short-lived one-use state, PKCE, an HTTP-only callback cookie and an active Anvesha session binding.

SQLite stores account connections, project selections and provider file IDs. Original/exported files use the existing per-account/project uploads storage. Qdrant retains account/project/revision boundaries. Restart recovery uses the existing durable worker queue.

## Validation

`backend/test_imports.py` tests real Office extraction, media consent, OAuth state/PKCE/replay, encrypted credential storage, Drive inventory/import deduplication, ownership and access removal using mocked Google transport. `e2e/local-product-imports.spec.ts` tests actual XLSX/PPTX uploads through the running Docker app and the Drive preview flow with Google responses mocked. Existing backend/frontend and local folder tests remain in use.

## Official references

- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Drive authorization scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive download and export limits](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Google Workspace export formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
