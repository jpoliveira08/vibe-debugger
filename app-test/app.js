// Simple app to test New Relic logs with ES modules
import newrelic from 'newrelic';
import express from 'express';

const app = express();
const PORT = 3000;

// Helper function to log with New Relic metadata
function logWithMetadata(level, message) {
  const linkingMetadata = newrelic.getLinkingMetadata();
  const logEntry = {
    message,
    ...linkingMetadata,
    timestamp: new Date().toISOString()
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

app.get('/', (req, res) => {
  logWithMetadata('info', 'Homepage visited');
  res.json({ message: 'Hello! This is a simple test app for New Relic logs with ES modules' });
});

app.get('/error', (req, res) => {
  logWithMetadata('error', 'Test error occurred!');
  const error = new Error('This is a test error for New Relic');
  throw error;
});

app.get('/log', (req, res) => {
  logWithMetadata('info', 'This is a test log message');
  logWithMetadata('warn', 'This is a test warning message');
  logWithMetadata('error', 'This is a test error message');
  res.json({ message: 'Logs sent! Check New Relic.' });
});

app.listen(PORT, () => {
  console.log(`Simple test app running on http://localhost:${PORT}`);
  console.log('Visit /log to generate test logs');
  console.log('Visit /error to generate test error');
});
