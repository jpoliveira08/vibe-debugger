# VibeDebugger - Proof of Concept (POC) Development Plan

## 1. Project Goal

The primary goal of this POC is to build a functional prototype of "VibeDebugger," an AI-powered assistant designed to help on-call engineers diagnose and respond to incidents in a production web application environment.

The system will monitor applications post-release, distinguish between new and pre-existing known issues, analyze the root cause of new problems, and provide actionable recommendations (e.g., rollback, hotfix, or confirm success) to the responsible engineer via a chat-based interface (Discord).

## 2. Guiding Principles

-   **Model-as-Code (MaC):** All components of the AI agent—including the agent's logic (the LangGraph graph), prompts, and tool definitions—will be treated as version-controlled code. This is analogous to the "configuration-as-code" approach used by tools like Prometheus, ensuring reproducibility, collaboration, and a clear audit trail.
-   **Read-Only Analysis:** The VibeDebugger agent will operate in a strictly read-only mode. It will have no capabilities to create, modify, or delete files, resources, or configurations in the environment. Its sole purpose is to observe, analyze, and provide recommendations to a human operator, ensuring safety and human-in-the-loop control.
-   **Structured Context Protocol:** Before making a final recommendation, the agent will assemble all gathered information (alert details, code analysis, release notes) into a structured, predefined format. This "context protocol" ensures the LLM receives consistent and complete information, leading to more reliable analysis.

## 3. Core Scenario for the POC

We will simulate a realistic production incident scenario:

1.  **Baseline:** Three containerized PHP application instances are running. They are continuously logging a known, non-critical warning/error.
2.  **Monitoring:** Prometheus is scraping metrics/logs from these instances, but the known error does not trigger a critical alert.
3.  **Deployment:** A new version of the PHP application is deployed to all three instances. This new version contains a latent critical bug on a specific, non-obvious page.
4.  **Incident:** An automated script (simulating a user) accesses the broken page on one of the instances.
5.  **Detection:** The application throws a new, critical error. This is detected by our monitoring system (Prometheus), which fires a critical alert.
6.  **AI Analysis:** The alert triggers the VibeDebugger AI Agent. The agent begins its analysis, correctly ignoring the persistent known error and focusing on the new critical one.
7.  **Recommendation:** The AI provides a root cause analysis and suggests a course of action to the engineer in a Discord channel.

## 4. Proposed Architecture

The POC will consist of the following interconnected components:

-   **PHP Applications (x3):** Simple PHP applications containerized with Docker. They will be instrumented to expose logs/metrics for Prometheus.
-   **Prometheus:** A time-series database and monitoring system that scrapes data from the PHP applications.
-   **Alertmanager:** Handles alerts from Prometheus. It will be configured to send notifications to our Discord bot via a webhook.
-   **Discord Bot:** A Python-based bot that serves as the user interface. It will receive alert notifications and facilitate interaction with the AI Agent.
-   **VibeDebugger AI Agent:** The core of the system, built with Python. This agent will receive data from the Discord bot, orchestrate the analysis, and produce a recommendation. We will use **LangGraph** to build the agent's logic flow and **LangFuse** for tracing and observability of the AI's decision-making process.
-   **AI Gateway (LiteLLM):** A proxy layer that sits between our AI Agent and the various LLM providers (e.g., OpenAI, Anthropic, Google). This avoids vendor lock-in, provides a unified API, and can be configured with fallback models to improve reliability.

