# syntax=docker/dockerfile:1

# Stage 1: build the JAR
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

# Download deps first for better caching (this layer only rebuilds when pom.xml changes)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build — skip tests here; we run them in CI separately
COPY src ./src
RUN mvn package -DskipTests -B

# Stage 2: runtime (JRE only, no JDK, no Maven) 
FROM eclipse-temurin:17-jre-alpine AS runtime
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /build/target/*.jar app.jar

USER appuser
EXPOSE 8080

# Container-aware JVM memory (critical for Kubernetes!)
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health/liveness || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]