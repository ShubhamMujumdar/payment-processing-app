package com.poc.paymentprocessing.service.impl;

import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentStatus;
import com.poc.paymentprocessing.exception.PaymentNotFoundException;
import com.poc.paymentprocessing.exception.PaymentValidationException;
import com.poc.paymentprocessing.gateway.PaymentGateway;
import com.poc.paymentprocessing.mapper.PaymentMapper;
import com.poc.paymentprocessing.repository.PaymentRepository;
import com.poc.paymentprocessing.service.PaymentAuditService;
import com.poc.paymentprocessing.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentMapper paymentMapper;
    private final PaymentGateway paymentGateway;
    private final PaymentAuditService paymentAuditService;

    @Override
    @Transactional
    public PaymentResponseDTO createPayment(PaymentRequestDTO requestDTO) {
        if (requestDTO.getPayerId().equals(requestDTO.getPayeeId())) {
            throw new PaymentValidationException("payerId and payeeId must not be the same");
        }

        Payment payment = paymentMapper.toEntity(requestDTO);
        payment = paymentRepository.save(payment);
        paymentAuditService.recordTransition(payment.getId(), null, payment.getStatus(), "Payment initiated");

        PaymentGateway.GatewayResult result = paymentGateway.charge(payment);

        PaymentStatus previousStatus = payment.getStatus();
        if (result.success()) {
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setGatewayTransactionId(result.gatewayTransactionId());
        } else {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(result.message());
        }

        payment = paymentRepository.save(payment);
        paymentAuditService.recordTransition(payment.getId(), previousStatus, payment.getStatus(), result.message());

        return paymentMapper.toResponseDTO(payment);
    }

    @Override
    public PaymentResponseDTO getPaymentById(String id) {
        Payment payment = findPaymentOrThrow(id);
        return paymentMapper.toResponseDTO(payment);
    }

    @Override
    public PaymentResponseDTO getPaymentByReferenceNumber(String referenceNumber) {
        Payment payment = paymentRepository.findByReferenceNumber(referenceNumber)
                .orElseThrow(() -> new PaymentNotFoundException(referenceNumber));
        return paymentMapper.toResponseDTO(payment);
    }

    @Override
    public List<PaymentResponseDTO> getAllPayments() {
        return paymentRepository.findAll().stream()
                .map(paymentMapper::toResponseDTO)
                .toList();
    }

    @Override
    public List<PaymentResponseDTO> getPaymentsByPayerId(String payerId) {
        return paymentRepository.findByPayerId(payerId).stream()
                .map(paymentMapper::toResponseDTO)
                .toList();
    }

    @Override
    public List<PaymentResponseDTO> getPaymentsByStatus(PaymentStatus status) {
        return paymentRepository.findByStatus(status).stream()
                .map(paymentMapper::toResponseDTO)
                .toList();
    }

    @Override
    @Transactional
    public PaymentResponseDTO cancelPayment(String id) {
        Payment payment = findPaymentOrThrow(id);

        if (payment.getStatus() != PaymentStatus.INITIATED && payment.getStatus() != PaymentStatus.PENDING) {
            throw new PaymentValidationException(
                    "Only INITIATED or PENDING payments can be cancelled. Current status: " + payment.getStatus());
        }

        PaymentStatus previousStatus = payment.getStatus();
        payment.setStatus(PaymentStatus.CANCELLED);
        payment = paymentRepository.save(payment);
        paymentAuditService.recordTransition(payment.getId(), previousStatus, payment.getStatus(), "Payment cancelled by user");

        return paymentMapper.toResponseDTO(payment);
    }

    @Override
    @Transactional
    public void deletePayment(String id) {
        Payment payment = findPaymentOrThrow(id);
        paymentRepository.delete(payment);
    }

    private Payment findPaymentOrThrow(String id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new PaymentNotFoundException(id));
    }
}
