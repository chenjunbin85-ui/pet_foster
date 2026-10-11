from PIL import Image
from collections import deque
import os

def is_near_white(pixel, threshold=243):
    return pixel[0] > threshold and pixel[1] > threshold and pixel[2] > threshold

def remove_white_bg(input_path, output_path, threshold=243):
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    visited = set()
    queue = deque()

    # 从四条边的白色像素开始
    for x in range(w):
        for y in [0, h-1]:
            if (x, y) not in visited and is_near_white(pixels[x, y], threshold):
                queue.append((x, y))
                visited.add((x, y))
    for y in range(h):
        for x in [0, w-1]:
            if (x, y) not in visited and is_near_white(pixels[x, y], threshold):
                queue.append((x, y))
                visited.add((x, y))

    # BFS 扩散
    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)  # 完全透明
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                if is_near_white(pixels[nx, ny], threshold):
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    img.save(output_path, 'PNG')
    print(f"  已处理: {os.path.basename(output_path)}")

# 处理6张快捷入口插画
src_dir = r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\quick-entry"
files = ["orders.png", "customers.png", "pets.png", "health.png", "services.png", "stats.png"]

print("开始抠图（去除白色背景）...")
for f in files:
    input_path = os.path.join(src_dir, f)
    if os.path.exists(input_path):
        remove_white_bg(input_path, input_path)
    else:
        print(f"  文件不存在: {f}")

print("完成！")
