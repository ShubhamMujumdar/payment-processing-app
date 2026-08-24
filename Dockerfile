# syntax=docker/dockerfile:1
#
# Multi-stage build for the Payment Processing service.
# Stage 1 compiles and packages; stage 2 carries only the JRE and the fat jar,
# so the shipped image contains no Maven, no source and no build cache.

# ---------- Stage 1: build ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Resolve dependencies as their own layer so a source-only change does not
# re-download the world on every CI run.
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
RUN mvn -B -ntp clean package -DskipTests

# ---------- Stage 2: runtime ----------
FROM eclipse-temurin:24-jre-alpine AS runtime

# Run as a non-root user. A payments service should never hold root in its
# container, and several CIS benchmarks fail the image outright if it does.
RUN addgroup -S payments && adduser -S -G payments payments

WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
RUN chown -R payments:payments /app
USER payments

EXPOSE 8080

# MaxRAMPercentage lets the JVM size its heap from the container memory limit
# rather than from the host, which is what makes it behave under Kubernetes.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"

# NOTE: there is no HEALTHCHECK because the application does not expose an
# actuator endpoint yet (SPEC.md section 5.1, "Observability"). Add
# spring-boot-starter-actuator and point this at /actuator/health as part of
# the R2 observability work.

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
