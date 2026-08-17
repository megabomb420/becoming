from PIL import Image, ImageDraw

def create_icon(size, maskable=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = size // 6 if maskable else 0
    x, y, w, h = pad, pad, size - pad * 2, size - pad * 2
    radius = size // 2 if maskable else size // 5
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(26, 24, 20, 255))
    cx, cy = size // 2, size // 2
    body_w, body_h = int(w * 0.6), int(h * 0.56)
    draw.ellipse([cx - body_w // 2, cy - body_h // 2 + 5, cx + body_w // 2, cy + body_h // 2 + 5], fill=(169, 152, 128, 255))
    face_w, face_h = int(body_w * 0.73), int(body_h * 0.64)
    draw.ellipse([cx - face_w // 2, cy - face_h // 2 - 2, cx + face_w // 2, cy + face_h // 2 - 2], fill=(200, 195, 180, 255))
    eye_w, eye_h = int(size * 0.05), int(size * 0.06)
    draw.ellipse([cx - face_w // 3 - eye_w // 2, cy - 6 - eye_h // 2, cx - face_w // 3 + eye_w // 2, cy - 6 + eye_h // 2], fill=(42, 32, 24, 255))
    draw.ellipse([cx + face_w // 3 - eye_w // 2, cy - 6 - eye_h // 2, cx + face_w // 3 + eye_w // 2, cy - 6 + eye_h // 2], fill=(42, 32, 24, 255))
    # Shine
    shine_r = max(1, size // 60)
    draw.ellipse([cx - face_w // 3 - eye_w // 4, cy - 8, cx - face_w // 3, cy - 4], fill=(255, 255, 255, 160))
    draw.ellipse([cx + face_w // 3 - eye_w // 4, cy - 8, cx + face_w // 3, cy - 4], fill=(255, 255, 255, 160))
    # Nose
    draw.ellipse([cx - 2, cy + 3, cx + 2, cy + 6], fill=(58, 48, 40, 255))
    # Mouth
    draw.arc([cx - 5, cy + 4, cx + 5, cy + 10], 0, 180, fill=(58, 48, 40, 255), width=max(1, size // 80))
    return img

create_icon(192).save('public/icon-192.png')
create_icon(512).save('public/icon-512.png')
create_icon(512, maskable=True).save('public/icon-maskable.png')
create_icon(180).save('public/apple-touch-icon.png')
print('Icons created successfully')
