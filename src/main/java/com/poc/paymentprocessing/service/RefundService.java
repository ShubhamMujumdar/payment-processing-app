package com.poc.paymentprocessing.service;

import com.poc.paymentprocessing.dto.RefundRequestDTO;
import com.poc.paymentprocessing.dto.RefundResponseDTO;

import java.util.List;

public interface RefundService {

    RefundResponseDTO initiateRefund(String paymentId, RefundRequestDTO requestDTO);

    RefundResponseDTO getRefundById(String refundId);

    List<RefundResponseDTO> getRefundsForPayment(String paymentId);
}
