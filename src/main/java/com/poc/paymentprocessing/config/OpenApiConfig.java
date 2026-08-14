package com.poc.paymentprocessing.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI/Swagger documentation configuration.
 * Docs are served at /swagger-ui.html once the app is running.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI paymentProcessingOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Payment Processing POC API")
                        .description("Reference implementation of a payment processing service (POC)")
                        .version("v1.0")
                        .contact(new Contact().name("Platform Engineering")));
    }
}
