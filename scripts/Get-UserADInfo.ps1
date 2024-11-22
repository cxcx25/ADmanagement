[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [string]$Domain,
    [Parameter(Mandatory = $false)]
    [switch]$SkipChecks
)

# Set error action preference and trap errors
$ErrorActionPreference = "Stop"
$VerbosePreference = "SilentlyContinue"  # Suppress verbose output
$Global:Error.Clear()

trap {
    Write-Host "[ERROR] Fatal error: $_"
    Write-Host "[ERROR] Stack trace: $($_.ScriptStackTrace)"
    @{
        error = $true
        message = "Fatal Error"
        details = $_.ToString()
        stack = $_.ScriptStackTrace
    } | ConvertTo-Json
    Write-Host "[COMMAND_COMPLETE]"
    exit 1
}

# Import AD module silently
Import-Module ActiveDirectory -Verbose:$false

function Format-NullableDate {
    param([DateTime]$date)
    if ($date) {
        return $date.ToString("MM/dd/yyyy hh:mm:ss tt")
    }
    return ""
}

try {
    Write-Host "[DEBUG] Starting script execution"
    
    # Verify ActiveDirectory module is available
    if (-not (Get-Module -ListAvailable -Name ActiveDirectory)) {
        throw "ActiveDirectory PowerShell module is not installed"
    }
    
    Write-Host "[DEBUG] Importing ActiveDirectory module"
    Import-Module ActiveDirectory -ErrorAction Stop -Verbose
    Write-Host "[DEBUG] Module imported successfully"

    # Simple domain mapping
    $domainFQDN = switch ($Domain.ToLower()) {
        "lux" { "luxgroup.net" }
        "essilor" { "us.essilor.pvt" }
        default { $Domain }
    }
    Write-Host "[DEBUG] Resolved domain FQDN: $domainFQDN"

    Write-Host "[DEBUG] Testing connection to domain"
    $testConnection = Test-Connection -ComputerName $domainFQDN -Count 1 -ErrorAction Stop
    if (-not $testConnection) {
        throw "Cannot connect to domain: $domainFQDN"
    }
    Write-Host "[DEBUG] Domain connection successful"

    Write-Host "[DEBUG] Starting AD query for user: $Username"
    $properties = @(
        'DisplayName', 'SamAccountName', 'Name',
        'PasswordExpired', 'PasswordLastSet',
        'AccountExpirationDate', 'LockedOut',
        'Enabled', 'Mail', 'Department',
        'WhenChanged', 'WhenCreated',
        'msDS-UserPasswordExpiryTimeComputed'
    )

    Write-Host "[DEBUG] Executing Get-ADUser command"
    $user = Get-ADUser -Identity $Username -Server $domainFQDN -Properties $properties -ErrorAction Stop
    
    if ($null -eq $user) {
        throw "User not found: $Username"
    }

    Write-Host "[DEBUG] User found, processing data"
    $userInfo = @{
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
    if ($user.LockedOut) { $userInfo.alerts += "Account is locked" }
    if ($user.PasswordExpired) { $userInfo.alerts += "Password is expired" }
    if ($user.AccountExpirationDate -and $user.AccountExpirationDate -lt (Get-Date)) {
        $userInfo.alerts += "Account expiration date has passed"
    }
    if (-not $user.Enabled) { $userInfo.alerts += "Account is disabled" }

    Write-Host "[DEBUG] Converting to JSON"
    $userInfo | ConvertTo-Json -Depth 10
    Write-Host "[COMMAND_COMPLETE]"
    exit 0
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)"
    Write-Host "[ERROR] Stack trace: $($_.ScriptStackTrace)"
    @{
        error = $true
        message = "Error"
        details = $_.Exception.Message
        stack = $_.ScriptStackTrace
    } | ConvertTo-Json
    Write-Host "[COMMAND_COMPLETE]"
    exit 1
}