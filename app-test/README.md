# Simple New Relic Test App

A minimal Node.js app to test if logs show up in New Relic.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set your New Relic license key:**

   ```bash
   cp env.example .env
   # Edit .env and add your license key
   ```

3. **Run the app:**

   ```bash
   npm start
   ```

4. **Test the endpoints:**

   - `http://localhost:3000/` - Homepage
   - `http://localhost:3000/log` - Generates test logs
   - `http://localhost:3000/error` - Generates test error

5. **Check New Relic:**
   - Go to New Relic One → Logs
   - Look for application "Simple Test App"
   - Check Error Inbox for errors
