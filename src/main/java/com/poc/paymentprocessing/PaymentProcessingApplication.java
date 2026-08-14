package com.poc.paymentprocessing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Payment Processing POC service.
 *
 * This is a proof-of-concept Spring Boot application demonstrating a
 * layered payment processing architecture: entities, repositories,
 * services, a mock payment gateway, DTOs/mappers, REST controllers and
 * centralized exception handling.
 */
@SpringBootApplication
public class PaymentProcessingApplication {

    public static void main(String[] args) {
        SpringApplication.run(PaymentProcessingApplication.class, args);
    }
}
