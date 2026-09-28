import io
import math
import struct
import unittest
import wave
from diary.media import analyze_audio, InvalidMedia


def tone(amplitude, seconds=1):
    out = io.BytesIO()
    with wave.open(out, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b''.join(struct.pack('<h', int(amplitude * math.sin(i * math.tau * 440 / 16000))) for i in range(int(16000 * seconds))))
    return out.getvalue()


class LoudnessTests(unittest.TestCase):
    def test_integrated_loudness_and_headroom(self):
        quiet = analyze_audio(tone(3000), '.wav')
        loud = analyze_audio(tone(16000), '.wav')
        self.assertGreater(quiet['gain_db'], loud['gain_db'])
        for data in (quiet, loud):
            self.assertAlmostEqual(data['integrated_lufs'] + data['gain_db'], -14, delta=.1)
            self.assertLessEqual(data['true_peak_dbfs'] + data['gain_db'], -1)

    def test_short_valid_and_corrupt_audio(self):
        self.assertIn('gain_db', analyze_audio(tone(3000, .1), '.wav'))
        with self.assertRaises(InvalidMedia):
            analyze_audio(b'not a wav', '.wav')
