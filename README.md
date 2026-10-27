# Anvesha

*Your knowledge. Clear answers.*

Anvesha lets an organisation build an assistant from its own documents, FAQs and written information, test answers against highlighted sources, and publish it to a website widget or an API. This repository is a presentation-ready web prototype.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts: `npm test` (unit tests), `npm run build` (type check + production build), `npm run preview` (serve the build), `npm run demo-files` (regenerate the sample upload files).

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

## Five-minute presenter walkthrough

Open `http://localhost:5173/#/demo` (the presenter launcher).

1. **Create** (≈1 min). Choose *Empty new organisation*, type "Greenfield College", then pick *College admissions* and *Suggest a name and purpose* → **Continue**. Upload `VayuTech-Employee-Handbook.pdf` and `Scanned-Notice.pdf` from the launcher's sample files.
   - Expected: the handbook shows **Ready**, and *Preview* shows "PDF page 3 · printed page "1"".
   - Expected: the scanned file shows **Needs attention**, with an explanation.
2. **Switch to the story.** Go back to the launcher and choose *Ready-to-test sample* (VayuTech AskHR, which opens on **Try**).
3. **Ask:** *"I am on probation and my mother is hospitalised. Can I take three days' leave?"*
   - Expected: the answer acknowledges the emergency, explains that casual leave isn't available on probation, says HR reviews family emergencies individually with no guarantee, and neither approves nor rejects.
4. **Inspect the citation.** Click **View sources**.
   - Expected: *VayuTech Leave Policy (2025 edition) · Section: 3. Casual leave*, with the required passage highlighted.
5. **Improve the draft.** Click 👎, then *Change how it helps*. Enter the contact "the HR Care desk at hrcare@vayutech.example or extension 2040".
6. **Retest.** Go to **Try** and ask again.
   - Expected: the old answer is marked "Answered using an earlier draft", and the new answer names the HR Care desk.
7. **More examples.**
   - "How many days of annual leave do I get?" → 18 days, strong support.
   - "How much leave do I get?" → asks which kind.
   - "Does VayuTech pay for a gym membership?" → honest "couldn't find" plus help contact.
   - "How many casual leave days do I get?" → shows both 8 (2025) and 12 (2023) as conflicting.
   - Optional: under **Add knowledge**, choose *Use the 2025 version* and ask again → 8 days only.
8. **Publish.** **Continue to sharing** → *Only authorised users* (note the "simulated" warning) → *On my website* → review → **Publish**.
   - Expected: "Version 1 is published… not on your website until it is installed".
9. **Try the widget.** Click the emergency question in the website preview.
   - Expected: the same answer from version 1, with no owner labels. *Get installation instructions* shows the div/JS snippets and a developer handoff note.
10. **Edit the draft.** Go to the assistant's home → *Update information* → *How it helps*, and change the extension to 2041.
    - Expected: the banner says people still get version 1.
    - **Open assistant** and ask again → still "extension 2040".
11. **Republish.** Use *Review and publish* → **Publish changes** (version 2). The public page now says 2041.
12. **Review conversations.** On the home page, choose **Review conversations** to see real counts.
    - If you asked an unanswered question on the public page, use *Write an answer*. Saving requires explicit approval.
13. **Unpublish.** Click **Unpublish now** → confirm. The open public page shows "This assistant isn't available right now" and the composer is disabled.

Reset quickly with the launcher's **Reset sample**. It removes only the VayuTech sample.

## Data and privacy (prototype)

Everything lives in this browser's `localStorage`:
- the extracted text (uploaded files themselves are not kept),
- settings and published versions,
- conversations (question, answer, sources and rating; no personal details).

*Versions and settings → Your data* explains this and has confirmed delete and reset actions.
