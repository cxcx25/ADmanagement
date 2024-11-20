const { exec } = require('child_process');
const path = require('path');

exports.getUserInfo = (req, res) => {
    const { username, domain } = req.body;
    console.log(`Received request for username: ${username}, domain: ${domain}`);

    const psScriptPath = path.join(__dirname, '..', 'scripts', 'Get-UserADInfo.ps1');
    console.log(`PowerShell script path: ${psScriptPath}`);

    // Set environment variables based on the domain
    const envVars = domain.toUpperCase() === 'LUX' ? {
        AD_URL: process.env.LUX_AD_URL,
        AD_BIND_DN: process.env.LUX_AD_BIND_DN,
        AD_PASSWORD: process.env.LUX_AD_PASSWORD,
        AD_BASE_DN: process.env.LUX_AD_BASE_DN
    } : {
        AD_URL: process.env.ESSILOR_AD_URL,
        AD_BIND_DN: process.env.ESSILOR_AD_BIND_DN,
        AD_PASSWORD: process.env.ESSILOR_AD_PASSWORD,
        AD_BASE_DN: process.env.ESSILOR_AD_BASE_DN
    };

    console.log('Environment variables set:', JSON.stringify(envVars, null, 2));

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}" -Username "${username}" -Domain "${domain}"`;
    console.log(`Executing command: ${command}`);
    
    exec(command, { env: { ...process.env, ...envVars } }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Execution error: ${error}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ error: "An error occurred while retrieving user information", details: error.message });
        }
        
        if (stderr) {
            console.warn(`Warning - stderr output: ${stderr}`);
        }

        console.log(`Raw stdout: ${stdout}`);
        
        try {
            const output = JSON.parse(stdout);
            console.log('Successfully parsed JSON output');
            res.json(output);
        } catch (parseError) {
            console.error(`JSON parse error: ${parseError}`);
            console.error(`Failed to parse stdout: ${stdout}`);
            res.status(500).json({ error: "Failed to parse user information", details: parseError.message });
        }
    });
};