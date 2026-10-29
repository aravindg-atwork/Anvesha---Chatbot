# Anvesha product direction

Research reviewed official product documentation in this session. This is a focused market map, not an exhaustive inventory or a hands-on quality benchmark. Pricing and plan entitlements need rechecking before sales comparisons.

| Product | Documented strengths | How Anvesha should respond |
| --- | --- | --- |
| [Chatbase](https://www.chatbase.co/features/product-overview) | Customer-facing agents, actions, channels, testing and analytics | Keep setup understandable; make every document and answer inspectable before adding channel breadth. |
| [Intercom Fin](https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained) | Guidance, connected data, procedures, improvement suggestions and support operations | Build a review loop from unanswered questions to approved knowledge. This is a roadmap item. |
| [Zendesk](https://support.zendesk.com/hc/en-us/articles/6970583409690-About-AI-agents) | Knowledge-based support, authorized actions, scripted dialogues and analytics | Preserve clear human review and measurable outcomes as automation grows. |
| [Botpress](https://botpress.com/docs/studio/concepts/knowledge-base/introduction/) | Documents, websites, tables and integrations as knowledge sources | Keep table references understandable and make source setup simpler than an agent workflow editor. |
| [Glean](https://docs.glean.com/connectors/about) | Connectors that index source content and permissions, permission-aware retrieval | Treat access controls as a requirement for team deployment. Current Anvesha project isolation is not equivalent to full enterprise source ACL synchronization. |
| [Google notebook tools](https://support.google.com/gemininotebook/answer/16215270) | Source selection, organization, source guides and broad input types | Give users direct control of organization. Unlike automatic default labeling, Anvesha requires users to name and choose folders and approve placement suggestions. |

## The immediate product flow

Name a folder → optionally choose a parent → upload into it → inspect readiness → ask a suggested question → open its source reference.

Anvesha's latest change implements user-named folders, parent selection for subfolders, rename with existing content preserved, explicit upload destinations, and optional existing-folder suggestions in Source details. Suggestions use document content and folder names; they are rules-based hints and only move a source when the user saves.

## What can distinguish Anvesha

The proposed position is a simple document workspace where people control organization and can inspect the evidence behind answers. It must be demonstrated through retrieval quality and usability, rather than claimed as unique: citations, suggestions and conflict detection already exist in competing products.

Priorities after this folder iteration:

1. Measure retrieval with representative customer questions, including missing answers, conflicting versions and tables.
2. Display source freshness and meaningful changes; turn unanswered questions into owner-approved information.
3. Implement permission-aware shared access before selling internal corporate knowledge access.
4. Complete Nova and live Drive verification on the VM.
5. Add actions and channels only for a validated customer workflow.

Self-hosting and AWS model choice are potential reasons to choose Anvesha; Nova is not yet connected, and no compliance certification is claimed.
