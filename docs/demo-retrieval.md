# Anvesha demo: documents to cited answers

Open http://127.0.0.1:8000 and sign in to a real workspace. The separate browser sample demo contains explicitly labelled scripted examples; use a signed-in project to demonstrate retrieval from your own documents.

1. In Upload, create a folder and choose it as the destination. Upload a PDF, DOCX, TXT, Markdown, CSV, XLSX, PPTX or image. Scans and images use OCR. Audio/video require explicit cloud transcription consent.
2. Preparation reads the document, creates source-linked passages, suggests a category, tags and starter questions, then automatically queues the search index. First-time indexing can take longer while the local embedding model loads.
3. Search the library using a filename, tag or suggested label. Source details let you add your own comma-separated tags and change the folder. Suggested tags remain separate from your own tags.
4. In Training, review the real processing activity and suggested questions. Pick a question to open Try with it filled in; press Send when ready.
5. Use Source quotes for local retrieval with citations. AI explanations additionally use a model and depend on provider availability. Open a citation to inspect the original passage and page, sheet/cell, slide or timestamp.

## Updates and limits

New uploads and saved written-source edits refresh their metadata and index automatically. For a new version of a document from your laptop, upload the replacement through the app; the app cannot monitor arbitrary files on your laptop. Registered document copies in Anvesha's server storage are checked every 15 seconds and reprocessed when their contents change. This watcher excludes media to avoid automatic paid transcription.

Google Drive uses the chosen-folder sync mechanism after Google OAuth setup and account consent. Sync can be requested manually or enabled on a 15-minute schedule. Google setup is currently deferred; live Drive access has not been verified.

Labels and starter questions use shared deterministic content rules, with a general reference label for unmatched topics. They are suggestions, not an exhaustive classification of every industry. Answer retrieval searches actual source passages; the suggested questions do not supply canned answers.
