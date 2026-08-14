package com.poc.paymentprocessing.exception;

/**
 * Thrown when a refund cannot be processed for the requested payment
 * (e.g. refund amount exceeds the paid amount, or the payment is not in
 * a refundable state).
 */
public class InvalidRefundException extends RuntimeException {

    public InvalidRefundException(String message) {
        super(message);
    }
}
