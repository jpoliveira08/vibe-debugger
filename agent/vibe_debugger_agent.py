import os
import logging
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.prebuilt.tool_node import ToolNode
from typing import TypedDict, Annotated, List
import operator
from litellm import completion
from .tools import check_known_issues, get_release_info, analyze_code_changes
from langfuse.callback import CallbackHandler

logger = logging.getLogger(__name__)

# Define the state for our graph
class AgentState(TypedDict):
    alert_data: dict
    messages: Annotated[List[str], operator.add]
    investigation_summary: str

class VibeDebuggerAgent:
    def __init__(self):
        self.tool_executor = ToolExecutor([check_known_issues, get_release_info, analyze_code_changes])
        # Add the LangFuse callback handler
        self.langfuse_handler = CallbackHandler()
        self.graph = self._build_graph()
        self.model = os.getenv("LITELLM_MODEL", "gpt-4")  # Model served by LiteLLM
        self.api_base = os.getenv("LITELLM_API_BASE", "http://localhost:4000")
        logger.info(f"Initialized VibeDebugger Agent with model: {self.model}")

    def _build_graph(self):
        builder = StateGraph(AgentState)

        # Define the nodes
        builder.add_node("reason", self.reason_step)
        builder.add_node("tools", ToolNode(self.tool_executor))

        # Define the edges
        builder.set_entry_point("reason")
        builder.add_conditional_edges(
            "reason",
            self.should_continue,
            {
                "continue": "tools",
                "end": END
            }
        )
        builder.add_edge("tools", "reason")

        return builder.compile()

    def _get_llm_response(self, messages, tools=None):
        try:
            return completion(
                model=self.model,
                messages=messages,
                tools=tools,
                api_base=self.api_base
            )
        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            raise

    def should_continue(self, state):
        messages = state['messages']
        last_message = messages[-1]
        if not last_message.tool_calls:
            return "end"
        return "continue"

    def reason_step(self, state):
        messages = state['messages']
        response = self._get_llm_response(messages, self.tool_executor.tools)
        return {"messages": [response.choices[0].message]}

    def run(self, alert_data):
        try:
            logger.info("Starting VibeDebugger investigation")
            
            initial_prompt = f"""
            You are an expert AI assistant called VibeDebugger.
            Your task is to investigate and diagnose production alerts.

            An alert has just fired with the following details:
            - Summary: {alert_data.get('annotations', {}).get('summary', 'N/A')}
            - Description: {alert_data.get('annotations', {}).get('description', 'N/A')}
            - Status: {alert_data.get('status', 'N/A')}
            - Starts at: {alert_data.get('startsAt', 'N/A')}

            Begin your investigation. First, check if this is a known issue.
            """
            initial_messages = [{"role": "user", "content": initial_prompt}]
            
            final_state = self.graph.invoke(
                {"messages": initial_messages},
                config={"callbacks": [self.langfuse_handler]}
            )
            
            # Once the loop finishes, generate a final summary
            summary_prompt = "Summarize your investigation, state the root cause, and recommend a course of action (e.g., rollback, hotfix)."
            final_messages = final_state['messages'] + [{"role": "user", "content": summary_prompt}]
            
            final_response = self._get_llm_response(final_messages)
            
            logger.info("VibeDebugger investigation completed successfully")
            return {"investigation_summary": final_response.choices[0].message.content}
            
        except Exception as e:
            logger.error(f"VibeDebugger investigation failed: {e}")
            return {"investigation_summary": f"Investigation failed due to error: {str(e)}"}

# Example usage:
if __name__ == '__main__':
    agent = VibeDebuggerAgent()
    mock_alert = {
        'annotations': {
            'summary': 'Critical PHP error detected',
            'description': 'A critical PHP fatal error has been detected...'
        },
        'status': 'firing',
        'startsAt': '2025-09-21T12:00:00Z'
    }
    result = agent.run(mock_alert)
    print("---FINAL SUMMARY---")
    print(result['investigation_summary'])
