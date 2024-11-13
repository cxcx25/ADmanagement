const { exec } = require('child_process');
const path = require('path');

const psScriptPath = 'C:\\Users\\joseph.marilla\\Documents\\Project\\ADmanagement\\scripts\\Get-UserADInfo.ps1';

exports.getUserInfo = (req, res) => {
    const { username, domain } = req.body;

    const command = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}" -Username "${username}" -Domain "${domain}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ error: `Error executing script: ${error.message}` });
        }

        // Filter out any warnings and only capture user information lines.
        const userInfo = {};
        const relevantLines = stdout
            .split('\n')
            .filter(line => !line.startsWith("WARNING:") && line.includes(":")) // Exclude warning lines and select key-value pairs
            .map(line => line.trim()); // Trim whitespace

        relevantLines.forEach(line => {
            const [key, ...valueParts] = line.split(":");
            userInfo[key.trim()] = valueParts.join(":").trim(); // Handles potential extra colons in the value
        });

        res.json(userInfo); // Send only parsed user info as JSON
    });
};
