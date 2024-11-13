# Add this at the top of your PowerShell script
$WarningPreference = "SilentlyContinue"

param(
    [string]$Username,
    [string]$Domain
)

$domainConfig = if ($Domain -eq "lux") { 
    @{Server = "ldap://luxgroup.net"; BindDN = "CN=C22643,OU=CVG,OU=LUXNAUsers,OU=Retail"; Password = "your_password"}
} else {
    @{Server = "ldap://your.essilor.domain"; BindDN = "CN=someuser,OU=Users,DC=essilor,DC=com"; Password = "your_password"}
}

# Perform AD query logic here using the domainConfig
$user = Get-ADUser -Identity $Username -Server $domainConfig.Server -Properties *
$userInfo = @{
    DisplayName            = $user.DisplayName
    SamAccountName         = $user.SamAccountName
    Name                   = $user.Name
    PasswordExpired        = $user.PasswordExpired
    PasswordLastSet        = $user.PasswordLastSet
    AccountExpirationDate  = $user.AccountExpirationDate
    IsLocked               = $user.LockedOut
    IsDisabled             = $user.Enabled
    UserPrincipalName      = $user.UserPrincipalName
    WhenChanged            = $user.WhenChanged
    WhenCreated            = $user.WhenCreated
    Mail                   = $user.Mail
    Department             = $user.Department
    DistinguishedName      = $user.DistinguishedName
    PasswordExpirationDate = $user.PasswordLastSet
}

return $userInfo
