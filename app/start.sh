#!/bin/sh
set -e

# Default to v1.0 if APP_VERSION is not set
APP_VERSION=${APP_VERSION:-v1.0}

echo "Starting VibeDebugger App - Version: $APP_VERSION"

# Copy the selected version of the app to the web root
cp -r /usr/src/app/${APP_VERSION}/. /var/www/html/

# Start the PHP built-in web server
php -S 0.0.0.0:8000 -t /var/www/html
