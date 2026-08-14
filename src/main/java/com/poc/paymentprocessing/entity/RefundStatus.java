package com.poc.paymentprocessing.entity;

/**
 * Represents the lifecycle state of a Refund.
 */
public enum RefundStatus {
    INITIATED,
    PROCESSED,
    FAILED,
    REJECTED
}
