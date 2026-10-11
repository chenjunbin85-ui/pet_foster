from PIL import Image
import os

def check_transparency(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = img.load()
    
    # 检查四角和边缘的 alpha 值
    corners = [
        ("左上角", (0, 0)),
        ("右上角", (w-1, 0)),
        ("左下角", (0, h-1)),
        ("右下角", (w-1, h-1)),
        ("上边中点", (w//2, 0)),
        ("下边中点", (w//2, h-1)),
        ("左边中点", (0, h//2)),
        ("右边中点", (w-1, h//2)),
    ]
    
    print(f"\n=== {os.path.basename(path)} ({w}x{h}) ===")
    for name, (x, y) in corners:
        r, g, b, a = pixels[x, y]
        print(f"  {name}: RGBA({r},{g},{b},{a}) {'透明' if a == 0 else '不透明!'}")
    
    # 统计透明像素数量
    transparent = 0
    total = w * h
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] == 0:
                transparent += 1
    print(f"  透明像素: {transparent}/{total} ({transparent*100//total}%)")

files = [
    r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\todo-illustration.png",
    r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\pet-status-illustration.png",
]

for f in files:
    if os.path.exists(f):
        check_transparency(f)
    else:
        print(f"文件不存在: {f}")
