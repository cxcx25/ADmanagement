# Suppress all output preferences
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

try {
    # Just return success JSON without importing AD module
    $result = @{
        status = "ok"
        message = "PowerShell available"
    }
    
    # Convert to JSON and output directly
    Write-Output ($result | ConvertTo-Json -Compress)
} catch {
    # Return error JSON
    $result = @{
        status = "error"
        message = $_.Exception.Message
    }
    
    # Convert to JSON and output directly
    Write-Output ($result | ConvertTo-Json -Compress)
    exit 1
}