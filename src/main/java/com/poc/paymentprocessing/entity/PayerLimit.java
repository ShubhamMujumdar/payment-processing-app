package com.poc.paymentprocessing.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * Spending ceilings for one payer.
 *
 * Two separate controls. The per-transaction limit caps any single payment; the
 * daily limit caps the sum of payments accepted for that payer in a calendar
 * day, UTC. A payment must satisfy both.
 *
 * Absent a row, a payer is subject to the platform defaults rather than being
 * unlimited -- an unconfigured payer is the common case, not an exempt one.
 */
@Entity
public class PayerLimit {

    /** Applied when a payer has no row of their own. */
    public static final BigDecimal DEFAULT_PER_TRANSACTION = new BigDecimal("10000.00");
    public static final BigDecimal DEFAULT_DAILY = new BigDecimal("25000.00");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(unique = true)
    private String payerId;

    @NotNull
    @DecimalMin(value = "0.01", message = "perTransactionLimit must be greater than zero")
    private BigDecimal perTransactionLimit;

    @NotNull
    @DecimalMin(value = "0.01", message = "dailyLimit must be greater than zero")
    private BigDecimal dailyLimit;
}
