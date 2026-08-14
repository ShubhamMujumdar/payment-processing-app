package com.poc.paymentprocessing.exception;

/**
 * Thrown when a payment request fails business-rule validation
 * (as opposed to bean-validation annotation failures).
 */
public class PaymentValidationException extends RuntimeException {

    public PaymentValidationException(String message) {
        super(message);
    }
}
