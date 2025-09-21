#!/bin/sh

# Start the LiteLLM proxy in the background
litellm --config /usr/src/agent/litellm_config.yml &

# Start the main Python application
exec python main.py
