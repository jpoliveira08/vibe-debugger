<?php
declare(strict_types=1);

// v1.0 - The stable version with a known, non-critical warning.

// Configure error handling
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', '/var/log/php_errors.log');

// Set custom error handler
set_error_handler(function($severity, $message, $file, $line) {
    error_log("PHP Error [$severity]: $message in $file on line $line");
    return false;
});

// Simulate a known warning that might appear in logs.
// In a real application, this could be a deprecated function usage, a notice, etc.
error_log("Known Warning: The 'custom_feature_flag' is not set. Using default.", 0);

// Simple router to handle different endpoints
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';

try {
    if ($request_uri === '/health') {
        header('Content-Type: application/json');
        echo json_encode(['status' => 'healthy', 'version' => 'v1.0', 'timestamp' => date('c')]);
        exit;
    } elseif ($request_uri === '/metrics') {
        header('Content-Type: text/plain');
        echo "# HELP app_requests_total Total number of requests\n";
        echo "# TYPE app_requests_total counter\n";
        echo "app_requests_total{version=\"v1.0\",status=\"success\"} 1\n";
        echo "# HELP app_warnings_total Total number of warnings\n";
        echo "# TYPE app_warnings_total counter\n";
        echo "app_warnings_total{version=\"v1.0\",type=\"known_warning\"} 1\n";
        exit;
    } else {
        echo "<h1>VibeDebugger App - v1.0</h1>";
        echo "<p>This is the stable version of the application.</p>";
        echo "<p>A non-critical warning has been logged.</p>";
        echo "<p><a href='/health'>Health Check</a> | <a href='/metrics'>Metrics</a></p>";
    }
} catch (Exception $e) {
    error_log("Application Error: " . $e->getMessage());
    http_response_code(500);
    echo "<h1>Application Error</h1><p>An error occurred. Please try again later.</p>";
}