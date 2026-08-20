package com.poc.paymentprocessing.service.impl;

import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentMethod;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.exception.PaymentNotFoundException;
import com.poc.paymentprocessing.exception.PaymentValidationException;
import com.poc.paymentprocessing.gateway.PaymentGateway;
import com.poc.paymentprocessing.mapper.PaymentMapper;
import com.poc.paymentprocessing.repository.PaymentRepository;
import com.poc.paymentprocessing.service.PaymentAuditService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Characterisation tests for {@link PaymentServiceImpl}.
 *
 * <p>These pin the behaviour described in SPEC.md section 4.2 as the code
 * currently implements it. Where a test brushes a known defect from SPEC.md
 * section 6 it says so rather than asserting the corrected behaviour — fixing
 * those defects is separate work, and a red build here would say nothing useful
 * about the pipeline.
 */
@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PaymentGateway paymentGateway;
    @Mock
    private PaymentAuditService paymentAuditService;
    @Mock
    private PaymentMapper paymentMapper;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    private static PaymentRequestDTO request(String payerId, String payeeId) {
        return PaymentRequestDTO.builder()
                .payerId(payerId)
                .payeeId(payeeId)
                .amount(new BigDecimal("100.00"))
                .currency("USD")
                .paymentMethod(PaymentMethod.UPI)
                .build();
    }

    private static Payment initiatedPayment() {
        return Payment.builder()
                .id("pay-1")
                .referenceNumber("PAY-0123456789ABCDEF")
                .payerId("user-1")
                .payeeId("merchant-1")
                .amount(new BigDecimal("100.00"))
                .currency("USD")
                .paymentMethod(PaymentMethod.UPI)
                .status(PaymentStatus.INITIATED)
                .build();
    }

    @Test
    @DisplayName("createPayment rejects a payment where the payer and payee are the same party")
    void createPaymentRejectsSelfPayment() {
        assertThatThrownBy(() -> paymentService.createPayment(request("user-1", "user-1")))
                .isInstanceOf(PaymentValidationException.class)
                .hasMessageContaining("must not be the same");

        // The rule is checked before anything is persisted or charged.
        verify(paymentRepository, never()).save(any());
        verify(paymentGateway, never()).charge(any());
    }

    @Test
    @DisplayName("createPayment marks the payment SUCCESS and stores the gateway id when the gateway approves")
    void createPaymentSucceedsWhenGatewayApproves() {
        Payment payment = initiatedPayment();
        when(paymentMapper.toEntity(any())).thenReturn(payment);
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentGateway.charge(any()))
                .thenReturn(new PaymentGateway.GatewayResult(true, "GTW-ABC123456789", "Approved"));
        when(paymentMapper.toResponseDTO(any(Payment.class)))
                .thenReturn(PaymentResponseDTO.builder().status(PaymentStatus.SUCCESS).build());

        PaymentResponseDTO response = paymentService.createPayment(request("user-1", "merchant-1"));

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
        assertThat(payment.getGatewayTransactionId()).isEqualTo("GTW-ABC123456789");
        assertThat(payment.getFailureReason()).isNull();

        // Two audit rows: null -> INITIATED, then INITIATED -> SUCCESS (SPEC.md section 4.2 steps 4 and 7).
        verify(paymentAuditService).recordTransition(eq("pay-1"), isNull(), eq(PaymentStatus.INITIATED), any());
        verify(paymentAuditService)
                .recordTransition(eq("pay-1"), eq(PaymentStatus.INITIATED), eq(PaymentStatus.SUCCESS), eq("Approved"));
    }

    @Test
    @DisplayName("createPayment marks the payment FAILED and records the reason when the gateway declines")
    void createPaymentFailsWhenGatewayDeclines() {
        Payment payment = initiatedPayment();
        when(paymentMapper.toEntity(any())).thenReturn(payment);
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentGateway.charge(any()))
                .thenReturn(new PaymentGateway.GatewayResult(false, null, "Payment declined by gateway (mock decline)"));
        when(paymentMapper.toResponseDTO(any(Payment.class)))
                .thenReturn(PaymentResponseDTO.builder().status(PaymentStatus.FAILED).build());

        paymentService.createPayment(request("user-1", "merchant-1"));

        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository, org.mockito.Mockito.atLeastOnce()).save(saved.capture());

        assertThat(saved.getValue().getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(saved.getValue().getFailureReason()).isEqualTo("Payment declined by gateway (mock decline)");
        assertThat(saved.getValue().getGatewayTransactionId()).isNull();
    }

    @Test
    @DisplayName("getPaymentById raises PaymentNotFoundException for an unknown id")
    void getPaymentByIdRejectsUnknownId() {
        when(paymentRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentService.getPaymentById("missing"))
                .isInstanceOf(PaymentNotFoundException.class);
    }

    @Test
    @DisplayName("cancelPayment rejects a settled payment — documents the dead endpoint in SPEC.md section 6.1")
    void cancelPaymentRejectsSettledPayment() {
        Payment settled = initiatedPayment();
        settled.setStatus(PaymentStatus.SUCCESS);
        when(paymentRepository.findById("pay-1")).thenReturn(Optional.of(settled));

        // KNOWN DEFECT (SPEC.md section 6.1): createPayment always settles a payment
        // inside its own transaction, so no payment is ever observable as INITIATED or
        // PENDING and every cancel call lands here. This test pins the current 400
        // behaviour; it should be inverted when the async gateway flow lands.
        assertThatThrownBy(() -> paymentService.cancelPayment("pay-1"))
                .isInstanceOf(PaymentValidationException.class)
                .hasMessageContaining("Only INITIATED or PENDING payments can be cancelled");
    }
}
