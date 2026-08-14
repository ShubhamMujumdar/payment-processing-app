package com.poc.paymentprocessing.mapper;

import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.dto.RefundResponseDTO;
import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.entity.Refund;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Converts between Payment/Refund entities and their DTO representations.
 * Kept as a plain component (rather than MapStruct) to keep the POC
 * dependency-light; swap for MapStruct in a follow-up PR if desired.
 */
@Component
public class PaymentMapper {

    public Payment toEntity(PaymentRequestDTO dto) {
        return Payment.builder()
                .referenceNumber(generateReferenceNumber())
                .payerId(dto.getPayerId())
                .payeeId(dto.getPayeeId())
                .amount(dto.getAmount())
                .currency(dto.getCurrency().toUpperCase())
                .paymentMethod(dto.getPaymentMethod())
                .status(PaymentStatus.INITIATED)
                .build();
    }

    public PaymentResponseDTO toResponseDTO(Payment payment) {
        return PaymentResponseDTO.builder()
                .id(payment.getId())
                .referenceNumber(payment.getReferenceNumber())
                .payerId(payment.getPayerId())
                .payeeId(payment.getPayeeId())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .paymentMethod(payment.getPaymentMethod())
                .status(payment.getStatus())
                .gatewayTransactionId(payment.getGatewayTransactionId())
                .failureReason(payment.getFailureReason())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }

    public RefundResponseDTO toResponseDTO(Refund refund) {
        return RefundResponseDTO.builder()
                .id(refund.getId())
                .paymentId(refund.getPaymentId())
                .refundAmount(refund.getRefundAmount())
                .reason(refund.getReason())
                .status(refund.getStatus())
                .createdAt(refund.getCreatedAt())
                .processedAt(refund.getProcessedAt())
                .build();
    }

    private String generateReferenceNumber() {
        return "PAY-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
    }
}
