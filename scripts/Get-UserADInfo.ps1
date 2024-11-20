[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [string]$Domain
)

try {
    # Import the ActiveDirectory module
    Import-Module ActiveDirectory

    Write-Host "Searching for user: $Username in domain: $Domain"
    
    # Convert domain name to proper format
    $domainFQDN = switch ($Domain.ToLower()) {
        "lux" { "luxgroup.net" }
        "essilor" { "essilor.com" }
        default { $Domain }
    }

    Write-Host "Using domain FQDN: $domainFQDN"

    # Try to get domain controller
    try {
        $dc = (Get-ADDomainController -DomainName $domainFQDN -Discover -NextClosestSite).HostName[0]
        Write-Host "Found domain controller: $dc"
    } catch {
        Write-Host "Could not auto-discover DC, using domain name directly"
        $dc = $domainFQDN
    }

    # Get user information with additional properties
    $user = Get-ADUser -Identity $Username -Server $dc -Properties DisplayName, SamAccountName, Name, PasswordExpired, 
        PasswordLastSet, AccountExpirationDate, LockedOut, Enabled, UserPrincipalName, WhenChanged, WhenCreated, 
        Mail, Department, DistinguishedName, "msDS-UserPasswordExpiryTimeComputed"

    if ($null -eq $user) {
        Write-Error "User not found: $Username"
        exit 1
    }

    # Calculate alerts
    $alerts = @()
    if ($user.LockedOut) {
        $alerts += "Account is locked"
    }
    if ($user.PasswordExpired) {
        $alerts += "Password is expired"
    }
    if ($user.AccountExpirationDate -and $user.AccountExpirationDate -lt (Get-Date)) {
        $alerts += "Account expiration date has passed"
    }
    if (-not $user.Enabled) {
        $alerts += "Account is disabled"
    }

    # Convert to custom object with desired properties
    $userInfo = @{
        DisplayName = $user.DisplayName
        SamAccountName = $user.SamAccountName
        Name = $user.Name
        PasswordExpired = $user.PasswordExpired
        PasswordLastSet = $user.PasswordLastSet
        AccountExpirationDate = if ($user.AccountExpirationDate) { $user.AccountExpirationDate } else { "No expiration date set" }
        IsLocked = $user.LockedOut
        IsDisabled = -not $user.Enabled
        UserPrincipalName = $user.UserPrincipalName
        WhenChanged = $user.WhenChanged
        WhenCreated = $user.WhenCreated
        Mail = $user.Mail
        Department = $user.Department
        DistinguishedName = $user.DistinguishedName
        PasswordExpirationDate = if ($user.'msDS-UserPasswordExpiryTimeComputed' -and $user.'msDS-UserPasswordExpiryTimeComputed' -ne 0) { 
            [datetime]::FromFileTime($user.'msDS-UserPasswordExpiryTimeComputed') 
        } else { 
            "Password does not expire" 
        }
        AccountStatus = if ($alerts.Count -gt 0) { $alerts } else { @("Account is in good standing") }
    }

    # Convert to JSON and output
    $userInfo | ConvertTo-Json
} catch {
    Write-Error "Error getting user info: $($_.Exception.Message)"
    exit 1
}