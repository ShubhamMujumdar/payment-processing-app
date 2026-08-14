package com.poc.paymentprocessing.service;

import com.poc.paymentprocessing.entity.PaymentAudit;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.repository.PaymentAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Records an immutable audit trail of payment status transitions.
 * Kept separate from PaymentService so audit logging can evolve
 * independently (e.g. move to an event bus / async pipeline later).
 */
@Service
@RequiredArgsConstructor
public class PaymentAuditService {

    private final PaymentAuditRepository paymentAuditRepository;

    public void recordTransition(String paymentId, PaymentStatus previousStatus, PaymentStatus newStatus, String remarks) {
        PaymentAudit audit = PaymentAudit.builder()
                .paymentId(paymentId)
                .previousStatus(previousStatus)
                .newStatus(newStatus)
                .remarks(remarks)
                .build();
        paymentAuditRepository.save(audit);
    }

    public List<PaymentAudit> getAuditTrail(String paymentId) {
        return paymentAuditRepository.findByPaymentIdOrderByTimestampAsc(paymentId);
    }
}
