<?php
declare(strict_types=1);

// v2.0 - The new version with a latent critical bug.

// Configure error handling
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', '/var/log/php_errors.log');

// Set custom error handler
set_error_handler(function($severity, $message, $file, $line) {
    error_log("PHP Error [$severity]: $message in $file on line $line");
    return false;
});

// Set custom exception handler
set_exception_handler(function($exception) {
    error_log("PHP Fatal error: Uncaught " . get_class($exception) . ": " . $exception->getMessage() . " in " . $exception->getFile() . " on line " . $exception->getLine());
    http_response_code(500);
    echo "<h1>Application Error</h1><p>An error occurred. Please try again later.</p>";
});

// The same known warning from v1.0 is still present.
error_log("Known Warning: The 'custom_feature_flag' is not set. Using default.", 0);

// Simple router to simulate different pages
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';

try {
    if ($request_uri === '/broken') {
        // This is the new, buggy code introduced in v2.0
        echo "<h1>Broken Page</h1>";
        echo "<p>This page contains a critical bug!</p>";
        
        // This will trigger a fatal error - but now it's handled properly
        if (!function_exists('does_not_exist')) {
            throw new Error("Call to undefined function does_not_exist()");
        }
        does_not_exist(); 
    } elseif ($request_uri === '/health') {
        header('Content-Type: application/json');
        echo json_encode(['status' => 'healthy', 'version' => 'v2.0', 'timestamp' => date('c')]);
        exit;
    } elseif ($request_uri === '/metrics') {
        header('Content-Type: text/plain');
        echo "# HELP app_requests_total Total number of requests\n";
        echo "# TYPE app_requests_total counter\n";
        echo "app_requests_total{version=\"v2.0\",status=\"success\"} 1\n";
        echo "# HELP app_warnings_total Total number of warnings\n";
        echo "# TYPE app_warnings_total counter\n";
        echo "app_warnings_total{version=\"v2.0\",type=\"known_warning\"} 1\n";
        echo "# HELP app_errors_total Total number of errors\n";
        echo "# TYPE app_errors_total counter\n";
        if ($request_uri === '/broken') {
            echo "app_errors_total{version=\"v2.0\",type=\"fatal_error\"} 1\n";
        }
        exit;
    } else {
        // This is the main page, which is stable.
        echo "<h1>VibeDebugger App - v2.0</h1>";
        echo "<p>This is the new version of the application.</p>";
        echo "<p>A non-critical warning has been logged.</p>";
        echo "<p>Try visiting <a href='/broken'>the broken page</a> to trigger an incident.</p>";
        echo "<p><a href='/health'>Health Check</a> | <a href='/metrics'>Metrics</a></p>";
    }
} catch (Error | Exception $e) {
    error_log("Application Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    http_response_code(500);
    echo "<h1>Application Error</h1><p>An error occurred. Please try again later.</p>";
}

?>
