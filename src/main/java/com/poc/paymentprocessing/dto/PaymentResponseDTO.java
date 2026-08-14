package com.poc.paymentprocessing.dto;

import com.poc.paymentprocessing.entity.PaymentMethod;
import com.poc.paymentprocessing.entity.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Outbound representation of a Payment returned to API consumers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponseDTO {

    private String id;
    private String referenceNumber;
    private String payerId;
    private String payeeId;
    private BigDecimal amount;
    private String currency;
    private PaymentMethod paymentMethod;
    private PaymentStatus status;
    private String gatewayTransactionId;
    private String failureReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
