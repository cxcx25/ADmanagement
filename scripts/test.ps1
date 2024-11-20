[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [string]$Domain
)

$ErrorActionPreference = "Stop"
Write-Host "Starting test script..." -ForegroundColor Green

try {
    # Hard-coded test values for Lux domain
    $config = @{
        DomainController = "ldap://luxgroup.net"
        BindDN = "CN=C22643,OU=CVG,OU=LUXNAUSERS,OU=RETAIL NORTH AMERICA,DC=LUXGROUP,DC=NET"
        Password = "Trackingwave31!!"
        BaseDN = "DC=LUXGROUP,DC=NET"
    }

    Write-Host "Configuration loaded:" -ForegroundColor Cyan
    Write-Host "Domain Controller: $($config.DomainController)"
    Write-Host "Bind DN: $($config.BindDN)"
    Write-Host "Base DN: $($config.BaseDN)"

    Write-Host "`nAttempting LDAP connection..." -ForegroundColor Cyan
    
    # Create DirectoryEntry
    $entry = New-Object System.DirectoryServices.DirectoryEntry(
        $config.DomainController,
        $config.BindDN,
        $config.Password
    )

    Write-Host "DirectoryEntry created successfully" -ForegroundColor Green

    # Create DirectorySearcher
    $searcher = New-Object System.DirectoryServices.DirectorySearcher($entry)
    $searcher.Filter = "(&(objectClass=user)(sAMAccountName=$Username))"
    $searcher.SearchBase = $config.BaseDN
    
    Write-Host "Searching for user: $Username" -ForegroundColor Cyan
    $result = $searcher.FindOne()

    if ($result -eq $null) {
        Write-Host "User not found" -ForegroundColor Yellow
    } else {
        Write-Host "User found!" -ForegroundColor Green
        Write-Host "Display Name: $($result.Properties['displayName'][0])"
        Write-Host "Email: $($result.Properties['mail'][0])"
        Write-Host "Distinguished Name: $($result.Properties['distinguishedName'][0])"
    }

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.Exception.StackTrace)" -ForegroundColor Red
} finally {
    if ($entry) {
        $entry.Dispose()
        Write-Host "`nCleaned up LDAP connection" -ForegroundColor Green
    }
}

Write-Host "`nTest completed" -ForegroundColor Green