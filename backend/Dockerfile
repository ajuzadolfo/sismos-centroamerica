# ==========================================
# Etapa 1: Compilación de la aplicación
# ==========================================
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Optimización de caché de dependencias Maven
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Compilación y empaquetado del JAR ejecutable
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==========================================
# Etapa 2: Imagen mínima de ejecución en producción
# ==========================================
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Crear usuario sin privilegios para ejecución segura
RUN groupadd -r sismos && useradd -r -g sismos -s /bin/false sismos

# Copiar el artefacto compilado
COPY --from=builder /app/target/sismos-backend-*.jar app.jar
RUN chown -R sismos:sismos /app

USER sismos

# Puerto estándar de Google Cloud Run
ENV PORT=8080
EXPOSE 8080

# Opciones de JVM para entornos de contenedores elásticos
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-jar", "/app/app.jar"]
