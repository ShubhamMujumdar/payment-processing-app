# Customer Service Repository - Technical Design Document (Code-Impacted)

Search-optimized, metadata-aligned enterprise documentation

# Document Metadata

| Field | Value |
|---|---|
| name | customer-service-repo |
| title | Customer Service Repository |
| intent | Provide customer CRUD APIs and a customer onboarding workflow. |
| description | Enterprise-grade Spring Boot repository for Customer Management, optimized for search and traceability. |
| businessCapability | Customer Management |
| domain | Customer Domain |
| keywords | Spring Boot, Customer CRUD, Customer Onboarding, Workflow, RAG, Semantic Search, Vector Search, Traceability |
| owner | Enterprise Architecture Office |
| version | 1.0.0 |

# 1. Code Impact Classification

This Technical Design Document is code-impacted. Changes to APIs, DTOs, entities, repositories, service logic, validation rules, configuration, or tests should be reflected in this document and traceability mapping.

# 2. APIs

| API | Method | Intent | Code Location | Impacted Sections |
|---|---|---|---|---|
| /api/v1/customers | POST | Create customer and initialize onboarding | CustomerController#create | APIs, DTO, Validation, Testing |
| /api/v1/customers/{id} | GET | Retrieve customer by id | CustomerController#get | APIs, Service, Testing |
| /api/v1/customers | GET | List customers | CustomerController#list | APIs, Repository, Testing |
| /api/v1/customers/{id} | PUT | Update customer profile | CustomerController#update | APIs, DTO, Validation, Service |
| /api/v1/customers/{id} | DELETE | Delete customer | CustomerController#delete | APIs, Service |
| /api/v1/customers/{id}/onboarding/advance | POST | Advance onboarding workflow | CustomerController#advanceOnboarding | APIs, Workflow, Service |

# 3. Entity and Data Model

| Field | Type | Validation/Constraint | Business Meaning |
|---|---|---|---|
| id | Long | Primary key | Customer identifier |
| firstName | String | Not blank, max 120 | Given name |
| lastName | String | Not blank, max 120 | Family name |
| email | String | Not blank, email, unique | Customer email |
| phoneNumber | String | Optional phone pattern | Contact number |
| onboardingStatus | Enum | CREATED to ACTIVE or REJECTED | Workflow state |

# 4. Package Structure

| Package | Intent | Change Impact |
|---|---|---|
| controller | Expose REST APIs | API section, validation section, testing section |
| service | Implement business logic and workflows | Business logic section, workflow section, traceability mapping |
| repository | Persist and retrieve data | Entity/data model section and testing |
| entity | Represent persistence model | Entity/data model, validation, migration notes |
| dto | Represent API payloads | API section, validation rules, tests |
| exception | Standardize API errors | Exception handling and API error contract |
| config | Configure OpenAPI and runtime settings | Configuration and API documentation |

# 5. Business Logic

- Create initializes OnboardingStatus.CREATED.
- Advance onboarding moves CREATED to PROFILE_VALIDATED to KYC_PENDING to KYC_COMPLETED to ACTIVE.
- Update preserves onboarding status and refreshes updatedAt.
- Duplicate email is rejected with HTTP 409.

# 6. Workflows

| Workflow Step | Trigger | Result | Supported By Code |
|---|---|---|---|
| Create customer | POST /api/v1/customers | Customer created with CREATED status | CustomerServiceImpl#createCustomer |
| Validate profile | POST advance onboarding | PROFILE_VALIDATED | CustomerServiceImpl#advanceOnboarding |
| KYC pending | POST advance onboarding | KYC_PENDING | CustomerServiceImpl#advanceOnboarding |
| Activate customer | POST advance onboarding | ACTIVE | CustomerServiceImpl#advanceOnboarding |

# 7. Validation Rules

Validation is implemented through Jakarta Bean Validation annotations in request DTOs and surfaced through GlobalExceptionHandler as HTTP 400 responses.

# 8. Configuration

Configuration is stored in application.yml and includes server port, H2 datasource, Spring Data JPA, SpringDoc OpenAPI paths, and aligned enterprise metadata.

# 9. Testing

Unit tests cover controller HTTP behavior with WebMvcTest and service business logic with mocked repositories. Maven command: mvn clean test.

# 10. Traceability Mapping

| Requirement | API/Class | Document Section | Change Impact |
|---|---|---|---|
| Customer CRUD | CustomerController, CustomerServiceImpl | APIs, Business Logic, Testing | Technical document must change with API or CRUD behavior changes |
| Customer Onboarding | OnboardingStatus, advanceOnboarding | Workflows, Traceability Mapping | Technical document must change with workflow changes |
| Email uniqueness | CustomerRepository, CustomerServiceImpl | Validation Rules, Entity Model | Technical document must change with duplicate handling changes |