package com.petfoster.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class OperLogVO {
    private String id;
    private String userId;
    private String module;
    private String content;
    private LocalDateTime time;
    private String ip;
}
