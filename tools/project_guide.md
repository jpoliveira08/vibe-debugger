**USER_REQUEST:**
Act as a senior developer and DevOps engineer. Create a comprehensive README.md file for a Python-based AI Incident Assistant project that uses traditional code-based tools.

**PROJECT CONTEXT:**
- **Goal:** The AI agent automatically investigates New Relic alerts to determine if an error is new and related to a recent release (v1.1 vs v1.0). It then recommends a rollback.
- **Tech Stack:** Python, LangGraph/LangChain, LiteLLM (as an AI gateway to OpenAI/Anthropic), New Relic API, Terraform Cloud API, Slack SDK.
- **Architecture:** "Traditional Tools" – meaning all integrations (New Relic, Terraform, Slack) are implemented as custom Python functions or classes within the codebase itself. There are no external MCP servers.
- **Key Constraint:** The tools for New Relic and Terraform must be read-only for safety. The final "action" is a message sent to Slack with a manual rollback link.

**README REQUIREMENTS:**
1.  **Project Name:** AI Incident Assistant (Tools-Based)
2.  **Overview:** Explain the project's purpose and the traditional tools-based architecture. Mention that it's a self-contained application where all logic is managed in-code.
3.  **Architecture Diagram:** Propose a simple Mermaid.js diagram showing: New Relic Alert -> Python Agent (with internal tools) -> LiteLLM -> Decision -> Slack Notification.
4.  **Features:** List key features like New Relic investigation, cross-environment validation, Terraform state checking, and Slack notifications.
5.  **Installation:** Provide concise steps for setting up a Python virtual environment and installing core dependencies (`langgraph`, `litellm`, `requests`, `slack-sdk`).
6.  **Configuration:** Detail the necessary environment variables (e.g., `NEW_RELIC_API_KEY`, `TERRAFORM_CLOUD_TOKEN`, `SLACK_BOT_TOKEN`, `LITELLM_MODEL`).
7.  **Usage:** Explain how to run the agent and what the typical workflow looks like (e.g., "The agent is a web server that listens for webhooks from New Relic").
8.  **Tool Implementation:** Briefly describe how the key tools are implemented as Python functions (e.g., `def query_new_relic_nrql(nrql_query: str) -> dict:`).
9.  **Safety & Considerations:** Include a section on why the tools are read-only and the use of LiteLLM to avoid LLM vendor lock-in.

**INSTRUCTIONS FOR CURSOR:**
Generate a complete, well-structured, and professional README.md file based on the above context. Use placeholders like `<ADD_NEW_RELIC_APP_ID>` where specific IDs are needed. The tone should be technical and clear.