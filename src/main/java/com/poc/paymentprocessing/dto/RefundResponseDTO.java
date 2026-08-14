package com.poc.paymentprocessing.dto;

import com.poc.paymentprocessing.entity.RefundStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Outbound representation of a Refund returned to API consumers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundResponseDTO {

    private String id;
    private String paymentId;
    private BigDecimal refundAmount;
    private String reason;
    private RefundStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;
}
