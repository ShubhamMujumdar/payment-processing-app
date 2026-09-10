package com.poc.paymentprocessing.entity;

/**
 * Why a refund was raised. Recorded against every refund so finance can
 * separate goodwill from genuine processing failures at month end.
 */
public enum RefundReason {
    /** Payer disputed the charge and the dispute was upheld. */
    DISPUTE_UPHELD,
    /** The goods or service were never delivered. */
    NOT_DELIVERED,
    /** Charged more than once for the same order. */
    DUPLICATE_CHARGE,
    /** Issued at the merchant's discretion; no processing fault. */
    GOODWILL,
    /** The original authorisation expired before capture. */
    AUTHORISATION_EXPIRED
}
