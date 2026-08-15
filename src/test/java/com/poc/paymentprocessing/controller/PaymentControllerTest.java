package com.poc.paymentprocessing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.entity.PaymentMethod;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.exception.PaymentNotFoundException;
import com.poc.paymentprocessing.service.PaymentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web-layer tests for {@link PaymentController}.
 *
 * <p>These exercise the HTTP contract from SPEC.md section 4.1 together with bean
 * validation (section 4.5) and the error translation performed by
 * {@code GlobalExceptionHandler} (section 4.6). The service layer is mocked —
 * its behaviour is covered by {@code PaymentServiceImplTest}.
 */
@WebMvcTest(PaymentController.class)
class PaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PaymentService paymentService;

    private static PaymentRequestDTO validRequest() {
        return PaymentRequestDTO.builder()
                .payerId("user-1")
                .payeeId("merchant-1")
                .amount(new BigDecimal("100.00"))
                .currency("USD")
                .paymentMethod(PaymentMethod.UPI)
                .build();
    }

    @Test
    @DisplayName("POST /api/v1/payments returns 201 Created with the payment body")
    void createPaymentReturnsCreated() throws Exception {
        when(paymentService.createPayment(any())).thenReturn(PaymentResponseDTO.builder()
                .id("pay-1")
                .referenceNumber("PAY-0123456789ABCDEF")
                .status(PaymentStatus.SUCCESS)
                .build());

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("pay-1"))
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    @DisplayName("a declined payment is still 201 — the HTTP status reflects resource creation, not payment outcome")
    void declinedPaymentIsStillCreated() throws Exception {
        when(paymentService.createPayment(any())).thenReturn(PaymentResponseDTO.builder()
                .id("pay-2")
                .status(PaymentStatus.FAILED)
                .failureReason("Payment declined by gateway (mock decline)")
                .build());

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("FAILED"));
    }

    @Test
    @DisplayName("POST /api/v1/payments returns 400 with field details when validation fails")
    void createPaymentRejectsInvalidPayload() throws Exception {
        PaymentRequestDTO invalid = validRequest();
        invalid.setPayerId("");                              // violates @NotBlank
        invalid.setCurrency("US");                           // violates @Size(min=3, max=3)
        invalid.setAmount(new BigDecimal("0.00"));           // violates @DecimalMin("0.01")

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.details").isArray());

        // Validation short-circuits at the controller boundary.
        verify(paymentService, never()).createPayment(any());
    }

    @Test
    @DisplayName("GET /api/v1/payments/{id} maps PaymentNotFoundException to 404")
    void unknownPaymentReturnsNotFound() throws Exception {
        when(paymentService.getPaymentById(anyString())).thenThrow(new PaymentNotFoundException("missing"));

        mockMvc.perform(get("/api/v1/payments/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("GET /api/v1/payments with both filters honours payerId only — SPEC.md section 6.2")
    void listPaymentsIgnoresStatusWhenPayerIdIsAlsoSupplied() throws Exception {
        when(paymentService.getPaymentsByPayerId("user-1")).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/v1/payments").param("payerId", "user-1").param("status", "SUCCESS"))
                .andExpect(status().isOk());

        // KNOWN DEFECT (SPEC.md section 6.2): the status filter is silently dropped when
        // both parameters are supplied, and the caller gets a wrong-but-plausible result.
        // findByPayerIdAndStatus exists in the repository but is never wired up.
        verify(paymentService, never()).getPaymentsByStatus(any());
    }
}
