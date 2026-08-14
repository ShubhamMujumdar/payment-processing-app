package com.poc.paymentprocessing.service;

import com.poc.paymentprocessing.dto.PaymentRequestDTO;
import com.poc.paymentprocessing.dto.PaymentResponseDTO;
import com.poc.paymentprocessing.entity.PaymentStatus;

import java.util.List;

public interface PaymentService {

    PaymentResponseDTO createPayment(PaymentRequestDTO requestDTO);

    PaymentResponseDTO getPaymentById(String id);

    PaymentResponseDTO getPaymentByReferenceNumber(String referenceNumber);

    List<PaymentResponseDTO> getAllPayments();

    List<PaymentResponseDTO> getPaymentsByPayerId(String payerId);

    List<PaymentResponseDTO> getPaymentsByStatus(PaymentStatus status);

    PaymentResponseDTO cancelPayment(String id);

    void deletePayment(String id);
}
