package com.petfoster.controller;

import com.petfoster.common.BusinessException;
import com.petfoster.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 图片上传（PRD 8：单张 ≤ 2MB，jpg/png；单条业务记录最多 6 张，逗号分隔存储）。
 *
 * <p>全链路：客户端/员工端调用本接口拿到 {@code /api/files/{name}}，业务表只存相对地址；
 * GET 免登录，供小程序 {@code <image>} 与 Web {@code <img>} 直接展示。
 * 演示环境落本地 uploads/ 目录，生产可替换为对象存储，返回结构 {@code {url}} 不变。
 */
@Tag(name = "图片上传", description = "宠物头像 / 疫苗证明 / 现场照片的上传与读取")
@RestController
@RequestMapping("/api/files")
public class FileController {

    /** 单张上限 2MB（PRD 8） */
    private static final long MAX_SIZE = 2 * 1024 * 1024;
    private static final int MAGIC_LENGTH = 8;

    private final Path root;

    public FileController(@Value("${app.upload-dir:uploads}") String uploadDir) {
        Path configured = Paths.get(uploadDir);
        this.root = (configured.isAbsolute() ? configured
                : Paths.get(System.getProperty("user.dir")).resolve(configured)).normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建上传目录: " + this.root, e);
        }
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('CUSTOMER','STAFF','ADMIN')")
    @Operation(summary = "上传单张图片", description = "multipart/form-data，字段名 file；jpg/png，≤2MB")
    public Result<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new BusinessException("请选择要上传的图片");
        if (file.getSize() > MAX_SIZE) throw new BusinessException("单张图片不能超过 2MB");

        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String ext = original.contains(".")
                ? original.substring(original.lastIndexOf('.')).toLowerCase(Locale.ROOT) : "";
        if (!".jpg".equals(ext) && !".jpeg".equals(ext) && !".png".equals(ext)) {
            throw new BusinessException("仅支持 jpg / png 格式图片");
        }
        // 扩展名可伪造：读文件头确认真实图片，避免把脚本/可执行内容当图片落盘
        String detected = detectType(readMagic(file));
        if (detected == null) throw new BusinessException("文件内容不是有效的 jpg / png 图片");
        if (!detected.equals(".png".equals(ext) ? "image/png" : "image/jpeg")) {
            throw new BusinessException("图片格式与扩展名不一致，请重新选择");
        }

        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = root.resolve(name);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("name", name);
        data.put("url", "/api/files/" + name);
        data.put("size", file.getSize());
        data.put("contentType", detected);
        return Result.success(data);
    }

    @GetMapping("/{name:.+}")
    @Operation(summary = "读取图片", description = "免登录；仅放行上传目录内的安全文件名")
    public ResponseEntity<Resource> read(@PathVariable String name) throws IOException {
        // 防目录穿越：只允许安全字符
        if (!name.matches("[A-Za-z0-9._-]{1,120}")) return ResponseEntity.notFound().build();
        Path p = root.resolve(name).normalize();
        if (!Files.isRegularFile(p) || !p.startsWith(root)) return ResponseEntity.notFound().build();
        String lower = name.toLowerCase(Locale.ROOT);
        MediaType type = lower.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(type)
                // 文件名为 UUID，内容不可变，可长缓存
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable())
                .body(new FileSystemResource(p));
    }

    private byte[] readMagic(MultipartFile file) throws IOException {
        byte[] head = new byte[MAGIC_LENGTH];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.read(head);
        }
        if (read <= 0) return new byte[0];
        byte[] actual = new byte[read];
        System.arraycopy(head, 0, actual, 0, read);
        return actual;
    }

    /** PNG: 89 50 4E 47 0D 0A 1A 0A；JPEG: FF D8 FF */
    private String detectType(byte[] head) {
        if (head.length >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G'
                && (head[4] & 0xFF) == 0x0D && (head[5] & 0xFF) == 0x0A
                && (head[6] & 0xFF) == 0x1A && (head[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        if (head.length >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }
}
