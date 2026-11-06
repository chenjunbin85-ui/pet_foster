package com.petfoster.controller;

import com.petfoster.common.BusinessException;
import com.petfoster.common.Result;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 现场照片上传（PRD 8：单次最多 6 张，单张 ≤ 2MB，jpg/png）。
 *
 * <p>演示环境落本地 uploads/ 目录，GET /api/files/{name} 放行以便小程序 image 直接显示；
 * 生产可替换为对象存储，返回结构 {url} 不变。
 */
@Tag(name = "现场照片", description = "员工端拍照留痕上传与读取")
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final long MAX_SIZE = 2 * 1024 * 1024;

    private Path dir() throws IOException {
        Path p = Paths.get(System.getProperty("user.dir"), "uploads");
        if (!Files.exists(p)) Files.createDirectories(p);
        return p;
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public Result<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new BusinessException("请选择要上传的照片");
        if (file.getSize() > MAX_SIZE) throw new BusinessException("单张照片不能超过 2MB");
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')).toLowerCase(Locale.ROOT) : "";
        if (!".jpg".equals(ext) && !".jpeg".equals(ext) && !".png".equals(ext)) {
            throw new BusinessException("仅支持 jpg / png 格式照片");
        }
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = dir().resolve(name);
        file.transferTo(target.toAbsolutePath());
        Map<String, Object> data = new HashMap<>();
        data.put("name", name);
        data.put("url", "/api/files/" + name);
        data.put("size", file.getSize());
        return Result.success(data);
    }

    @GetMapping("/{name:.+}")
    public ResponseEntity<Resource> read(@PathVariable String name) throws IOException {
        // 防目录穿越：只允许安全字符
        if (!name.matches("[A-Za-z0-9._-]+")) return ResponseEntity.notFound().build();
        Path p = dir().resolve(name).normalize();
        if (!Files.exists(p) || !p.startsWith(dir().normalize())) return ResponseEntity.notFound().build();
        String lower = name.toLowerCase(Locale.ROOT);
        MediaType type = lower.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(type).body(new FileSystemResource(p));
    }
}
