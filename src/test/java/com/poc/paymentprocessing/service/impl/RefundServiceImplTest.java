package com.poc.paymentprocessing.service.impl;

import com.poc.paymentprocessing.dto.RefundRequestDTO;
import com.poc.paymentprocessing.dto.RefundResponseDTO;
import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentMethod;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.entity.Refund;
import com.poc.paymentprocessing.entity.RefundStatus;
import com.poc.paymentprocessing.exception.InvalidRefundException;
import com.poc.paymentprocessing.exception.PaymentNotFoundException;
import com.poc.paymentprocessing.gateway.PaymentGateway;
import com.poc.paymentprocessing.mapper.PaymentMapper;
import com.poc.paymentprocessing.repository.PaymentRepository;
import com.poc.paymentprocessing.repository.RefundRepository;
import com.poc.paymentprocessing.service.PaymentAuditService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Characterisation tests for {@link RefundServiceImpl}.
 *
 * <p>The refund accumulation arithmetic is the highest-value logic in the
 * codebase and the one SPEC.md section 7 names as the first thing to test, so it
 * gets the most attention here.
 */
@ExtendWith(MockitoExtension.class)
class RefundServiceImplTest {

    @Mock
    private RefundRepository refundRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private PaymentGateway paymentGateway;
    @Mock
    private PaymentAuditService paymentAuditService;

    @InjectMocks
    private RefundServiceImpl refundService;

    private static Payment paymentOf(String amount, PaymentStatus status) {
        return Payment.builder()
                .id("pay-1")
                .referenceNumber("PAY-0123456789ABCDEF")
                .payerId("user-1")
                .payeeId("merchant-1")
                .amount(new BigDecimal(amount))
                .currency("USD")
                .paymentMethod(PaymentMethod.UPI)
                .status(status)
                .gatewayTransactionId("GTW-ABC123456789")
                .build();
    }

    private static Refund processedRefund(String amount) {
        return Refund.builder()
                .id("ref-old")
                .paymentId("pay-1")
                .refundAmount(new BigDecimal(amount))
                .status(RefundStatus.PROCESSED)
                .build();
    }

    private static RefundRequestDTO refundRequest(String amount) {
        return RefundRequestDTO.builder()
                .refundAmount(new BigDecimal(amount))
                .reason("Customer requested refund")
                .build();
    }

    private void gatewayAccepts() {
        when(paymentGateway.refund(anyString(), any()))
                .thenReturn(new PaymentGateway.GatewayResult(true, "RFD-ABC123456789", "Refunded"));
        when(refundRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toResponseDTO(any(Refund.class))).thenReturn(RefundResponseDTO.builder().build());
    }

    @Test
    @DisplayName("a partial refund against a fully settled payment moves it to PARTIALLY_REFUNDED")
    void partialRefundMovesPaymentToPartiallyRefunded() {
        Payment payment = paymentOf("100.00", PaymentStatus.SUCCESS);
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(payment));
        when(refundRepository.findByPaymentId("pay-1")).thenReturn(List.of());
        gatewayAccepts();

