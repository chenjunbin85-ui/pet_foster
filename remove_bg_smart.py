from PIL import Image
from collections import deque
import os

def get_bg_color(pixels, w, h):
    """从四个角采样，确定背景色（取出现最多的颜色）"""
    corners = [
        pixels[0, 0],
        pixels[w-1, 0],
        pixels[0, h-1],
        pixels[w-1, h-1],
        pixels[w//2, 0],  # 上边中点
        pixels[w//2, h-1],  # 下边中点
    ]
    # 统计最常见的颜色
    color_count = {}
    for c in corners:
        key = (c[0], c[1], c[2])
        color_count[key] = color_count.get(key, 0) + 1
    bg = max(color_count, key=color_count.get)
    print(f"  检测到背景色: RGB{bg}")
    return bg

def color_distance(c1, c2):
    """RGB颜色欧氏距离"""
    return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

def remove_bg_smart(input_path, output_path, tolerance=30):
    """智能抠图：自动检测背景色，flood fill去除连通背景"""
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    bg_color = get_bg_color(pixels, w, h)

    visited = set()
    queue = deque()

    # 从四条边开始
    for x in range(w):
        for y in [0, h-1]:
            if (x, y) not in visited and color_distance(pixels[x, y], bg_color) < tolerance:
                queue.append((x, y))
                visited.add((x, y))
    for y in range(h):
        for x in [0, w-1]:
            if (x, y) not in visited and color_distance(pixels[x, y], bg_color) < tolerance:
                queue.append((x, y))
                visited.add((x, y))

    count = 0
    while queue:
        x, y = queue.popleft()
        r, g, b, a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        count += 1
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                if color_distance(pixels[nx, ny], bg_color) < tolerance:
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    print(f"  去除了 {count} 个背景像素")
    img.save(output_path, 'PNG')

# 处理今日待办配图
files = [
    r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\todo-illustration.png",
]

# 检查是否有其他配图
care_img = r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\care-illustration.png"
if os.path.exists(care_img):
    files.append(care_img)

print("开始智能抠图...")
for f in files:
    if os.path.exists(f):
        print(f"处理: {os.path.basename(f)}")
        remove_bg_smart(f, f, tolerance=35)
    else:
        print(f"文件不存在: {f}")

print("完成！")
