import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from backend.answers import (GroundedDraft, GroundingError, SupportReview, contextual_sources,
    grounded_answer, provider_error, quoted_answer)

PASSAGE = {'id': 'c1', 'sourceId': 's1', 'sourceTitle': 'Critique of Pure Reason', 'fileType': 'Image',
           'locator': {'kind': 'section', 'heading': 'Image 1 (OCR)', 'ordinal': 1},
           'text': 'Critique of Pure Reason\nEvery beginning is in time, and every limit of extension in space. Space and time exist in the world of sense only.'}


def draft(quote='Every beginning is in time', text='The passage says that a beginning is something we experience in time.'):
    return GroundedDraft(status='answer', statements=[{'text': text, 'evidence': [{'source': 'S1', 'quote': quote}]}],
                         follow_up_questions=['What does the passage mean by time?', 'How does it describe space?', 'What is the world of sense in this passage?'])


class GroundedAnswerTests(unittest.TestCase):
    def test_plain_language_answer_has_real_quotes_model_and_questions(self):
        writer = AsyncMock(side_effect=[draft(), SupportReview(supported=True)])
        with patch('backend.answers.invoke_structured', writer):
            answer = asyncio.run(grounded_answer('Explain this in simple English.', '', [PASSAGE], [], ['OCR warning']))
        self.assertEqual(answer['method'], 'model')
        self.assertEqual(answer['framework'], 'langchain')
        self.assertEqual(answer['grounding'], 'reviewed')
        self.assertNotEqual(answer['text'], PASSAGE['text'])
        self.assertIn('[1]', answer['text'])
        self.assertIn(answer['citations'][0]['highlight'], PASSAGE['text'])
        self.assertEqual(len(answer['suggestions']), 3)
        self.assertFalse(answer['showHandover'])
        self.assertEqual(answer['warnings'], ['OCR warning'])
        self.assertEqual(writer.await_count, 2)

    def test_fabricated_quote_is_blocked_before_review(self):
        writer = AsyncMock(return_value=draft('Kant said there are twelve universes.'))
        with patch('backend.answers.invoke_structured', writer), self.assertRaises(GroundingError):
            asyncio.run(grounded_answer('Explain it.', '', [PASSAGE], [], []))
        self.assertEqual(writer.await_count, 1)

    def test_incomplete_suggestions_are_filled_without_repeating_the_question(self):
        value = draft()
        value.follow_up_questions = ['What does the passage mean by time?']
        with patch('backend.answers.invoke_structured', AsyncMock(side_effect=[value, SupportReview(supported=True)])):
            answer = asyncio.run(grounded_answer('Explain this in simple English.', '', [PASSAGE], [], []))
        self.assertEqual(len(answer['suggestions']), 3)
        self.assertNotIn('Explain this in simple English.', answer['suggestions'])

    def test_real_quote_does_not_automatically_validate_an_unsupported_claim(self):
        with patch('backend.answers.invoke_structured', AsyncMock(side_effect=[draft(text='The universe is exactly twelve years old.'), SupportReview(supported=False)])):
            with self.assertRaises(GroundingError):
                asyncio.run(grounded_answer('Explain it.', '', [PASSAGE], [], []))

    def test_out_of_range_citation_is_rejected(self):
        value = draft()
        value.statements[0].evidence[0].source = 'S8'
        with patch('backend.answers.invoke_structured', AsyncMock(return_value=value)), self.assertRaises(GroundingError):
            asyncio.run(grounded_answer('Explain it.', '', [PASSAGE], [], []))

    def test_history_is_context_not_added_as_source_evidence(self):
        history = [{'role': 'user', 'text': 'What does the passage say?'}]
        writer = AsyncMock(side_effect=[draft(), SupportReview(supported=True)])
        with patch('backend.answers.invoke_structured', writer):
            asyncio.run(grounded_answer('Explain it.', '', [PASSAGE], history, []))
        context = writer.await_args_list[0].args[1]
        self.assertEqual(context['conversation'], history)
        self.assertEqual(len(context['documents']), 1)
        self.assertEqual(context['documents'][0]['text'], PASSAGE['text'])

    def test_followup_anchors_current_source_even_after_a_limitation_reply(self):
        project = {'draft': {'sources': [{'id': 's1', 'title': 'Kant', 'fileType': 'Image', 'visibility': 'internal',
                     'status': 'ready', 'chunks': [PASSAGE]}], 'faqs': [], 'conflicts': []}}
        history = [{'role': 'user', 'text': 'What does Kant say about space?'},
                   {'role': 'assistant', 'text': 'Old reply', 'answer': {'citations': [{'chunkId': 'c1', 'sourceId': 's1', 'excerpt': PASSAGE['text']}]}},
                   {'role': 'user', 'text': 'Explain this.'}, {'role': 'assistant', 'text': 'AI unavailable', 'answer': {'citations': []}}]
        query, pinned = contextual_sources(project, 'Help me understand in simple English.', history)
        self.assertIn('Kant', query)
        self.assertEqual(pinned[0]['id'], 'c1')
        project['draft']['sources'][0]['chunks'][0] = {**PASSAGE, 'text': 'New source text'}
        self.assertEqual(contextual_sources(project, 'Explain this.', history)[1], [])

    def test_quotes_never_pretend_to_explain(self):
        reply = quoted_answer('Help me understand in simple English.', [PASSAGE], [])
        self.assertEqual(reply['kind'], 'clarify')
        self.assertEqual(reply['method'], 'limitation')
        self.assertNotIn(PASSAGE['text'], reply['text'])
        self.assertIn('Switch to AI answers', reply['text'])

    def test_provider_errors_are_actionable_and_do_not_expose_raw_details(self):
        for error, expected in [('402 RESOURCE_EXHAUSTED secret-key', 'prepaid'),
                                ('403 API_KEY_SERVICE_BLOCKED secret-key', 'restrictions'),
                                ('403 SERVICE_DISABLED secret-key', 'disabled')]:
            failure = provider_error(RuntimeError(error))
            self.assertIn(expected, failure.detail)
            self.assertNotIn('secret-key', failure.detail)


if __name__ == '__main__':
    unittest.main()
