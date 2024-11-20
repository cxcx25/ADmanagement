const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

// Convert exec to promise-based
const execPromise = util.promisify(exec);

// Create Express app
const app = express();
const port = 3000;

// Logging function
const log = (message, isError = false) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${isError ? '[ERROR]' : '[INFO]'} ${message}`;
    console.log(logMessage);
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// AD User Info Endpoint
app.post('/get-user-info', async (req, res) => {
    const { username, domain } = req.body;
    log(`Request received for username: ${username}, domain: ${domain}`);

    try {
        const scriptPath = path.join(__dirname, 'scripts', 'Get-UserADInfo.ps1');
        const command = `powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "& { try { & '${scriptPath}' -Username '${username}' -Domain '${domain}' } catch { Write-Error $_.Exception.Message; exit 1 } }"`;
        
        log(`Executing PowerShell command: ${command}`);
        
        try {
            const { stdout, stderr } = await execPromise(command);
            
            // Handle PowerShell error output
            if (stderr) {
                log(`PowerShell stderr: ${JSON.stringify(stderr)}`, true);
                
                // Convert stderr to string if it's not already
                const errorText = typeof stderr === 'string' ? stderr : JSON.stringify(stderr);
                
                if (errorText.includes("Cannot find an object with identity")) {
                    return res.status(404).json({ error: "User not found in Active Directory" });
                }
                
                if (errorText.includes("Error getting user info:")) {
                    const match = errorText.match(/Error getting user info: (.+?)(\r?\n|$)/);
                    return res.status(404).json({ error: match ? match[1] : "Error retrieving user information" });
                }
                
                return res.status(500).json({ error: "Error retrieving user information" });
            }

            // Process stdout
            const stdoutStr = stdout.toString().trim();
            log(`PowerShell stdout: ${stdoutStr}`);
            
            // Look for JSON in the output
            const jsonMatch = stdoutStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                log(`Failed to parse PowerShell output: No valid JSON data found`, true);
                log(`Raw output: ${stdoutStr}`, true);
                return res.status(500).json({ error: 'Failed to retrieve user information' });
            }

            try {
                const userData = JSON.parse(jsonMatch[0]);
                res.json(userData);
            } catch (parseError) {
                log(`Error parsing JSON: ${parseError.message}`, true);
                return res.status(500).json({ error: 'Error processing user data' });
            }
        } catch (execError) {
            log(`PowerShell execution error: ${execError.message}`, true);
            if (execError.stderr) {
                log(`PowerShell stderr from error: ${execError.stderr}`, true);
            }
            return res.status(500).json({ error: 'Error executing PowerShell script' });
        }
    } catch (error) {
        log(`General error: ${error.message}`, true);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, (err) => {
    if (err) {
        log(`Error starting server: ${err}`, true);
        process.exit(1);
    }
    log(`Server is running on http://localhost:${port}`);
});