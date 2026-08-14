package com.poc.paymentprocessing.repository;

import com.poc.paymentprocessing.entity.Refund;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RefundRepository extends JpaRepository<Refund, String> {

    List<Refund> findByPaymentId(String paymentId);
}
