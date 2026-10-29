# Anvesha

*Your knowledge. Clear answers.*

UI setup and supplied component integration: see [docs/ui-setup.md](docs/ui-setup.md) for Tailwind, shadcn paths, ThinkingTool, the mesh shader and glass theme.

Google Drive folder import, Google Docs/Sheets/Slides, Excel/PowerPoint and opt-in media transcription: see [docs/google-drive-setup.md](docs/google-drive-setup.md) for activation, supported formats, sync behavior and limits.

Anvesha is a local knowledge-assistant product built with React, a Python API, Google ADK, SQLite and Qdrant. Create an account, create workspaces and named projects, upload documents and images, watch real processing jobs, then test cited answers against your sources. External widget/API publishing remains a preview.

## Run the local product with Docker (recommended)

Start Docker Desktop, then run from this directory:

```powershell
docker compose up -d --build
```

Open **http://127.0.0.1:8000/#/signup**. Create your own account; there are no default credentials. Open the app consistently on this hostname so the session cookie is retained.

1. Create a workspace, then a project with its own name and purpose.
2. Upload PDF, DOCX, TXT/Markdown, CSV, PNG, JPG, WEBP, TIFF or BMP files, up to 15 MB each. CSVs in the UI have a Q&A import preview. Written information and approved Q&A are also saved and indexed.
3. Open **Training** while uploads process. The ADK knowledge coordinator runs parsing/OCR and passage preparation; a search-indexing job embeds passages locally and saves them in Qdrant. The screen shows persisted job stages, page activity, failures and retry controls. Larger documents take real processing time. Jobs continue when you navigate away and resume after backend restarts.
4. When the index is ready, continue to **Try**. Questions retrieve passages from Qdrant, filtered to your account, project and current source revision. Review citations and rate answers. Changed sources require reindexing before they can answer.
5. Sign out and sign in again, or restart Docker: your workspaces, projects, uploads, jobs and conversations are retained.

No Google key is needed for local OCR, parsing, embeddings, Qdrant or cited source quotes. The first indexing run downloads `BAAI/bge-small-en-v1.5` and caches it in a Docker volume; allow internet access for this initial model download. This embedding model is primarily for English text. For Gemini-written answers, create `.env` from `.env.example`, set `GOOGLE_API_KEY`, then run `docker compose up -d app` to apply the environment. Select **AI model** in Try. Keys stay on the server. Status indicates configuration, not verified provider connectivity.

Tesseract is included in the app image. English OCR is the default; set `OCR_LANGUAGES=eng+hin` in `.env` to use the included Hindi data too, and recreate the app container. OCR can misread low-quality scans: inspect extracted passages. PDFs are limited to 250 pages, animated/multipage images to 50 frames, and extracted text to 3 MB per file.

The preparation pipeline uses ADK custom agents under a sequential coordinator. Its parser/OCR/curator/indexer stages execute local code and need no LLM key. Signed-in chat uses LangChain prompt/model chains and Gemini structured output: one pass writes a source-grounded answer, and another reviews its support. **Training here means preparing retrieval knowledge, not updating model weights.**

AI mode never silently falls back to quotes. Missing credentials, disabled APIs, key restrictions, unavailable models and exhausted credits produce explicit errors; use **Check AI connection** in Try to test the configured model. Source quotes are a separate, explicitly selected mode and cannot simplify or explain text. AI generation requires a permitted key, model access and available Gemini quota/credits. Each supported AI answer normally uses two model calls (writing and source-support review).

Chat sends the question, owner instructions, up to eight recent saved conversation messages and relevant current passages to Gemini. Generic follow-ups such as “explain this in simple English” reuse still-current cited passages rather than searching the vague follow-up alone. Each generated statement must cite an exact source quote; invalid references and rejected support reviews are withheld. Three suggested questions help continue the conversation. Citation checks and an AI review reduce unsupported answers but cannot guarantee factual correctness or repair incorrect OCR.

## Storage and operations

| Store | What it contains | Docker volume |
|---|---|---|
| SQLite (`/data/anvesha.sqlite3`, WAL mode) | Accounts, scrypt password hashes, hashed session tokens, workspaces, projects, extracted passages, jobs, conversations | `app_data` |
| Files (`/data/uploads`) | Original uploads and parsed intermediates | `app_data` |
| Qdrant | Local passage embeddings, with account/project/revision filters | `qdrant_data` |
| Embedding cache | Downloaded ONNX model | `embedding_models` |

`docker compose stop` stops services without deleting data. `docker compose up -d` resumes them. Avoid `docker compose down -v` unless you intend to erase the volumes. For a consistent backup, stop the app and snapshot all three volumes, including the SQLite WAL files. Source/project removal hides data from current retrieval; original files and old vector revisions are retained for local recovery. Account deletion and storage garbage collection are not implemented yet.

Useful checks:

