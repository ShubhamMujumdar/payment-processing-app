package com.poc.paymentprocessing.service.impl;

import com.poc.paymentprocessing.dto.RefundRequestDTO;
import com.poc.paymentprocessing.dto.RefundResponseDTO;
import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.entity.Refund;
import com.poc.paymentprocessing.entity.RefundStatus;
import com.poc.paymentprocessing.exception.InvalidRefundException;
import com.poc.paymentprocessing.exception.PaymentNotFoundException;
import com.poc.paymentprocessing.gateway.PaymentGateway;
import com.poc.paymentprocessing.mapper.PaymentMapper;
import com.poc.paymentprocessing.repository.PaymentRepository;
import com.poc.paymentprocessing.repository.RefundRepository;
import com.poc.paymentprocessing.service.PaymentAuditService;
import com.poc.paymentprocessing.service.RefundService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RefundServiceImpl implements RefundService {

    private final RefundRepository refundRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentMapper paymentMapper;
    private final PaymentGateway paymentGateway;
    private final PaymentAuditService paymentAuditService;

    @Override
    @Transactional
    public RefundResponseDTO initiateRefund(String paymentId, RefundRequestDTO requestDTO) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(paymentId));

        if (payment.getStatus() != PaymentStatus.SUCCESS && payment.getStatus() != PaymentStatus.PARTIALLY_REFUNDED) {
            throw new InvalidRefundException(
                    "Payment must be in SUCCESS or PARTIALLY_REFUNDED state to be refunded. Current status: " + payment.getStatus());
        }

        BigDecimal alreadyRefunded = totalRefundedFor(paymentId);
        BigDecimal remainingRefundable = payment.getAmount().subtract(alreadyRefunded);

        if (requestDTO.getRefundAmount().compareTo(remainingRefundable) > 0) {
            throw new InvalidRefundException(
                    "Refund amount exceeds remaining refundable amount: " + remainingRefundable);
        }

        Refund refund = Refund.builder()
                .paymentId(paymentId)
                .refundAmount(requestDTO.getRefundAmount())
                .reason(requestDTO.getReason())
                .status(RefundStatus.INITIATED)
                .build();
        refund = refundRepository.save(refund);

        PaymentGateway.GatewayResult result =
                paymentGateway.refund(payment.getGatewayTransactionId(), requestDTO.getRefundAmount());

        if (result.success()) {
            refund.setStatus(RefundStatus.PROCESSED);
            refund.setProcessedAt(LocalDateTime.now());

            BigDecimal totalRefundedNow = alreadyRefunded.add(requestDTO.getRefundAmount());
            PaymentStatus previousStatus = payment.getStatus();
            payment.setStatus(totalRefundedNow.compareTo(payment.getAmount()) == 0
                    ? PaymentStatus.REFUNDED
                    : PaymentStatus.PARTIALLY_REFUNDED);
            paymentRepository.save(payment);
            paymentAuditService.recordTransition(payment.getId(), previousStatus, payment.getStatus(),
                    "Refund processed: " + requestDTO.getRefundAmount());
        } else {
            refund.setStatus(RefundStatus.FAILED);
        }

        refund = refundRepository.save(refund);
        return paymentMapper.toResponseDTO(refund);
    }

    @Override
    public RefundResponseDTO getRefundById(String refundId) {
        Refund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new InvalidRefundException("Refund not found with id: " + refundId));
        return paymentMapper.toResponseDTO(refund);
    }

    @Override
    public List<RefundResponseDTO> getRefundsForPayment(String paymentId) {
        return refundRepository.findByPaymentId(paymentId).stream()
                .map(paymentMapper::toResponseDTO)
                .toList();
    }

    private BigDecimal totalRefundedFor(String paymentId) {
        return refundRepository.findByPaymentId(paymentId).stream()
                .filter(r -> r.getStatus() == RefundStatus.PROCESSED)
                .map(Refund::getRefundAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
