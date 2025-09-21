# Use an official PHP image with PHP 8.4
FROM php:8.4-cli

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser -s /bin/bash appuser

# Install security updates and curl for health checks
RUN apt-get update && apt-get install -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy the application versions and the start script into the image
COPY v1.0 ./v1.0
COPY v2.0 ./v2.0
COPY start.sh ./start.sh

# The web root in the container
RUN mkdir -p /var/www/html /var/log \
    && chown -R appuser:appuser /usr/src/app /var/www/html /var/log \
    && chmod +x /usr/src/app/start.sh

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port 8000 for the PHP built-in web server
EXPOSE 8000

# When the container launches, run the start script
CMD ["/usr/src/app/start.sh"]