```powershell
docker compose ps
docker compose logs -f app
# Database and Qdrant connectivity:
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Both published ports bind to localhost. This is a single-machine pilot with real authentication and per-account ownership, not an internet deployment: email verification, password recovery, workspace invitations, multi-worker coordination and external publishing are not implemented. Run one app worker against the SQLite database. The current UI's Publish step and authorised-publication labels remain previews; the signed-in Upload → Training → Try flow is the supported product path.

## Develop without rebuilding containers

Python 3.11+ and Node 22.12+ are required. On Windows PowerShell:

```powershell
docker compose up -d qdrant
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Stop the Docker app before running a host backend on the same port:
docker compose stop app
npm install
npm run api
```

In a second terminal run `npm run dev`. `.env.example` sets `ANVESHA_API_URL=http://127.0.0.1:8000`, so Vite forwards `/api` to Python. The host backend uses `./data` for SQLite and files. For host OCR, install Tesseract and set `TESSERACT_CMD` if necessary; the Docker backend already includes it. Never prefix secret settings with `VITE_`.

## Validate

```powershell
python -m unittest discover -s backend -p test_*.py
npm test
npm run build
# With Docker services running:
python scripts/check-local-backend.py
npm run e2e:local
```

The backend tests cover authentication, revocation, ownership, revision conflicts, upload validation, source integrity, ADK job execution and retrieval. `check-local-backend.py` exercises actual PNG/scanned-PDF OCR, TXT/DOCX parsing and Qdrant embeddings without mocks; `--restart` also checks persistence across a Docker app restart. It creates a clearly named test workspace/account. The local Playwright test covers account creation, workspace/project creation, uploads, training, citations, reload and sign-in. Real Gemini generation requires your own key and quota.

## Offline demo reference

The sections below describe the retained browser-only presenter demo, accessed at `#/demo`. Its sample data and simulated publishing are separate from signed-in backend workspaces. `npm run e2e` checks that demo; `npm run e2e:local` checks the real product against Docker. To run only the offline demo:

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Script | What it does |
|---|---|
| `npm test` | Unit tests: domain logic, the server boundary and the model engine with mocked network |
| `npm run e2e` | Playwright end-to-end tests: the full presenter journey on desktop and a phone layout check. Uses your installed Chrome locally. |
| `npm run build` | Type check and production build |
| `npm run preview` | Serve the build |
| `npm run demo-files` | Regenerate the sample upload files |

CI (`.github/workflows/ci.yml`) runs the build, unit tests and end-to-end tests on every push and pull request.

When an AI key is set, the answer endpoint:
- accepts requests only from the app's own origin,
- rate-limits each client to 20 requests a minute,
- validates request sizes,
- escapes document and question text inside the prompt's delimiters, so uploaded content can't pose as instructions.

The app works fully offline after `npm install`, with no credentials needed. To use an AI model for answers as well, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The key is read only by the local server (`server/chatApi.ts`) and is never sent to the browser. With a key set, the **Try** step shows a switch between the offline demo engine and the AI model.

## Where things live

| Path | What |
|---|---|
| `src/domain/` | Business logic, with no React: types, store and migration, operations, ingestion, retrieval, conflicts, publishing |
| `src/domain/engine/` | Answer engines behind one interface: offline extractive, scripted demo, server-side model |
| `src/demo/vayutech.ts` | Fictional VayuTech dataset and demo questions |
| `src/ui/` | React screens and components |
| `server/chatApi.ts` | Server-side boundary for optional model access |
| `public/sample-files/` | Fictional files for the live upload demo |

## What is real, and what is simulated

**Functional**
- TXT, PDF (pdf.js) and DOCX (mammoth) text extraction.
  - PDF references use the real page position and, when the file stores them, its printed page labels.
  - DOCX references use the real headings.
- FAQ CSV import, with a preview and row-by-row validation.
- Duplicate detection (SHA-256), plus empty, oversized, unsupported and scanned-file handling, with retry, replace and remove.
- BM25 retrieval, and highlighted excerpts that are always exact substrings of the stored passage.
- Conflict handling.
  - Version conflicts are surfaced and never resolved silently.
  - The automatic check is labelled for what it is: same topic, different numbers.
- Draft and published separation.
  - Each publish is an immutable snapshot, with version history and immediate unpublish.
  - Public publications include only public sources.
- Autosave to browser storage, with safe migration and backup, and cross-tab sync.
- Test and published conversation logs, with metrics counted from real interactions.

**Simulated (and labelled in the UI)**
- Sign-in is a local prototype; passwords are not stored or checked.
- "Only authorised users" is a label only and gives no real protection.
- The widget script host (`cdn.anvesha.example`) and the API endpoint (`api.anvesha.example`) are placeholders.
  - The in-app widget preview and the API simulator run against the real published snapshot.
- The two VayuTech demo answers (the emergency question and the ambiguous "How much leave") are **scripted** and labelled "Scripted demo response".
  - They run only for the sample, and only while the exact bundled passage they cite is still among the sources.
- Every other answer is either quoted from matching passages ("Quoted from your sources", no AI) or written by the model when one is configured.

**Evidence labels** (Strong / Partial / No supporting source) come from a word-match check between the question and the cited passage. The UI states that this is not proof of correctness.

## The flow

**Sign in → Create workspace → Your projects → Project.** Each project is one assistant and has six steps. You can return to any step at any time.

