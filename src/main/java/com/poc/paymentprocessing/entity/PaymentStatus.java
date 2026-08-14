package com.poc.paymentprocessing.entity;

/**
 * Represents the lifecycle state of a Payment.
 */
public enum PaymentStatus {
    INITIATED,
    PENDING,
    SUCCESS,
    FAILED,
    REFUNDED,
    PARTIALLY_REFUNDED,
    CANCELLED
}
