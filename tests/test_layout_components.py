                                                                               
import unittest
from pathlib import Path
from html.parser import HTMLParser
from jinja2 import Environment, FileSystemLoader


class Tags(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class LayoutComponentsTests(unittest.TestCase):
    def setUp(self):
        env = Environment(loader=FileSystemLoader(Path(__file__).resolve().parents[1] / 'templates'))
        self.card = env.get_template('components/cards/profile_track_card.html').module.profile_track_card
        self.track = dict(id=42, title='Track', artist='Artist', cover='/cover', duration='1:00',
                          detail_url='/track/42', audio_url='/audio')

    def test_picker_has_only_selection_and_shared_geometry_classes(self):
        tags = Tags(str(self.card(self.track, context='picker'))).tags
        self.assertFalse(any(tag == 'button' for tag, attrs in tags))
        inputs = [attrs for tag, attrs in tags if tag == 'input']
        self.assertEqual(len(inputs), 1)
        self.assertEqual(inputs[0]['type'], 'checkbox')
        self.assertEqual(inputs[0]['value'], '42')
        self.assertIn(('label', {'class': 'profile-track playlist-track-choice'}), tags)
        self.assertTrue(any(attrs.get('class') == 'profile-track-cover' for tag, attrs in tags))
        self.assertFalse(any('data-href' in attrs for tag, attrs in tags))

    def test_profile_and_playlist_keep_actions_and_initial_hidden_state(self):
        for context in ('profile', 'playlist'):
            with self.subTest(context=context):
                tags = Tags(str(self.card(self.track, context=context, hidden=True))).tags
                self.assertEqual(sum(tag == 'button' for tag, attrs in tags), 4)
                article = next(attrs for tag, attrs in tags if tag == 'article')
                self.assertIn('hidden', article)
                self.assertEqual(article['data-track-id'], '42')
                visible = Tags(str(self.card(self.track, context=context))).tags
                self.assertNotIn('hidden', next(attrs for tag, attrs in visible if tag == 'article'))

    def test_queue_reuses_compact_card_for_single_multiple_and_overflow_lists(self):
        self.track.update(title='Long title ' * 100, artist='Long artist ' * 100, cover='/large-cover.png')
        for count in (1, 3, 40):
            with self.subTest(count=count):
                tags = Tags(''.join(str(self.card(self.track, context='queue')) for _ in range(count))).tags
                self.assertEqual(sum(tag == 'article' and attrs.get('class') == 'profile-track sonary-queue-item' for tag, attrs in tags), count)
                self.assertEqual(sum(attrs.get('class') == 'profile-track-cover' for tag, attrs in tags), count)
                self.assertEqual(sum('data-queue-play' in attrs for tag, attrs in tags), count)
                self.assertEqual(sum('data-queue-remove' in attrs for tag, attrs in tags), count)
                self.assertFalse(any('data-href' in attrs for tag, attrs in tags))