![Architecture Diagram](https://i.imgur.com/your-diagram-image.png)  <-- *Placeholder for a diagram showing LiteLLM between the Agent and LLMs*

## 5. Development Phases

### Phase 1: Environment Setup & Application Simulation

*   **Task 1: Create the PHP Application.**
    *   Develop a basic PHP application (e.g., using a lightweight framework like Slim or just plain PHP).
    *   Create two versions:
        *   `v1.0`: Contains a piece of code that generates a recurring, non-critical warning (the "known issue").
        *   `v2.0`: Based on v1.0, but with an added bug on a specific route that causes a fatal error.
*   **Task 2: Containerize the Application.**
    *   Create a `Dockerfile` for the PHP application.
    *   Use `docker compose.yml` to define the services for the three PHP app instances, Prometheus, and Alertmanager. This will make the entire environment easy to spin up and manage.
*   **Task 3: Instrument the Application.**
    *   Expose application logs from the containers so they can be collected.
    *   Optionally, add a PHP Prometheus exporter client library to expose custom metrics (e.g., error counts).

### Phase 2: Monitoring & Alerting Setup

*   **Task 1: Configure Prometheus.**
    *   Write the `prometheus.yml` configuration file.
    *   Define scrape jobs to collect logs/metrics from the three PHP containers.
    *   Write alert rules (`alerts.rules.yml`):
        *   A rule for the "new critical error" that fires with high priority.
        *   Ensure the "known warning" does *not* fire a critical alert.
*   **Task 2: Configure Alertmanager.**
    *   Write the `alertmanager.yml` configuration file.
    *   Define a route for incoming alerts.
    *   Configure a webhook receiver that will send alert notifications to a specific URL (this will be our Discord bot's endpoint).

### Phase 3: AI Agent & Discord Integration

*   **Task 1: Set up the Discord Server and Bot.**
    *   Create a new Discord server for the POC.
    *   Create a bot application in the Discord Developer Portal.
    *   Write the basic Python bot using a library like `discord.py`. The bot should be able to receive messages and respond.
*   **Task 2: Develop the Webhook Receiver.**
    *   Create a small web server within the bot's Python script (e.g., using Flask or FastAPI) to listen for incoming webhooks from Alertmanager.
    *   When an alert is received, the bot should parse it and post a formatted message to a specific channel.
*   **Task 3: Set up AI Gateway (LiteLLM).**
    *   Configure `LiteLLM` to act as a proxy to one or more LLM providers.
    *   Set up a "virtual key" to abstract the underlying provider API keys.
    *   Define a fallback strategy (e.g., if the primary OpenAI model fails, automatically retry with an Anthropic model).
*   **Task 4: Design and Build the VibeDebugger AI Agent (LangGraph).**
    *   The agent's core logic will be built using the **ReAct (Reason+Act) framework**. This pattern involves a loop of reasoning about the problem, acting by using a tool to gather information, and observing the result to inform the next step.
    *   We will use **LangGraph** to orchestrate this ReAct loop, defining a state machine (a "graph") that represents the investigation process. All LLM calls from the agent must be directed through the `LiteLLM` gateway.
    *   **Agent States:** The graph will manage information like `alert_details`, `is_known_issue`, `release_context`, `code_analysis`, `final_recommendation`.
    *   **Agent Tools (Functions):**
        *   `get_alert_information`: Parses the incoming alert data.
        *   `check_known_issues_db`: A mock function that checks the alert against a hardcoded list of "known issues" (i.e., our non-critical warning).
        *   `get_latest_release_info`: A mock function that returns information about the `v2.0` release (e.g., "Deployed version 2.0, changes include feature X").
        *   `analyze_codebase_changes`: A function that can inspect the application's code. For the POC, this could be as simple as running a `git diff` between `v1.0` and `v2.0` tags to find the source of the new code.
        *   `generate_recommendation`: The final node in the graph. This tool first assembles all collected data into a structured context object (following the "Structured Context Protocol"). It then passes this context to an LLM to synthesize the information and generate a clear, actionable recommendation.
*   **Task 5: Integrate LangFuse.**
    *   Wrap the AI Agent's execution with LangFuse to get detailed traces of the LLM calls, tool usage, and the agent's path through the graph. This will be invaluable for debugging and demonstrating how the AI reached its conclusion.

### Phase 5: End-to-End Test & Demonstration

*   **Task 1: Script the Simulation.**
    *   Create a `run_simulation.sh` script that automates the entire POC scenario:
        1.  Start the environment with `v1.0` of the app (`docker compose up`).
        2.  Wait for a minute to show everything is stable.
        3.  "Deploy" `v2.0` by rebuilding and restarting the PHP containers.
        4.  Wait 30 seconds.
        5.  Trigger the incident by sending a `curl` request to the broken page.
*   **Task 2: Document and Record.**
    *   Document the steps to run the POC.
    *   Record a video or create a presentation walking through the simulation, showing the alert in Discord, the AI's analysis, and the final recommendation.

## 6. Technology Stack Summary

-   **Application:** PHP, Docker
-   **Monitoring:** Prometheus, Alertmanager
-   **AI Agent & Interface:** Python, LangGraph (for ReAct pattern), LangFuse, LiteLLM, discord.py, Flask/FastAPI

This plan provides a structured path to building a compelling and effective proof of concept for the VibeDebugger.
