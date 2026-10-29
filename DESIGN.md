# Anvesha Knowledge Studio

## Brief

Redesign the existing Upload and Training screens as a precise, visually distinctive working interface. Users collect their own documents, choose folders, inspect processing and test cited answers. Keep React 18, Vite, TypeScript, the current hash router and Python API. Retain all import, folder, OCR, Drive, consent and retry behavior. Google activation remains deferred at the user's request.

The user explicitly chose Ice Silver, Deep Aubergine, Marigold and frosted glass. The glass is a requested material, not an inferred trend. Use it selectively for the folder rail and preparation canvas; reading surfaces remain opaque enough for contrast.

## Concepts considered

| Territory | Idea / anchor | Signature | Emotion / frame | Originality | Fit | Feasibility | Portability (lower better) |
|---|---|---|---|---|---|---|---|
| Source material | Knowledge Studio: documents settle into a working archive, then become linked passages | Paper stack on intake becomes a real-state preparation map on Training | Capable and calm; archive rail beside an intake well | 4 | 5 | 5 | 2 |
| Formal system | A source ledger where every item carries a position and provenance | Index numbers link source rows and status | Precise; full-width document register | 3 | 4 | 5 | 4 |
| Process metaphor | A control room for the assistant's preparation jobs | A large live activity console | Technical; active job timeline | 3 | 4 | 4 | 4 |

Selected: Knowledge Studio. Its composition follows this product's actual conversion of files into cited passages. Borrow a restrained job register from the control-room alternative for diagnostics.

## Concept card

Idea: Give every source a place and make the journey from file to answer visible.
Metaphor: A glass archive desk with a preparation instrument.
Signature: The upload paper stack and the source-to-passage-to-search preparation map share one diagram language; the map only pulses while a real task is running.
Emotion: Confident, organized, quietly advanced.
Motion verb: Settle and connect.
Screenshot: Silver workspace, narrow folder rail, generous intake well, aubergine preparation field and a single marigold active path.

## System

- Ground: Ice Silver #DDE3E8. Ink/curtain: Deep Aubergine #3A0F34. Signal: Marigold #EAAA00. Reading surface: #FFFFFF. Muted text: #665161. Line: #CBD3DB.
- Type: existing locally hosted Bricolage Grotesque Variable for headings and numerals; Geist Variable for interface text. Display 30–42px, body 14–16px, informative captions 12–13px. Tabular metrics.
- Grid: 12-column desktop logic, 220–250px folder rail plus flexible content; Training uses a wide preparation canvas and a narrow stage rail. At tablet the rail compresses; at phone it becomes an inline panel with fully available controls.
- Radius: 20px outer workspaces, 12px controls, 8px small labels. Depth: one restrained shadow and a white inner edge. No nested glass blur on every source row.
- Motion: GSAP lifecycle for new entrance and active pulse, one shared ticker, 180–420ms ease-out. No scroll hijacking, loader, cursor replacement or WebGL in these working screens. Native scroll is intentional for file lists and forms. Lenis is installed for the skill's toolkit but is not enabled in this application workspace.
- Idle: these working screens are intentionally still when no job is running. Hover/press/focus feedback and drag state carry interaction. Existing mascot motion is kept away from dense reading rows.
- Numbers: only actual counts and backend task percentages; no invented throughput, duration or completion estimates. Offline demo preparation remains labeled demo.

## Compositions

Upload:
```
heading + purpose                         actual source readiness
folder rail | intake well + file-stack visual
            | quick actions + import settings disclosure
            | source search, status filters, sort
            | readable document register / empty state
            | Google Drive connection and import controls
back                                             continue
```

Training:
```
heading + live/ready state
preparation canvas                  | ordered stage rail
actual source / passage counts      | next action
source queue and previews           | source quality
expandable agent activity (real job data)
back                                             try assistant
```

## Genericness check

Avoided an ornamental dashboard of equal KPI cards, a fake terminal, random network particles and fabricated processing speed. The archive rail, intake paper stack, exact source locators and backend-state preparation map are grounded in Anvesha's real workflow. The supplied Frost Cloud is limited to an empty state. The palette is a direct user constraint.

## QA scope

Run production builds, real desktop/mobile workflows, keyboard and reduced-motion paths. Use two screenshot/review passes at 1440px and 390px, plus tablet/wide checks and axe. Capture both empty and populated Upload and ready Training. Review only synthetic test projects and fictional sample documents. Internal app screens are not marketing pages; search indexing, sitemap and public SEO are outside this change. No external deployment or account access is needed. The previously authorized local service is refreshed after checks.

## Expanded scope

The user expanded the brief to the full website and inside application. The same materials now cover the public navigation and product preview, sign-in and onboarding, project library, chat and source inspector, and modal/settings surfaces through `src/styles/premium.css`. Upload and Training retain their own more specific workspace composition. Existing functionality and the user-selected palette stay central.
# Demo retrieval and cloud identity

The supplied frosted cloud is now the animated Anvesha brand mark, with the same silver, aubergine and marigold palette. It remains decorative inside navigation links, avoiding nested interactive controls. Motion pauses offscreen, in hidden tabs and under reduced-motion preferences.

Preparation is presented as observable document tools: read, OCR where needed, prepare passages, suggest labels/tags/questions and build search. Categories are rule-based suggestions from current extracted text. User tags are preserved independently. Signed-in document ingestion automatically schedules indexing; registered stored document updates are checked every 15 seconds, while Drive retains its explicit chosen-folder sync workflow.
