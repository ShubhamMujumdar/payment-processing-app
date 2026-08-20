package com.poc.paymentprocessing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Smoke test: the full Spring context must start.
 *
 * <p>Cheap, but it is the check that catches a broken bean graph, a bad
 * application.yml or a missing dependency before anything is deployed — which is
 * exactly what the CI build stage exists to do.
 */
@SpringBootTest
class PaymentProcessingApplicationTests {

    @Test
    @DisplayName("the application context loads")
    void contextLoads() {
        // Deliberately empty: failure to start the context fails the test.
    }
}
