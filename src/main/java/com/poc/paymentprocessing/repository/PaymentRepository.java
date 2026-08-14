package com.poc.paymentprocessing.repository;

import com.poc.paymentprocessing.entity.Payment;
import com.poc.paymentprocessing.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {

    Optional<Payment> findByReferenceNumber(String referenceNumber);

    List<Payment> findByPayerId(String payerId);

    List<Payment> findByPayeeId(String payeeId);

    List<Payment> findByStatus(PaymentStatus status);

    List<Payment> findByPayerIdAndStatus(@Param("payerId") String payerId, @Param("status") PaymentStatus status);
}
