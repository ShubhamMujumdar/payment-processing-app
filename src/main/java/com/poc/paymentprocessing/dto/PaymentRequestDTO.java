package com.poc.paymentprocessing.dto;

import com.poc.paymentprocessing.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Inbound payload for initiating a new payment.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestDTO {

    @NotBlank(message = "payerId is required")
    private String payerId;

    @NotBlank(message = "payeeId is required")
    private String payeeId;

    @NotNull(message = "amount is required")
    @DecimalMin(value = "25.0", message = "amount must be greater than zero")
    private BigDecimal amount;

    @NotBlank(message = "currency is required")
    @Size(min = 3, max = 3, message = "currency must be a 3-letter ISO code")
    private String currency;

    @NotNull(message = "paymentMethod is required")
    private PaymentMethod paymentMethod;
}
