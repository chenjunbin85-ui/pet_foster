from PIL import Image
import os

def check_edge_halo(path):
    """检查插画边缘是否有半透明白边"""
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = img.load()
    
    print(f"\n=== {os.path.basename(path)} ===")
    
    # 找插画主体的边界框
    min_x, max_x = w, 0
    min_y, max_y = h, 0
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] > 10:  # 非透明
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    
    print(f"  主体边界: x[{min_x},{max_x}] y[{min_y},{max_y}]")
    
    # 检查主体边界外一圈的半透明像素（alpha 在 10-200 之间）
    halo_count = 0
    halo_samples = []
    for y in range(max(0, min_y-5), min(h, max_y+6)):
        for x in range(max(0, min_x-5), min(w, max_x+6)):
            r, g, b, a = pixels[x, y]
            if 5 < a < 200:  # 半透明
                # 检查是否在主体边界外
                outside = x < min_x or x > max_x or y < min_y or y > max_y
                if outside:
                    halo_count += 1
                    if len(halo_samples) < 5:
                        halo_samples.append(f"({x},{y}):RGBA({r},{g},{b},{a})")
    
    print(f"  边界外半透明像素: {halo_count}")
    for s in halo_samples:
        print(f"    {s}")
    
    return halo_count

files = [
    r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\todo-illustration.png",
    r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\pet-status-illustration.png",
]

for f in files:
    if os.path.exists(f):
        check_edge_halo(f)
    else:
        print(f"文件不存在: {f}")
