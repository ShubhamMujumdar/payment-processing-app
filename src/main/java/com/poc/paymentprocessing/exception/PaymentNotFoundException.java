package com.poc.paymentprocessing.exception;

/**
 * Thrown when a requested Payment cannot be located.
 */
public class PaymentNotFoundException extends RuntimeException {

    public PaymentNotFoundException(String paymentId) {
        super("Payment not found with id: " + paymentId);
    }
}
