from PIL import Image
from collections import deque
import os

def get_bg_color(pixels, w, h):
    corners = [pixels[0,0], pixels[w-1,0], pixels[0,h-1], pixels[w-1,h-1],
               pixels[w//2,0], pixels[w//2,h-1]]
    color_count = {}
    for c in corners:
        key = (c[0], c[1], c[2])
        color_count[key] = color_count.get(key, 0) + 1
    return max(color_count, key=color_count.get)

def color_distance(c1, c2):
    return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

def remove_bg(input_path, output_path, tolerance=35):
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()
    bg = get_bg_color(pixels, w, h)
    print(f"背景色: RGB{bg}")
    visited = set()
    queue = deque()
    for x in range(w):
        for y in [0, h-1]:
            if (x,y) not in visited and color_distance(pixels[x,y], bg) < tolerance:
                queue.append((x,y)); visited.add((x,y))
    for y in range(h):
        for x in [0, w-1]:
            if (x,y) not in visited and color_distance(pixels[x,y], bg) < tolerance:
                queue.append((x,y)); visited.add((x,y))
    count = 0
    while queue:
        x, y = queue.popleft()
        r,g,b,a = pixels[x,y]
        pixels[x,y] = (r,g,b,0); count += 1
        for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx,ny = x+dx, y+dy
            if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited:
                if color_distance(pixels[nx,ny], bg) < tolerance:
                    visited.add((nx,ny)); queue.append((nx,ny))
    print(f"去除 {count} 像素")
    img.save(output_path, 'PNG')

f = r"C:\Users\chen\Desktop\pet-foster\pet-foster-ui-src\pet-foster-ui\public\images\loading-illustration.png"
remove_bg(f, f)
print("完成")
