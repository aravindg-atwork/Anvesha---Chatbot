You are the lead product designer and full-stack engineer for Anvesha. Build a polished, presentation-ready web application prototype that a nontechnical organisation owner can confidently use.

1. Product and objective

1.1. Product name: Anvesha.
Tagline: “Your knowledge. Clear answers.”

1.2. Anvesha lets organisations create assistants using their documents, FAQs and written information, define their behaviour, test answers with supporting sources, and publish through a website widget or API.

1.3. The immediate deliverable is a working web prototype suitable for a live CEO/client demonstration.

1.4. Inspect the repository, project instructions and existing implementation first. Preserve working functionality and data. Replace previous ChatAssist branding in user-facing content.

1.5. If starting from an empty repository, use React, TypeScript and Vite, with a maintainable component structure. Use existing project conventions when present.

1.6. Make reasonable implementation decisions and complete the work. Ask questions only for genuine blockers.

2. Design standard

2.1. Create a premium, calm and approachable experience for users with little computer knowledge.

2.2. Use warm ivory backgrounds, white surfaces, charcoal text and deep emerald accents. Use refined typography, generous spacing, subtle borders and restrained shadows.

2.3. Use readable 16–18px body text, comfortable controls, visible focus states and accessible contrast.

2.4. Avoid crowded panels, tiny document names, decorative statistics, excessive badges and large amounts of explanatory text.

2.5. Present one meaningful task at a time. Keep a clear primary action and a visible Back action.

2.6. Use subtle transitions and respect reduced-motion preferences.

2.7. Desktop is the main presentation format. Ensure the layout also works on tablets and phones without shrinking text.

3. Entry and account flow

3.1. Build an elegant landing page with a concise explanation, an interactive example and “Create your assistant.”

3.2. Provide sign-up/sign-in screens and an obvious “Explore demo” option.

3.3. Demo mode must work without external credentials. Clearly distinguish demo access from real authentication.

3.4. Ask for organisation name and enter the guided creation flow directly.

3.5. Returning users can resume unfinished setup or open an existing assistant.

4. Guided creation

4.1. Use five steps:
Describe → Add knowledge → Review → Try → Share.

4.2. Display these in a discreet progress indicator. Allow revisiting completed steps.

4.3. Save progress automatically and preserve it after refresh.

4.4. Do not require users to understand “workspace,” “system prompt,” “RAG” or “deployment” to complete setup.

5. Describe

5.1. Heading:
“What would you like your assistant to help with?”

5.2. Provide a generous text field with an example:
“Help employees understand our leave policy and benefits.”

5.3. Offer optional starter choices:
Employee questions, College admissions, Customer questions and Something else.

5.4. Suggest an editable assistant name and purpose using the description. Use transparent templates when no generation service exists.

5.5. Keep Anvesha as the platform name. Customers can name individual assistants, such as AskHR.

6. Add knowledge

6.1. Heading:
“Give your assistant the information it needs.”

6.2. Provide three options:
Upload files, Add questions and answers, Write information.

6.3. Support readable source rows with full titles, file type, status and contextual actions.

6.4. Implement processing states:
Reading file, Ready and Needs attention.

6.5. Include duplicate detection, empty-file checks, unsupported-format handling, retry, replace and remove.

6.6. Implement real TXT and FAQ CSV ingestion. Support PDF/DOCX extraction using suitable existing or reputable dependencies where feasible. Page references must originate from actual extraction.

6.7. For unsupported extraction or scanned files, explain the limitation. Never generate fake extracted text or fabricated page references.

6.8. Provide an extracted-content preview so owners can check what the assistant will read.

6.9. FAQs support add, edit, delete and CSV import with Question and Answer columns. Preview and validate imports.

6.10. Allow optional source version, effective date and explicit superseding relationships.

6.11. Surface conflicts in the bundled demonstration. Label any general-purpose conflict detection according to what it actually implements.

6.12. Preserve unresolved conflicts for review rather than silently choosing whichever file was uploaded last.

7. Review identity and behaviour

7.1. Heading:
“Here’s how your assistant will help.”

7.2. Show editable name, purpose, language and greeting.

7.3. Provide an ordinary-language behaviour description, for example:
“Help employees understand company policies. Explain answers simply using the information provided. Ask for clarification when needed and explain how to get more help when the documents do not answer the question.”

7.4. Ask for an optional handover contact and process.

7.5. Put the full master instructions under “Custom instructions,” with a spacious editor.

7.6. Behavioural instructions and factual sources must remain distinct. Uploaded text cannot override the assistant’s operating rules.

8. Try the assistant

8.1. Heading:
“Try a question your users might ask.”

8.2. Start with a focused chat and a prominent composer close to the heading. After conversation begins, anchor the composer below the messages.

8.3. Show natural suggested questions relevant to available sources.

8.4. Display “Private preview” and identify that testing uses the current draft.

8.5. Answers include compact source references and “View sources.”

8.6. Source inspection opens beside the conversation with document name, genuine page/section reference and the supporting excerpt highlighted.

8.7. Distinguish PDF page index from printed page labels when available. Cite FAQs by entry title or ID.

8.8. Evidence labels may be Strong support, Partial support or No supporting source. Explain their basis. Do not invent confidence percentages or imply that retrieval similarity proves correctness.

8.9. Handle missing information, ambiguous questions and conflicting passages explicitly.

8.10. Include “Was this helpful?” and an improvement flow that leads to relevant source, FAQ or instruction edits.

