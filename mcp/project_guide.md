**USER_REQUEST:**
Act as a senior developer and DevOps engineer. Create a comprehensive README.md file for a Python-based AI Incident Assistant project that leverages the Model Context Protocol (MCP) for modular, safe, and externalized tooling.

**PROJECT CONTEXT:**
- **Goal:** The AI agent automatically investigates New Relic alerts to determine if an error is new and related to a recent release (v1.1 vs v1.0). It then recommends a rollback.
- **Tech Stack:** Python, LangGraph/LangChain, LiteLLM, MCP Clients/Servers.
- **Architecture:** "MCP-Based" – meaning the core agent relies on external MCP servers to provide tools. The agent itself only knows how to call these external tools via the MCP protocol.
- **Key Constraint:** MCP servers must be read-only for safety. The final "action" is handled by sending a message to Slack, keeping the MCP layer purely for investigation.

**README REQUIREMENTS:**
1.  **Project Name:** AI Incident Assistant (MCP-Based)
2.  **Overview:** Explain the project's purpose and the MCP architecture. Emphasize the separation of concerns: the "brain" (agent) is separate from the "eyes and hands" (MCP servers). This makes the system more modular and flexible.
3.  **Architecture Diagram:** Propose a Mermaid.js diagram showing: New Relic Alert -> Python Agent -> MCP Client -> (New Relic MCP Server, Terraform MCP Server) -> LiteLLM -> Decision -> Slack Notification.
4.  **Features:** List key features like using external MCP servers for investigation, avoiding vendor lock-in with LiteLLM, and safe Slack-based notifications.
5.  **Installation:** Provide steps for setting up the environment, which includes installing the core agent dependencies (`langgraph`, `litellm`, `mcp`) and the MCP servers (e.g., `docker pull` for a sentry-mcp-server or instructions for a custom New Relic MCP server).
6.  **Configuration:** Detail the environment variables for the agent (e.g., `LITELLM_MODEL`) and for the MCP servers (e.g., `NEW_RELIC_API_KEY` passed to the server container, not the agent!).
7.  **Usage:** Explain how to start the MCP servers (e.g., via Docker or `nxp`) and then run the main agent. Highlight that the agent discovers tools dynamically from the servers.
8.  **MCP Advantage:** Include a dedicated section explaining the benefits of this approach (e.g., "Tools can be developed and updated independently of the agent," "The agent can work with any system that has an MCP server," "Improved security and isolation").
9.  **Safety & Considerations:** Reiterate that the MCP servers are read-only. Mention the use of LiteLLM as an AI gateway. Explain that rollback is initiated via a Slack link to a CI/CD job, not through an MCP tool.

**INSTRUCTIONS FOR CURSOR:**
Generate a complete, well-structured, and professional README.md file based on the above context. The tone should be technical and clear, effectively selling the benefits of the MCP architecture over the traditional one.