        refundService.initiateRefund("pay-1", refundRequest("40.00"));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PARTIALLY_REFUNDED);
        verify(paymentAuditService)
                .recordTransition("pay-1", PaymentStatus.SUCCESS, PaymentStatus.PARTIALLY_REFUNDED,
                        "Refund processed: 40.00");
    }

    @Test
    @DisplayName("refunds accumulate: a second partial refund clearing the balance moves the payment to REFUNDED")
    void accumulatedRefundsMovePaymentToRefunded() {
        Payment payment = paymentOf("100.00", PaymentStatus.PARTIALLY_REFUNDED);
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(payment));
        when(refundRepository.findByPaymentId("pay-1")).thenReturn(List.of(processedRefund("40.00")));
        gatewayAccepts();

        refundService.initiateRefund("pay-1", refundRequest("60.00"));

        // 40.00 already recovered + 60.00 now == the full 100.00, so the payment closes out.
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);

        ArgumentCaptor<Refund> saved = ArgumentCaptor.forClass(Refund.class);
        verify(refundRepository, org.mockito.Mockito.atLeastOnce()).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(RefundStatus.PROCESSED);
        assertThat(saved.getValue().getProcessedAt()).isNotNull();
    }

    @Test
    @DisplayName("only PROCESSED refunds count toward the ceiling — a FAILED refund does not consume balance")
    void failedRefundsDoNotConsumeRefundableBalance() {
        Payment payment = paymentOf("100.00", PaymentStatus.SUCCESS);
        Refund failed = Refund.builder()
                .id("ref-failed")
                .paymentId("pay-1")
                .refundAmount(new BigDecimal("100.00"))
                .status(RefundStatus.FAILED)
                .build();
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(payment));
        when(refundRepository.findByPaymentId("pay-1")).thenReturn(List.of(failed));
        gatewayAccepts();

        // The full 100.00 is still refundable despite the earlier failed attempt.
        refundService.initiateRefund("pay-1", refundRequest("100.00"));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    @DisplayName("a refund exceeding the remaining balance is rejected and never reaches the gateway")
    void refundExceedingRemainingBalanceIsRejected() {
        Payment payment = paymentOf("100.00", PaymentStatus.PARTIALLY_REFUNDED);
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(payment));
        when(refundRepository.findByPaymentId("pay-1")).thenReturn(List.of(processedRefund("70.00")));

        assertThatThrownBy(() -> refundService.initiateRefund("pay-1", refundRequest("40.00")))
                .isInstanceOf(InvalidRefundException.class)
                .hasMessageContaining("exceeds remaining refundable amount: 30.00");

        verify(refundRepository, never()).save(any());
        verify(paymentGateway, never()).refund(anyString(), any());
    }

    @Test
    @DisplayName("a payment that never settled cannot be refunded")
    void unsettledPaymentCannotBeRefunded() {
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(paymentOf("100.00", PaymentStatus.FAILED)));

        assertThatThrownBy(() -> refundService.initiateRefund("pay-1", refundRequest("10.00")))
                .isInstanceOf(InvalidRefundException.class)
                .hasMessageContaining("Current status: FAILED");
    }

    @Test
    @DisplayName("refunding an unknown payment raises PaymentNotFoundException")
    void refundAgainstUnknownPaymentIsRejected() {
        when(paymentRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> refundService.initiateRefund("missing", refundRequest("10.00")))
                .isInstanceOf(PaymentNotFoundException.class);
    }

    @Test
    @DisplayName("a gateway rejection leaves the refund FAILED and the payment status untouched")
    void gatewayRejectionLeavesPaymentUntouched() {
        Payment payment = paymentOf("100.00", PaymentStatus.SUCCESS);
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(payment));
        when(refundRepository.findByPaymentId("pay-1")).thenReturn(List.of());
        when(refundRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentGateway.refund(anyString(), any()))
                .thenReturn(new PaymentGateway.GatewayResult(false, null, "Gateway rejected refund"));
        when(paymentMapper.toResponseDTO(any(Refund.class))).thenReturn(RefundResponseDTO.builder().build());

        refundService.initiateRefund("pay-1", refundRequest("40.00"));

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.SUCCESS);

        ArgumentCaptor<Refund> saved = ArgumentCaptor.forClass(Refund.class);
        verify(refundRepository, org.mockito.Mockito.atLeastOnce()).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(RefundStatus.FAILED);

        // KNOWN DEFECTS (SPEC.md sections 6.10 and 6.8): a failed refund writes no audit
        // row and records no failure reason. Pinned here so the gap is visible in the
        // test report rather than silently absent.
        verify(paymentAuditService, never()).recordTransition(any(), any(), any(), any());
        assertThat(saved.getValue().getProcessedAt()).isNull();
    }
}
