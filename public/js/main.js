
// Connection status check
async function checkConnection() {
    const statusElement = document.getElementById('connectionStatus');
    try {
        const response = await fetch('/health', {
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        const data = await response.json();
        if (response.ok && data.status === 'ok') {
            statusElement.className = 'connection-status online';
            statusElement.textContent = 'Connected';
        } else {
            throw new Error(data.message || 'Health check failed');
        }
    } catch (error) {
        statusElement.className = 'connection-status offline';
        statusElement.textContent = 'Disconnected';
        console.error('Health check error:', error);
    }
}

// Check connection every 30 seconds
let connectionCheckInterval = setInterval(checkConnection, 30000);
checkConnection();

// Username validation function
function validateUsername(username, domain) {
    console.log('Validating:', { username, domain });
    
    if (!username) {
        console.log('Username empty');
        return { valid: false, message: 'Username is required' };
    }
    
    username = username.trim().toLowerCase();
    domain = domain.toLowerCase();
    console.log('Normalized:', { username, domain });
    
    console.log('Validation passed');
    return { valid: true };
}

// Form submission handler
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const domain = document.getElementById('domain').value;
    const errorDiv = document.getElementById('errorMessage');
    const userInfoDiv = document.getElementById('userInfo');
    const loadingDiv = document.getElementById('loading');
    const searchButton = document.getElementById('searchButton');
    
    // Validate username
    const validation = validateUsername(username, domain);
    if (!validation.valid) {
        errorDiv.innerHTML = `<strong>${validation.message}</strong>`;
        errorDiv.style.display = 'block';
        return;
    }
    
    // Reset display
    errorDiv.style.display = 'none';
    userInfoDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
    searchButton.disabled = true;
    searchButton.textContent = 'Searching...';
    
    try {
        const response = await fetch('/get-user-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username: username.toLowerCase(), 
                domain: domain.toLowerCase() 
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            let errorMessage = data.message || 'An error occurred';
            let errorDetails = data.details || '';
            
            errorDiv.innerHTML = `<strong>${errorMessage}</strong>`;
            if (errorDetails) {
                errorDiv.innerHTML += `<div class="error-details">${errorDetails}</div>`;
            }
            
            // Add troubleshooting steps based on error type
            if (data.type === 'NETWORK_ERROR') {
                errorDiv.innerHTML += `
                    <div class="troubleshooting">
                        <h4>Troubleshooting Steps:</h4>
                        <ul>
                            <li>Check if you are connected to the company network</li>
                            <li>Verify your VPN connection is active and stable</li>
                            <li>Try disconnecting and reconnecting to the VPN</li>
                            <li>Contact IT support if the issue persists</li>
                        </ul>
                    </div>`;
                } else if (data.type === 'USER_NOT_FOUND') {
                    errorDiv.innerHTML += `
                        <div class="troubleshooting">
                            <h4>Possible Solutions:</h4>
                            <ul>
                                <li>Verify the username is correct</li>
                                <li>Check if you selected the correct domain</li>
                                <li>Contact HR if you believe this is an error</li>
                            </ul>
                        </div>`;
                }
            
            errorDiv.style.display = 'block';
        } else {
            displayUserInfo(data, username, domain);
        }
    } catch (error) {
        errorDiv.innerHTML = `
            <strong>Connection Error</strong>
            <div class="error-details">Unable to connect to the server. Please try again later.</div>
            <div class="troubleshooting">
                <h4>Troubleshooting Steps:</h4>
                <ul>
                    <li>Check your internet connection</li>
                    <li>Verify the server is running</li>
                    <li>Try refreshing the page</li>
                </ul>
            </div>`;
        errorDiv.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
        searchButton.disabled = false;
        searchButton.textContent = 'Search';
    }
});

function displayUserInfo(response, username, domain) {
    const userInfoDiv = document.getElementById('userInfo');
    userInfoDiv.innerHTML = '';
    userInfoDiv.style.display = 'block';

    const user = response.accountInfo;
    let outputHtml = '';

    // Display alerts if any
    if (response.alerts && response.alerts.length > 0) {
        outputHtml += response.alerts.map(alert => 
            `<div class="alert-message warning">⚠️ ${alert}</div>`
        ).join('\n') + '\n\n';
    }

    // Group user information by category
    const accountInfo = [
        { label: 'Display Name', value: user.DisplayName || 'N/A' },
        { label: 'Username', value: user.Username || 'N/A' },
        { label: 'Full Name', value: user.FullName || 'N/A' },
        { label: 'Email', value: user.Email || 'N/A' },
        { label: 'Department', value: user.Department || 'N/A' }
    ];

    const securityInfo = [
        { label: 'Account Locked', value: user.AccountLocked ? 'Yes' : 'No', status: true },
        { label: 'Account Disabled', value: user.AccountDisabled ? 'Yes' : 'No', status: true },
        { label: 'Password Expired', value: user.PasswordExpired ? 'Yes' : 'No', status: true }
    ];

    const datesInfo = [
        { label: 'Password Last Set', value: user.PasswordLastSet || 'N/A' },
        { label: 'Password Expiration', value: user.PasswordExpiration || 'N/A' },
        { label: 'Account Expiration', value: user.AccountExpiration || 'N/A' },
        { label: 'Last Modified', value: user.LastModified || 'N/A' },
        { label: 'Created Date', value: user.CreatedDate || 'N/A' }
    ];

    // Build the output
    outputHtml += 'Account Information:\n';
    outputHtml += accountInfo.map(formatInfoLine).join('\n') + '\n\n';

    outputHtml += 'Security Status:\n';
    outputHtml += securityInfo.map(formatInfoLine).join('\n') + '\n\n';

    outputHtml += 'Important Dates:\n';
    outputHtml += datesInfo.map(info => formatInfoLine({ ...info, value: formatDate(info.value) })).join('\n');

    userInfoDiv.innerHTML = `<pre>${outputHtml}</pre>`;
}

function formatInfoLine(info) {
    const label = info.label.padEnd(20, ' ');
    let value = info.value;
    
    if (info.status) {
        const valueClass = value === 'Yes' ? 'warning' : 'ok';
        value = `<span class="${valueClass}">${value}</span>`;
    }
    
    return `${label}: ${value}`;
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A' || dateStr === 'Never') {
        return dateStr;
    }

    try {
        const date = new Date(dateStr);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return dateStr;
        }

        // Format the date
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };

        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        return dateStr;
    }
}