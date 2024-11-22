const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const cors = require('cors');

// Constants
const PORT = process.env.PORT || 3000;
const COMMAND_TIMEOUT = 60000; // 60 seconds

// Configure logging
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// PowerShell execution wrapper
async function executePowerShell(scriptPath, params) {
    return new Promise((resolve, reject) => {
        log('Starting PowerShell execution', 'DEBUG');
        
        // Initialize PowerShell process
        const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive']);
        let output = '';
        let error = '';
        let debugOutput = '';

        // Set up command with parameters
        const command = `
            $ErrorActionPreference = 'Stop'
            Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
            & '${scriptPath}' ${params}
            exit $LASTEXITCODE
        `.trim() + '\n';

        // Set up timeout
        const timeout = setTimeout(() => {
            log('PowerShell execution timed out', 'ERROR');
            ps.kill();
            reject(new Error(`Command execution timeout after ${COMMAND_TIMEOUT}ms. Debug output:\n${debugOutput}`));
        }, COMMAND_TIMEOUT);

        // Handle stdout
        ps.stdout.on('data', (data) => {
            const chunk = data.toString();
            debugOutput += chunk;
            // Only log non-verbose messages with actual content
            const trimmedChunk = chunk.trim();
            if (trimmedChunk && !trimmedChunk.startsWith('VERBOSE:')) {
                log(`PS Output: ${trimmedChunk}`, 'DEBUG');
            }
            output += chunk;
        });

        // Handle stderr
        ps.stderr.on('data', (data) => {
            const chunk = data.toString();
            debugOutput += chunk;
            log(`PS Error: ${chunk.trim()}`, 'ERROR');
            error += chunk;
        });

        // Handle process errors
        ps.on('error', (err) => {
            clearTimeout(timeout);
            log(`PS Process Error: ${err.message}`, 'ERROR');
            reject(new Error(`PowerShell process error: ${err.message}`));
        });

        // Handle process exit
        ps.on('exit', (code) => {
            clearTimeout(timeout);
            log(`PowerShell process exited with code ${code}`, code === 0 ? 'INFO' : 'ERROR');
            
            if (code !== 0) {
                reject(new Error(`PowerShell process failed with exit code ${code}. Error: ${error}`));
                return;
            }

            // Parse the output
            try {
                // Find the last valid JSON in the output
                const jsonMatch = output.match(/\{[\s\S]*\}/g);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in output');
                }
                const result = JSON.parse(jsonMatch[jsonMatch.length - 1]);
                resolve(result);
            } catch (err) {
                log(`Failed to parse PowerShell output: ${err.message}`, 'ERROR');
                reject(new Error(`Failed to parse PowerShell output: ${err.message}`));
            }
        });

        // Send command to PowerShell
        ps.stdin.write(command);
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
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
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