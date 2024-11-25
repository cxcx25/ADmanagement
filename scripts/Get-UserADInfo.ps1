[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [string]$Domain,
    [Parameter(Mandatory = $false)]
    [switch]$SkipChecks
)

# Suppress all output preferences
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$ErrorActionPreference = "Stop"
$Global:Error.Clear()

# Function for debug logging that won't interfere with JSON output
function Write-DebugLog {
    param([string]$Message)
    if ($env:DEBUG) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Add-Content -Path "$PSScriptRoot\..\logs\debug.log" -Value "[$timestamp] $Message"
    }
}

function Format-NullableDate {
    param([DateTime]$date)
    if ($date) {
        return $date.ToString("MM/dd/yyyy hh:mm:ss tt")
    }
    return ""
}

try {
    Write-DebugLog "Starting script execution"
    
    # Verify ActiveDirectory module is available
    if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
        throw "ActiveDirectory PowerShell module is not installed"
    }

    # Sanitize inputs to prevent injection
    if ($Username -match '["`\(\)<>]') {
        throw "Invalid username format. Username contains invalid characters"
    }

    if ($Domain -notmatch '^[a-zA-Z0-9.-]+$') {
        throw "Invalid domain format"
    }
    
    Write-DebugLog "Importing ActiveDirectory module"
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-DebugLog "Module imported successfully"

    # Simple domain mapping
    $domainFQDN = switch ($Domain.ToLower()) {
        "lux" { "luxgroup.net" }
        "essilor" { "us.essilor.pvt" }
        default { $Domain }
    }
    Write-DebugLog "Resolved domain FQDN: $domainFQDN"

    Write-DebugLog "Testing connection to domain"
    $null = Test-Connection -ComputerName $domainFQDN -Count 1 -ErrorAction Stop
    Write-DebugLog "Domain connection successful"

    Write-DebugLog "Starting AD query for user: $Username"
    $properties = @(
        'DisplayName', 'SamAccountName', 'Name',
        'PasswordExpired', 'PasswordLastSet',
        'AccountExpirationDate', 'LockedOut',
        'Enabled', 'Mail', 'Department',
        'WhenChanged', 'WhenCreated',
        'msDS-UserPasswordExpiryTimeComputed'
    )

    Write-DebugLog "Executing Get-ADUser command"
    $user = Get-ADUser -Identity $Username -Server $domainFQDN -Properties $properties -ErrorAction Stop
    
    if ($null -eq $user) {
        throw "User not found: $Username"
    }

    Write-DebugLog "User found, processing data"
    $result = @{
        alerts = @()
        accountInfo = @{
            DisplayName = if ($user.DisplayName) { $user.DisplayName } else { "" }
            Username = if ($user.SamAccountName) { $user.SamAccountName } else { "" }
            FullName = if ($user.Name) { $user.Name } else { "" }
            Email = if ($user.Mail) { $user.Mail } else { "" }
            Department = if ($user.Department) { $user.Department } else { "" }
            AccountLocked = [bool]$user.LockedOut
            AccountDisabled = -not [bool]$user.Enabled
            PasswordExpired = [bool]$user.PasswordExpired
            PasswordLastSet = if ($user.PasswordLastSet) { Format-NullableDate $user.PasswordLastSet } else { "" }
            PasswordExpiration = if ($user.'msDS-UserPasswordExpiryTimeComputed') {
                Format-NullableDate ([datetime]::FromFileTime($user.'msDS-UserPasswordExpiryTimeComputed'))
            } else { "" }
            AccountExpiration = if ($user.AccountExpirationDate) { Format-NullableDate $user.AccountExpirationDate } else { "No expiration date set" }
            LastModified = if ($user.WhenChanged) { Format-NullableDate $user.WhenChanged } else { "" }
            CreatedDate = if ($user.WhenCreated) { Format-NullableDate $user.WhenCreated } else { "" }
        }
    }

    # Add alerts
    if ($user.LockedOut) { $result.alerts += "Account is locked" }
    if ($user.PasswordExpired) { $result.alerts += "Password is expired" }
    if ($user.AccountExpirationDate -and $user.AccountExpirationDate -lt (Get-Date)) {
        $result.alerts += "Account expiration date has passed"
    }
    if (-not $user.Enabled) { $result.alerts += "Account is disabled" }

    # Output only the JSON result - use Compress to remove whitespace
    $jsonString = ($result | ConvertTo-Json -Depth 10 -Compress)
    [Console]::WriteLine($jsonString)
} catch {
    # Return error JSON
    $errorResult = @{
        error = $true
        message = "Error processing request"
        details = $_.Exception.Message
    }
    $errorJson = ($errorResult | ConvertTo-Json -Compress)
    [Console]::WriteLine($errorJson)
    exit 1
}