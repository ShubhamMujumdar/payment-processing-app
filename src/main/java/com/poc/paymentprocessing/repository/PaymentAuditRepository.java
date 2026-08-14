package com.poc.paymentprocessing.repository;

import com.poc.paymentprocessing.entity.PaymentAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentAuditRepository extends JpaRepository<PaymentAudit, String> {

    List<PaymentAudit> findByPaymentIdOrderByTimestampAsc(String paymentId);
}
