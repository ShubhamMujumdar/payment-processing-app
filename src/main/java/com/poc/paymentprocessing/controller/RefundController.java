package com.poc.paymentprocessing.controller;

import com.poc.paymentprocessing.dto.RefundRequestDTO;
import com.poc.paymentprocessing.dto.RefundResponseDTO;
import com.poc.paymentprocessing.service.RefundService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payments/{paymentId}/refunds")
@RequiredArgsConstructor
@Tag(name = "Refunds", description = "Refund operations against existing payments")
public class RefundController {

    private final RefundService refundService;

    @PostMapping
    @Operation(summary = "Initiate a refund (full or partial) for a payment")
    public ResponseEntity<RefundResponseDTO> initiateRefund(
            @PathVariable String paymentId,
            @Valid @RequestBody RefundRequestDTO requestDTO) {
        RefundResponseDTO response = refundService.initiateRefund(paymentId, requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "List all refunds for a payment")
    public ResponseEntity<List<RefundResponseDTO>> getRefundsForPayment(@PathVariable String paymentId) {
        return ResponseEntity.ok(refundService.getRefundsForPayment(paymentId));
    }

    @GetMapping("/{refundId}")
    @Operation(summary = "Get a specific refund by id")
    public ResponseEntity<RefundResponseDTO> getRefundById(
            @PathVariable String paymentId,
            @PathVariable String refundId) {
        return ResponseEntity.ok(refundService.getRefundById(refundId));
    }
}
