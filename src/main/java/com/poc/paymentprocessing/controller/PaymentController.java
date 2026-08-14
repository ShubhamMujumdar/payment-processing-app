package com.poc.paymentprocessing.controller;

import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Payment lifecycle operations")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @Operation(summary = "Initiate a new payment")
    public ResponseEntity<PaymentResponseDTO> createPayment(@Valid @RequestBody PaymentRequestDTO requestDTO) {
        PaymentResponseDTO response = paymentService.createPayment(requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a payment by its internal id")
    public ResponseEntity<PaymentResponseDTO> getPaymentById(@PathVariable String id) {
        return ResponseEntity.ok(paymentService.getPaymentById(id));
    }

    @GetMapping("/reference/{referenceNumber}")
    @Operation(summary = "Get a payment by its public reference number")
    public ResponseEntity<PaymentResponseDTO> getPaymentByReference(@PathVariable String referenceNumber) {
        return ResponseEntity.ok(paymentService.getPaymentByReferenceNumber(referenceNumber));
    }

    @GetMapping
    @Operation(summary = "List all payments, optionally filtered by payer or status")
    public ResponseEntity<List<PaymentResponseDTO>> listPayments(
            @RequestParam(required = false) String payerId,
            @RequestParam(required = false) PaymentStatus status) {

        if (payerId != null) {
            return ResponseEntity.ok(paymentService.getPaymentsByPayerId(payerId));
        }
        if (status != null) {
            return ResponseEntity.ok(paymentService.getPaymentsByStatus(status));
        }
        return ResponseEntity.ok(paymentService.getAllPayments());
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a payment that has not yet settled")
    public ResponseEntity<PaymentResponseDTO> cancelPayment(@PathVariable String id) {
        return ResponseEntity.ok(paymentService.cancelPayment(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a payment record")
    public ResponseEntity<Void> deletePayment(@PathVariable String id) {
        paymentService.deletePayment(id);
        return ResponseEntity.noContent().build();
    }
}
