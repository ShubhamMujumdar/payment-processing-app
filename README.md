# poc-code-repo — Payment Processing (Spring Boot POC)

A layered, POC-quality Payment Processing service built with Spring Boot 3 / Java 17.
It models payment creation, retrieval, cancellation, deletion, refunds, an audit
trail, a pluggable mock payment gateway, DTO mapping, bean validation, and
centralized exception handling.

## Tech stack
- Java 17, Spring Boot 3.3 (Web, Data JPA, Validation)
- H2 in-memory database (swap for Postgres/MySQL in a real deployment)
- springdoc-openapi (Swagger UI at `/swagger-ui.html`)
- Lombok

## Running locally
```bash
mvn spring-boot:run
```
API base path: `http://localhost:8080/api/v1/payments`
H2 console: `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:paymentdb`)

## Package structure
```
com.poc.paymentprocessing
├── entity          # Payment, Refund, PaymentAudit, enums
├── repository       # Spring Data JPA repositories
├── dto              # Request/response payloads
├── mapper           # Entity <-> DTO conversion
├── gateway          # PaymentGateway abstraction + mock implementation
├── service          # Business logic interfaces
│   └── impl          # Business logic implementations
├── controller        # REST endpoints
├── exception          # Custom exceptions + GlobalExceptionHandler
└── config             # OpenAPI / cross-cutting configuration
```

## Suggested PR breakdown

This repo was intentionally structured in layers so it can be split across
multiple PRs, e.g.:

1. **PR1 — Project scaffolding**: `pom.xml`, `application.yml`, main
   application class, `.gitignore`, README.
2. **PR2 — Domain model**: `entity/*` (Payment, Refund, PaymentAudit, enums).
3. **PR3 — Persistence layer**: `repository/*`.
4. **PR4 — DTOs & validation**: `dto/*`.
5. **PR5 — Mapper layer**: `mapper/PaymentMapper.java`.
6. **PR6 — Payment gateway abstraction**: `gateway/*` (interface + mock impl).
7. **PR7 — Exception handling**: `exception/*`.
8. **PR8 — Payment service & audit trail**: `service/PaymentService.java`,
   `service/impl/PaymentServiceImpl.java`, `service/PaymentAuditService.java`.
9. **PR9 — Refund service**: `service/RefundService.java`,
   `service/impl/RefundServiceImpl.java`.
10. **PR10 — REST API layer**: `controller/*`, `config/OpenApiConfig.java`.

Each layer compiles independently once its dependencies from earlier PRs are
merged, so this order keeps every PR buildable and reviewable in isolation.

## Sample requests

Create a payment:
```bash
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
        "payerId": "user-1",
        "payeeId": "merchant-1",
        "amount": 100.00,
        "currency": "USD",
        "paymentMethod": "UPI"
      }'
```

Refund a payment:
```bash
curl -X POST http://localhost:8080/api/v1/payments/{paymentId}/refunds \
  -H "Content-Type: application/json" \
  -d '{ "refundAmount": 50.00, "reason": "Customer requested partial refund" }'
```

## Notes
- `MockPaymentGatewayImpl` simulates an external gateway with a configurable
  success rate (`payment.gateway.mock.success-rate`) — swap it for a real
  client (Stripe, Razorpay, etc.) behind the same `PaymentGateway` interface.
- Test files are intentionally omitted from this POC; add a `test` PR per
  layer as a natural follow-up.
