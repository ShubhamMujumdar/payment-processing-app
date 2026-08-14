package com.poc.paymentprocessing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Inbound payload for requesting a refund against an existing payment.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequestDTO {

    @NotNull(message = "refundAmount is required")
    @DecimalMin(value = "0.01", message = "refundAmount must be greater than zero")
    private BigDecimal refundAmount;

    @NotBlank(message = "reason is required")
    private String reason;
}