| Step | What happens |
|---|---|
| **1 Upload** | Upload files (PDF, Word, text, Q&A CSV), add questions and answers, or write information |
| **2 Training** | Anvesha reads and indexes the information, lists the topics it found and flags conflicts and outdated sources. No AI model is trained, and the screen says so. |
| **3 Try** | Private test chat with cited sources, evidence labels and feedback |
| **4 Review** | Purpose, language, tone (friendly, formal or concise), contact for more help, custom instructions, and answers marked "not helpful" |
| **5 Make** | Name, avatar, colour, greeting, starter questions and widget style, with a live preview |
| **6 Publish** | Audience, channel, a review of what's included, publishing, then widget or API installation |

After the first publish, the project also has an **Overview**, **Conversations** and **Settings** (versions and data).

## Five-minute presenter walkthrough

Open `http://localhost:5173/#/demo` (the presenter launcher) and choose **Start from scratch**.

1. **Workspace and project** (≈30 s). Type "VayuTech" → **Create workspace**. In *New project*, pick *Employee questions* → **Create project**. The name AskHR is suggested.
2. **Upload.** Click *Use VayuTech sample documents* (demo only).
   - Optional: click **Choose files** and add `VayuTech-Employee-Handbook.pdf` from `public/sample-files`. *Preview* shows "PDF page 3 · printed page "1"".
3. **Training.** Watch each source being prepared.
   - Expected: topics such as *Casual leave* and *Health insurance*, and a *Casual leave allowance* conflict between the 2023 and 2025 editions.
4. **Try.** Ask: *"I am on probation and my mother is hospitalised. Can I take three days' leave?"*
   - Expected: empathy; casual leave isn't available on probation; HR reviews family emergencies with no guarantee; neither approves nor rejects.
   - Click **View sources**: *Section: 3. Casual leave*, with the required passage highlighted.
5. **Improve.** Click 👎 → *Change how it helps*. Review lists the flagged answer. Enter "the HR Care desk at hrcare@vayutech.example or extension 2040".
6. **Retest.** Go back to **Try** and ask again.
   - Expected: the old answer is marked "Answered using an earlier draft", and the new one names the HR Care desk.
   - Also try "How many casual leave days do I get?" → both 8 (2025) and 12 (2023) are shown as conflicting.
7. **Review.** Choose the **Formal** tone.
8. **Make.** Pick a colour (including coral) and an avatar. The preview and project header update instantly.
9. **Publish.** *Only authorised users* (note the "simulated" warning) → *On my website* → **Publish**.
   - Ask the emergency question in the website preview. Expected: version 1, formal wording, no owner labels.
10. **Edit, then republish.** In **Review**, change the extension to 2041. The banner says people still see version 1, and **Open assistant** still answers "2040". Click *Review and publish* → **Publish changes**, and the public page now says 2041.
11. **Conversations, then unpublish.** Open **Conversations** to see real counts and turn unanswered questions into approved answers. Then **Overview** → **Unpublish now**: the public page stops answering.

Shortcuts for presenting: `#/demo/ready` opens a fresh ready-to-test sample on **Try**, and `#/demo/published` opens a fresh published sample on **Overview**. Add a step to jump straight to it, for example `#/demo/ready/make`.

Other launcher options: **Ready-to-test sample** (opens on Try) and **Published sample** (opens on Overview). **Reset sample** removes only the VayuTech sample.

## Interface and project organization

The entry journey includes a source-backed interactive landing preview, account screens, workspace setup and a project studio. Projects support persistent pins and workspace-specific collections, drag-to-collection organization, search, sorting, and grid/list/board views. Board stages reflect actual project progress. Press Ctrl/Cmd+K to find projects and workspaces, or `/` to focus project search.

Reusable components live in `src/components/ui` (imported as `@/components/ui`), following the existing shadcn-compatible `components.json`. TypeScript and Tailwind are already configured. The new journey styles are in `src/styles/journey.css`; existing editor and chat styles remain in `app.css` and `product.css`. The supplied Tool Call Card is adapted for React 18 and displays real worker activity on the processing screen, including timestamps, expandable JSON, copy controls and retries. These are processing summaries, not model reasoning.

## Data and privacy (offline demo)

Everything lives in this browser's `localStorage`:
- the extracted text (uploaded files themselves are not kept),
- settings and published versions,
- conversations (question, answer, sources and rating; no personal details).

*Versions and settings → Your data* explains this and has confirmed delete and reset actions.

## Knowledge folders

On Upload, create a path such as `HR/Policies`, choose the upload destination, and browse sources with the expandable folder tree. Counts include nested sources; selecting a folder lists its direct sources. Move a source through **More actions > Details and version > Folder**. Folder choices persist with the project. Signed-in uploads are stored in matching directories under `/data/uploads/<user>/<project>/`; originals keep unique IDs to avoid filename collisions. Empty folders exist in project metadata until a file is uploaded. Moves wait for active processing to finish. CSV imports remain in Questions and answers.

Folders support 10 levels, 60 characters per segment and 240 characters per path. There is no configured total file or folder count limit; practical capacity depends on disk, memory and processing time and has not been load-tested. The existing 15 MB per-file upload limit still applies.
