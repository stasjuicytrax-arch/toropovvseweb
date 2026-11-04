"""Extract the supplied logo's alpha silhouette for vector tracing; no artwork edits."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
output = root / '.cache' / 'logo-mask.png'
output.parent.mkdir(exist_ok=True)
logo = Image.open(root / 'logo' / 'assets' / 'logo.png').convert('RGBA')
ImageOps.invert(logo.getchannel('A')).save(output)
print(f'Prepared alpha silhouette: {logo.width} x {logo.height}')
