const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const cors = require('cors');

// Constants
const PORT = process.env.PORT || 3000;
const COMMAND_TIMEOUT = 60000; // 60 seconds

// Configure logging
function log(message, level = 'INFO') {
    // Only log INFO and ERROR messages, skip DEBUG
    if (level === 'DEBUG') return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// PowerShell execution wrapper
async function executePowerShell(scriptPath, params) {
    return new Promise((resolve, reject) => {
        const ps = spawn('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            `
            $ErrorActionPreference = 'Stop'
            $ProgressPreference = 'SilentlyContinue'
            $VerbosePreference = 'SilentlyContinue'
            $DebugPreference = 'SilentlyContinue'
            $InformationPreference = 'SilentlyContinue'
            try {
                & '${scriptPath}' ${params}
                if ($LASTEXITCODE) { exit $LASTEXITCODE }
            } catch {
                Write-Error $_.Exception.Message
                exit 1
            }
            `
        ]);
        
        let output = '';
        let error = '';

        // Handle stdout
        ps.stdout.on('data', (data) => {
            output += data.toString();
        });

        // Handle stderr
        ps.stderr.on('data', (data) => {
            error += data.toString();
        });

        // Handle process errors
        ps.on('error', (err) => {
            log(`PS Process Error: ${err.message}`, 'ERROR');
            reject(new Error(`PowerShell process error: ${err.message}`));
        });

        // Handle process exit
        ps.on('exit', (code) => {
            if (code !== 0) {
                log(`PowerShell exited with code ${code}: ${error}`, 'ERROR');
                reject(new Error(error || 'PowerShell script failed'));
                return;
            }

            try {
                // Clean the output and try to parse as JSON
                const cleanOutput = output.trim();
                if (!cleanOutput) {
                    throw new Error('No output received from PowerShell');
                }

                log('Raw PowerShell output: ' + cleanOutput, 'DEBUG');
                const jsonOutput = JSON.parse(cleanOutput);
                resolve(jsonOutput);
            } catch (err) {
                log('Failed to parse PowerShell output: ' + output, 'ERROR');
                reject(new Error('Failed to parse PowerShell output: ' + err.message));
            }
        });

        // Send the command to PowerShell
        ps.stdin.end();
    });
}

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint - serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Test PowerShell availability
        const scriptPath = path.join(__dirname, 'scripts', 'Test-Connection.ps1');
        const result = await executePowerShell(scriptPath, '');
        res.json(result);
    } catch (error) {
        log(`Health check failed: ${error.message}`, 'ERROR');
        res.status(503).json({ 
            status: 'error',
            message: 'Service unavailable'
        });
    }
});

// Main user info endpoint
app.post('/get-user-info', async (req, res) => {
    const startTime = Date.now();
    const { username, domain } = req.body;

    // Input validation
    if (!username || !domain) {
        log('Missing required parameters', 'ERROR');
        return res.status(400).json({
            error: true,
            message: 'Missing required parameters',
            details: 'Both username and domain are required'
        });
    }

    log(`Request received for username: ${username}, domain: ${domain}`, 'INFO');

    try {
        // Construct script path and parameters
        const scriptPath = path.join(__dirname, 'scripts', 'Get-UserADInfo.ps1');
        const params = `-Username '${username}' -Domain '${domain}' -SkipChecks`;

        // Execute PowerShell script
        const result = await executePowerShell(scriptPath, params);

        // Check for errors in result
        if (result.error) {
            log(`PowerShell script returned error: ${result.details}`, 'ERROR');
            return res.status(400).json(result);
        }

        // Log success and return result
        const duration = Date.now() - startTime;
        log(`Request completed successfully in ${duration}ms`, 'INFO');
        res.json(result);
    } catch (error) {
        // Handle execution errors
        log(`Error processing request: ${error.message}`, 'ERROR');
        res.status(500).json({
            error: true,
            message: 'Internal server error',
            details: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    log(`Unhandled error: ${err.message}`, 'ERROR');
    res.status(500).json({
        error: true,
        message: 'Server Error',
        details: 'An unexpected error occurred'
    });
});

// Start server
app.listen(PORT, () => {
    log(`Server is running on http://localhost:${PORT}`);
});