package com.poc.paymentprocessing.gateway;

import com.poc.paymentprocessing.entity.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * A mock payment gateway used for local development and demos. Simulates
 * latency and a configurable success rate instead of calling a real
 * external processor. Replace with a real client (e.g. Stripe SDK) in a
 * follow-up PR — the {@link PaymentGateway} interface stays the same.
 */
@Component
public class MockPaymentGatewayImpl implements PaymentGateway {

    @Value("${payment.gateway.mock.success-rate:0.9}")
    private double successRate;

    @Override
    public GatewayResult charge(Payment payment) {
        boolean success = ThreadLocalRandom.current().nextDouble() < successRate;
        String gatewayTxnId = "GTW-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();

        if (success) {
            return new GatewayResult(true, gatewayTxnId, "Payment approved by gateway");
        }
        return new GatewayResult(false, null, "Payment declined by gateway (mock decline)");
    }

    @Override
    public GatewayResult refund(String gatewayTransactionId, BigDecimal amount) {
        if (gatewayTransactionId == null || gatewayTransactionId.isBlank()) {
            return new GatewayResult(false, null, "Cannot refund: missing gateway transaction id");
        }
        String refundTxnId = "RFD-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        return new GatewayResult(true, refundTxnId, "Refund processed by gateway");
    }
}