8.11. Feedback never silently changes knowledge. Edits remain draft changes.

8.12. Mark older answers as belonging to an earlier draft after sources or instructions change. Do not erase the conversation.

9. Chat implementation and demonstration reliability

9.1. Separate the chat provider from the interface.

9.2. If real model access is configured, call it through a server-side boundary and keep credentials out of browser code.

9.3. Provide a deterministic demo mode that works without credentials or network access after installation.

9.4. Deterministic demo answers must be derived from bundled, consistent fictional sources and clearly identified as demonstration behaviour.

9.5. User-uploaded content must never receive unrelated answers from the sample HR dataset.

9.6. If a question cannot be answered reliably by the available engine, return an honest limitation and supporting passages where relevant.

9.7. Clearly distinguish functioning extraction, retrieval, generated responses and scripted demo responses.

10. Share and publication

10.1. Heading:
“Choose how people will use your assistant.”

10.2. Ask audience first:
Anyone or Only authorised users.

10.3. Public knowledge must be explicitly included for public use. Internal-only sources must not enter public retrieval or citations.

10.4. Simulated internal authentication must be labelled and must not be presented as production protection.

10.5. Then offer:
On my website or In my application.

10.6. Show a concise publication review with included sources and material warnings.

10.7. Maintain immutable published snapshots separate from editable drafts.

10.8. Draft changes must not alter published responses until republished.

10.9. Provide unpublish and demonstrate that the published preview stops answering.

10.10. Explain publication and installation separately. Do not claim the assistant is installed on a website merely because publishing succeeded.

11. Widget and API

11.1. Website integration shows a realistic interactive widget preview with colour, greeting, position and floating/inline options.

11.2. Provide “Get installation instructions” and copyable div/JavaScript examples using a public widget identifier.

11.3. Include a developer-friendly handoff explanation for nontechnical owners.

11.4. API integration shows endpoint, bot ID, authentication and copyable cURL/server-side JavaScript examples.

11.5. Label nonfunctional external endpoints and demo credentials honestly. Keep real secret keys out of browser storage and frontend snippets.

11.6. Widget previews and API demonstrations must use the published version consistently.

12. After-launch home

12.1. Lead with assistant name, purpose, status and “Open assistant.”

12.2. Main actions:
Update information, Review conversations, Manage installation.

12.3. Provide an end-user preview free of owner controls, internal notes and testing labels.

12.4. Separate test and published conversation logs. Calculate metrics from actual interactions or label them as sample data.

12.5. Let owners review unanswered questions and create an FAQ draft with an explicitly approved answer.

12.6. Keep version history, advanced studio and settings secondary.

12.7. Allow a direct update flow without forcing users through initial onboarding again.

13. Practical behaviour

13.1. The assistant explains policy and documented next steps. It does not claim authority to approve leave, reject claims, grant admission or determine legal outcomes.

13.2. Human handover must distinguish displaying contact details from actually submitting a request.

13.3. Preserve typed questions on service errors and offer retry.

13.4. Support source review dates and outdated-source notices in the prototype.

13.5. Explain what conversation data is stored. Provide a clear demo reset action with confirmation.

13.6. Provide immediate unpublish for urgent exposure concerns.

14. Presentation dataset and story

14.1. Include an optional fictional company, “VayuTech,” with an assistant named “AskHR.”

14.2. Bundle actual readable demo documents or equivalent inspectable source records with internally consistent citations.

14.3. Required policy passage:
“Employees on probation are not eligible for casual leave. Requests concerning family emergencies must be submitted to HR for individual review. Submission does not guarantee approval.”

14.4. Required demonstration question:
“I am on probation and my mother is hospitalised. Can I take three days’ leave?”

14.5. Expected response:
Explain the restriction, acknowledge the emergency, describe HR review and cite the passage. Do not approve or reject the request.

14.6. Include additional examples:
A straightforward supported question, an ambiguous question, an unsupported question and conflicting policy versions.

14.7. Provide a private demo launcher that can open:
An empty new organisation, a ready-to-test sample and a published sample.

14.8. Keep demo controls separate from customer workflows. Make resetting the sample fast and predictable.

15. Engineering and verification

15.1. Inspect existing code before changing architecture. Keep business logic separate from UI components.

15.2. Preserve data or provide a safe migration. Do not wipe saved content to simplify implementation.

15.3. Implement loading, empty, failure and success states. No dead primary buttons.

15.4. Run the appropriate build, type checks and meaningful tests.

15.5. Test isolation between assistants, draft/published separation, source inclusion, citation integrity and persistence.

15.6. Check representative desktop and mobile layouts visually using available browser tools. Fix clipped content, awkward scrolling and crowded controls.

15.7. Verify the complete demo:
Create organisation → Describe assistant → Add knowledge → Review → Ask emergency question → Inspect citation → Improve draft → Retest → Publish → Try widget → Edit draft → Confirm published answer is unchanged → Republish → Review conversation → Unpublish.

15.8. If visual verification or a service integration cannot be performed, state the precise limitation.

16. Delivery

16.1. Implement the application and persist until the complete presentation journey works.

16.2. Finish with:
How to run it, what is functional, what is simulated, checks performed and remaining limitations.

16.3. Include a short five-minute presenter walkthrough with exact demo questions and expected outcomes.

16.4. Provide any required environment-variable example without real secrets.

16.5. Prioritise the guided workflow, readable source evidence and dependable live demonstration. Add further features only after that journey is complete.