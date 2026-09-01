package com.poc.paymentprocessing.exception;

import java.math.BigDecimal;

/**
 * Raised when a payment would breach a payer's per-transaction or daily ceiling.
 *
 * Carries which limit was breached and by how much, so the API can say why
 * rather than returning a bare rejection.
 */
public class PaymentLimitExceededException extends RuntimeException {

    public enum Kind { PER_TRANSACTION, DAILY }

    private final Kind kind;
    private final BigDecimal limit;
    private final BigDecimal attempted;

    public PaymentLimitExceededException(Kind kind, BigDecimal limit, BigDecimal attempted) {
        super(String.format("%s limit of %s exceeded by attempted total %s",
                kind, limit, attempted));
        this.kind = kind;
        this.limit = limit;
        this.attempted = attempted;
    }

    public Kind getKind() { return kind; }
    public BigDecimal getLimit() { return limit; }
    public BigDecimal getAttempted() { return attempted; }
}
