import io
import wave
from PIL import Image
from mutagen.id3 import ID3, TIT2, TPE1, APIC

def wav_bytes():
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b'\x00\x00' * 8000)
    return output.getvalue()

def png_bytes(color='orange'):
    output = io.BytesIO()
    Image.new('RGB', (100, 100), color).save(output, 'PNG')
    return output.getvalue()

def mp3_bytes(tags=False):
                                                                              
    content = (b'\xff\xfb\x90\x64' + b'\x00' * 413) * 40
    if not tags:
        return content
    output = io.BytesIO(content)
    metadata = ID3()
    metadata.add(TIT2(encoding=3, text=['Metadata title']))
    metadata.add(TPE1(encoding=3, text=['Metadata artist']))
    metadata.add(APIC(encoding=3, mime='image/png', type=3, data=png_bytes('blue')))
    metadata.save(output)
    return output.getvalue()
