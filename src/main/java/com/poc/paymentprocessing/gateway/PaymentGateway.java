package com.poc.paymentprocessing.gateway;

import com.poc.paymentprocessing.entity.Payment;

/**
 * Abstraction over an external payment gateway/processor (e.g. Stripe,
 * Razorpay, a bank's payment switch). Allows the real integration to be
 * swapped in without touching service-layer logic.
 */
public interface PaymentGateway {

    /**
     * Submits a payment for processing by the external gateway.
     *
     * @param payment the payment to process
     * @return the result of the gateway call
     */
    GatewayResult charge(Payment payment);

    /**
     * Submits a refund request to the external gateway.
     *
     * @param gatewayTransactionId the original transaction id at the gateway
     * @param amount               the amount to refund, in minor-unit-safe decimal form
     * @return the result of the gateway call
     */
    GatewayResult refund(String gatewayTransactionId, java.math.BigDecimal amount);

    /**
     * Simple immutable result object returned by gateway operations.
     */
    record GatewayResult(boolean success, String gatewayTransactionId, String message) {
    }
}
