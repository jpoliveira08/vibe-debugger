# Use an official Python image.
FROM python:3.11-slim

# Create a non-root user
RUN groupadd -r agentuser && useradd -r -g agentuser -s /bin/bash agentuser

# Install system dependencies and security updates
RUN apt-get update && apt-get install -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/agent

# Install dependencies as root first
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the agent code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /var/log \
    && chown -R agentuser:agentuser /usr/src/agent /var/log \
    && chmod +x /usr/src/agent/start-agent.sh

# Switch to non-root user
USER agentuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose the port for the webhook server
EXPOSE 8080

# When the container launches, run the start script
CMD ["/usr/src/agent/start-agent.sh"]
