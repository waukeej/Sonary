import io
import math
import re
import uuid
import warnings
import wave
import json
import subprocess
import tempfile
import os
from imageio_ffmpeg import get_ffmpeg_exe
from pathlib import Path
from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError

class InvalidMedia(ValueError):
    pass

def path(kind, filename):
    pattern = r'[0-9a-f]{32}\.(mp3|wav)' if kind == 'audio' else r'[0-9a-f]{32}\.png'
    if not re.fullmatch(pattern, filename or ''):
        raise ValueError('Invalid storage filename')
    return Path(current_app.config['TRACK_AUDIO_FOLDER' if kind == 'audio' else 'TRACK_COVER_FOLDER']) / filename

def remove(kind, filename):
    if filename:
        try:
            if referenced('tracks', kind + '_filename', filename):
                return
            path(kind, filename).unlink(missing_ok=True)
            if kind == 'audio':
                path(kind, filename).with_suffix(path(kind, filename).suffix + '.json').unlink(missing_ok=True)
        except (OSError, ValueError):
            current_app.logger.exception('Could not remove track file')

def referenced(table, column, filename):
    from database import get_db
    from psycopg import sql
    return get_db().execute(sql.SQL('SELECT 1 FROM {} WHERE {}=%s LIMIT 1').format(
        sql.Identifier(table), sql.Identifier(column)), (filename,)).fetchone() is not None

def store(kind, content, extension):
    filename = uuid.uuid4().hex + '.' + extension
    target = path(kind, filename)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open('xb') as output:
            output.write(content)
    except Exception:
        remove(kind, filename)
        raise
    return filename

def read_bounded(upload, limit, message):
    content = upload.read(limit + 1)
    if len(content) > limit:
        raise InvalidMedia(message)
    if not content:
        raise InvalidMedia('Файл пустой.')
    return content

def image(content):
    if len(content) > current_app.config['TRACK_COVER_MAX_BYTES']:
        raise InvalidMedia('Обложка должна быть не больше 5 МБ.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as original:
                if original.format not in ('PNG', 'JPEG', 'WEBP') or original.width * original.height > 16_000_000:
                    raise InvalidMedia('Выберите PNG, JPEG или WebP до 16 мегапикселей.')
                original.verify()
            with Image.open(io.BytesIO(content)) as original:
                clean = ImageOps.exif_transpose(original).convert('RGB')
                clean.thumbnail((1024, 1024))
                output = io.BytesIO()
                clean.save(output, 'PNG')
                return output.getvalue()
    except InvalidMedia:
        raise
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise InvalidMedia('Не удалось прочитать обложку.') from None

def audio(upload):
    content = read_bounded(upload, current_app.config['TRACK_AUDIO_MAX_BYTES'], 'Аудиофайл должен быть не больше 80 МБ.')
    extension = Path(upload.filename or '').suffix.lower()
    if extension not in ('.mp3', '.wav'):
        raise InvalidMedia('Поддерживаются только MP3 и WAV.')
    try:
        if extension == '.wav':
            if content[:4] != b'RIFF' or content[8:12] != b'WAVE':
                raise ValueError('Not WAV')
            with wave.open(io.BytesIO(content)) as pcm:
                expected = pcm.getnframes() * pcm.getnchannels() * pcm.getsampwidth()
                if expected <= 0 or len(pcm.readframes(pcm.getnframes())) != expected:
                    raise ValueError('Truncated WAV')
            parsed = WAVE(io.BytesIO(content))
        else:
            parsed = MP3(io.BytesIO(content))
        duration = float(parsed.info.length)
        if not math.isfinite(duration) or duration <= 0 or not parsed.info.channels or not parsed.info.sample_rate:
            raise ValueError('Invalid audio information')
    except (MutagenError, wave.Error, EOFError, ValueError, OSError):
        raise InvalidMedia('Не удалось прочитать MP3 или WAV. Проверьте файл.') from None
    metadata = {'title': '', 'artist': '', 'cover': None, 'loudness': analyze_audio(content, extension)}
    if parsed.tags:
        for name, frame in [('title', 'TIT2'), ('artist', 'TPE1')]:
            tag = parsed.tags.get(frame)
            if tag and tag.text:
                metadata[name] = str(tag.text[0]).replace('\x00', '').strip()[:255]
        for tag in parsed.tags.getall('APIC'):
            try:
                metadata['cover'] = image(tag.data)
                break
            except InvalidMedia:
                continue
    return content, extension[1:], duration, metadata


def analyze_audio(content, extension):
    with tempfile.TemporaryDirectory(prefix='sonary-audio-') as folder:
        source = Path(folder) / ('input' + extension)
        source.write_bytes(content)
        try:
            result = subprocess.run([get_ffmpeg_exe(), '-hide_banner', '-nostats', '-nostdin', '-xerror',
                '-protocol_whitelist', 'file,pipe', '-f', extension[1:], '-i', str(source),
                '-map', '0:a:0', '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
                '-progress', 'pipe:1', '-f', 'null', '-'], capture_output=True, timeout=120,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            if result.returncode or not any(int(v) > 0 for v in re.findall(rb'out_time_us=(\d+)', result.stdout)):
                raise ValueError('Decode failed')
            report = json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', result.stderr.decode('utf-8', 'replace'))[-1])
            integrated, peak = float(report['input_i']), float(report['input_tp'])
        except (OSError, RuntimeError, ValueError, IndexError, KeyError, subprocess.TimeoutExpired):
            raise InvalidMedia('Не удалось прочитать MP3 или WAV. Проверьте файл.') from None
    if not math.isfinite(integrated) or not math.isfinite(peak):
        return {'gain_db': 0, 'target_lufs': -14}
    return {'integrated_lufs': integrated, 'true_peak_dbfs': peak,
            'gain_db': min(12, -14 - integrated, -1 - peak), 'target_lufs': -14}


def loudness(filename):
    if filename:
        try:
            return json.loads(path('audio', filename).with_suffix(Path(filename).suffix + '.json').read_text())
        except (OSError, ValueError):
            pass
    return {'gain_db': 0}
