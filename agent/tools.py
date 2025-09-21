"""
VibeDebugger Agent Tools

In a real application, these tools would interact with external systems
(e.g., a database, a CI/CD system, a version control API).
For this POC, they are simple, hardcoded mock functions.
"""
import logging

logger = logging.getLogger(__name__)

def check_known_issues(alert_summary: str) -> str:
    """
    Checks if the alert corresponds to a known, non-critical issue.
    
    Args:
        alert_summary: The summary text from the alert
        
    Returns:
        str: Analysis result indicating if this is a known issue
    """
    logger.info("TOOL: Checking known issues")
    known_warnings = [
        "The 'custom_feature_flag' is not set",
        "Known Warning"
    ]
    
    for warning in known_warnings:
        if warning in alert_summary:
            result = "This is a known, non-critical issue. No immediate action is required."
            logger.info(f"Found known issue: {warning}")
            return result
            
    result = "This does not appear to be a known issue."
    logger.info("No known issues found")
    return result

def get_release_info(alert_timestamp: str) -> str:
    """
    Fetches information about the most recent deployment.
    
    Args:
        alert_timestamp: Timestamp when the alert was triggered
        
    Returns:
        str: Information about recent deployments
    """
    logger.info("TOOL: Fetching release info")
    # Mocked to always return the same info for the POC
    result = "Deployment v2.0 occurred 5 minutes ago. Changes included an update to the user profile page and new routing logic."
    logger.info("Retrieved release information")
    return result

def analyze_code_changes(release_version: str) -> str:
    """
    Analyzes the code changes included in the specified release version.
    
    Args:
        release_version: The version to analyze (e.g., "v2.0")
        
    Returns:
        str: Analysis of code changes that might be causing issues
    """
    logger.info(f"TOOL: Analyzing code changes for {release_version}")
    # Mocked to always return the same info for the POC
    result = "Code analysis reveals a call to an undefined function `does_not_exist()` on the `/broken` route. This function was introduced in v2.0 but never defined."
    logger.info("Completed code analysis")
    return result
