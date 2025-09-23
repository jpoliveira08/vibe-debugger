/* Simple New Relic configuration */
'use strict'

require('dotenv').config();

exports.config = {
  app_name: process.env.NEW_RELIC_APP_NAME,
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  
  // Application logging - sends all console.log/error/warn to New Relic
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    metrics: {
      enabled: true
    },
    local_decorating: {
      enabled: false
    }
  },
  
  // Agent logging
  logging: {
    level: 'info',
    enabled: true
  },
  
  // Error collection for Error Inbox
  error_collector: {
    enabled: true,
    capture_events: true
  }
}