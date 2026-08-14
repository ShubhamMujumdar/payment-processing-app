package com.poc.paymentprocessing.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Immutable audit trail entry capturing a payment status transition.
 * Useful for compliance, dispute resolution and debugging.
 */
@Entity
@Table(name = "payment_audits")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String paymentId;

    @Enumerated(EnumType.STRING)
    private PaymentStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus newStatus;

    private String remarks;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}
