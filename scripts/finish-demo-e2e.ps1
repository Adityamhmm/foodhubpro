[CmdletBinding()]
param(
    [string]$OrderId = 'c0b839ee-339c-45e5-bd81-0504fcfc1e88',
    [int]$TableNumber = 9001
)

$ErrorActionPreference = 'Stop'
$apiBase = 'http://localhost:8080/api'
$orderNote = 'E2E demo order 2026-10-14'

function Invoke-FoodHubRequest {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$Method,
        [string]$Path,
        [string]$Body,
        [string]$CsrfToken
    )

    $method = $Method.ToUpperInvariant()
    $request = @{
        Uri = "$apiBase$Path"
        Method = $method
        WebSession = $Session
        UseBasicParsing = $true
        TimeoutSec = 20
    }
    if ($method -in @('POST', 'PUT', 'PATCH') -and -not [string]::IsNullOrWhiteSpace($Body)) {
        $request.ContentType = 'application/json'
        $request.Body = $Body
    }
    if ($CsrfToken) {
        $request.Headers = @{ 'X-XSRF-TOKEN' = $CsrfToken }
    }

    try {
        $response = Invoke-WebRequest @request
        $status = [int]$response.StatusCode
        $content = $response.Content
    } catch {
        if (-not $_.Exception.Response) { throw }
        $response = $_.Exception.Response
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Dispose()
    }

    $data = $null
    if ($content) {
        try { $data = $content | ConvertFrom-Json } catch { }
    }
    [pscustomobject]@{ StatusCode = $status; Data = $data; Content = $content }
}

function Assert-Status {
    param($Response, [int]$Expected, [string]$Action)
    if ($Response.StatusCode -ne $Expected) {
        throw "$Action returned HTTP $($Response.StatusCode); expected $Expected. Response: $($Response.Content)"
    }
}

$anonymous = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$meAnonymous = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path '/auth/me'
$billsAnonymous = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path '/bills'
if ($meAnonymous.StatusCode -notin @(401, 403) -or $billsAnonymous.StatusCode -notin @(401, 403)) {
    throw 'Anonymous access to an authentication or admin endpoint was not denied as expected.'
}
Write-Host 'PASS: anonymous auth and admin bill endpoints are protected.'

$tableOrdersResponse = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path "/tables/$TableNumber/orders"
Assert-Status $tableOrdersResponse 200 'Read demo table orders'
$tableOrders = @($tableOrdersResponse.Data)
if ($tableOrders.Count -ne 1 -or $tableOrders[0].id -ne $OrderId) {
    throw 'Demo table no longer contains exactly the E2E order; no status or billing changes were made.'
}
$order = $tableOrders[0]
if ($order.table -ne $TableNumber -or $order.items.Count -ne 1 -or $order.items[0].chefNote -ne $orderNote) {
    throw 'The demo order does not match the expected test marker and single-line order.'
}
if ($order.items[0].menuItemId -ne '30000000-0000-4000-8000-000000000001' -or
    $order.items[0].quantity -ne 1 -or $order.items[0].price -ne 240.00) {
    throw 'The demo order item does not match the expected focaccia line.'
}
if ($order.status -ne 'Pending') {
    throw "The order is already in status '$($order.status)'. This script only proceeds from Pending to avoid duplicate billing."
}
Write-Host 'PASS: demo order and order item read back with the expected table, marker, quantity, and price.'

$taxResponse = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path '/tax-rules'
Assert-Status $taxResponse 200 'Read tax rules'
$activeTaxes = @($taxResponse.Data | Where-Object { $_.active })
if ($activeTaxes.Count -eq 0) { throw 'No active tax rule is configured.' }

$username = Read-Host 'Admin username [admin]'
if ([string]::IsNullOrWhiteSpace($username)) { $username = 'admin' }
$securePassword = Read-Host 'Admin password (masked)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrfResponse = Invoke-FoodHubRequest -Session $adminSession -Method GET -Path '/auth/csrf'
Assert-Status $csrfResponse 200 'Load CSRF token'
$csrfToken = $csrfResponse.Data.token
if ([string]::IsNullOrWhiteSpace($csrfToken)) { throw 'The CSRF token was empty.' }
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json -Compress
$password = $null
$securePassword.Dispose()
$loginResponse = Invoke-FoodHubRequest -Session $adminSession -Method POST -Path '/auth/login' -Body $loginBody -CsrfToken $csrfToken
$loginBody = $null
Assert-Status $loginResponse 200 'Admin login'
if ($loginResponse.Data.role -ne 'ADMIN') { throw 'The supplied account is not an ADMIN account; no order status or billing changes were made.' }
Write-Host 'PASS: admin login succeeded.'

$csrfRefresh = Invoke-FoodHubRequest -Session $adminSession -Method GET -Path '/auth/csrf'
Assert-Status $csrfRefresh 200 'Refresh CSRF token after login'
$csrfToken = $csrfRefresh.Data.token

$meResponse = Invoke-FoodHubRequest -Session $adminSession -Method GET -Path '/auth/me'
Assert-Status $meResponse 200 'Read authenticated user'
if ($meResponse.Data.role -ne 'ADMIN') { throw 'Authenticated role did not resolve to ADMIN.' }
$protectedResponse = Invoke-FoodHubRequest -Session $adminSession -Method GET -Path '/bills'
Assert-Status $protectedResponse 200 'Read protected admin bills'
Write-Host 'PASS: authenticated identity and protected admin endpoint succeeded.'

$kitchenOrdersResponse = Invoke-FoodHubRequest -Session $adminSession -Method GET -Path '/orders'
Assert-Status $kitchenOrdersResponse 200 'Read kitchen order queue'
$kitchenOrders = @($kitchenOrdersResponse.Data | Where-Object { $_.id -eq $OrderId })
if ($kitchenOrders.Count -ne 1 -or $kitchenOrders[0].status -ne 'Pending') {
    throw 'The kitchen order queue did not return the test order as Pending.'
}
Write-Host 'PASS: staff order queue returned the demo order as Pending.'

$statusBody = @{ status = 'Accepted' } | ConvertTo-Json -Compress
$acceptedResponse = Invoke-FoodHubRequest -Session $adminSession -Method PATCH -Path "/orders/$OrderId/status" -Body $statusBody -CsrfToken $csrfToken
Assert-Status $acceptedResponse 200 'Accept kitchen order'
$customerOrdersResponse = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path "/tables/$TableNumber/orders"
Assert-Status $customerOrdersResponse 200 'Read customer order status after acceptance'
if (@($customerOrdersResponse.Data)[0].status -ne 'Accepted') { throw 'Customer order status did not update to Accepted.' }
Write-Host 'PASS: order accepted and customer status readback updated.'

$statusBody = @{ status = 'Completed' } | ConvertTo-Json -Compress
$completedResponse = Invoke-FoodHubRequest -Session $adminSession -Method PATCH -Path "/orders/$OrderId/status" -Body $statusBody -CsrfToken $csrfToken
Assert-Status $completedResponse 200 'Complete kitchen order'
$customerOrdersResponse = Invoke-FoodHubRequest -Session $anonymous -Method GET -Path "/tables/$TableNumber/orders"
Assert-Status $customerOrdersResponse 200 'Read customer order status after completion'
if (@($customerOrdersResponse.Data)[0].status -ne 'Completed') { throw 'Customer order status did not update to Completed.' }
Write-Host 'PASS: order completed and customer status readback updated.'

$completedOrder = @($customerOrdersResponse.Data)[0]
$expectedSubtotal = [decimal]0
foreach ($line in $completedOrder.items) {
    $expectedSubtotal += [decimal]$line.price * [decimal]$line.quantity
}
$expectedTax = [decimal]0
foreach ($tax in $activeTaxes) {
    $expectedTax += [decimal]::Round($expectedSubtotal * [decimal]$tax.percent / [decimal]100, 2, [MidpointRounding]::AwayFromZero)
}
$expectedGrandTotal = $expectedSubtotal + $expectedTax

$billResponse = Invoke-FoodHubRequest -Session $adminSession -Method POST -Path "/bills?table=$TableNumber" -CsrfToken $csrfToken
Assert-Status $billResponse 201 'Generate demo bill'
$bill = $billResponse.Data
if ([decimal]$bill.subtotal -ne $expectedSubtotal -or
    [decimal]$bill.taxTotal -ne $expectedTax -or
    [decimal]$bill.grandTotal -ne $expectedGrandTotal) {
    throw "Bill totals differ from the active tax calculation. Expected $expectedSubtotal + $expectedTax = $expectedGrandTotal."
}
if ($bill.items.Count -ne 1 -or $bill.items[0].name -ne 'Demo herb focaccia' -or $bill.taxLines.Count -ne $activeTaxes.Count) {
    throw 'Bill line or tax line details did not match the test order and active tax rules.'
}
Write-Host ("PASS: bill totals verified (subtotal {0:N2}, tax {1:N2}, grand total {2:N2})." -f $expectedSubtotal, $expectedTax, $expectedGrandTotal)

$paymentBody = @{ method = 'Cash' } | ConvertTo-Json -Compress
$paymentResponse = Invoke-FoodHubRequest -Session $adminSession -Method PATCH -Path "/bills/$($bill.id)/payment" -Body $paymentBody -CsrfToken $csrfToken
Assert-Status $paymentResponse 200 'Record demo payment'
if ($paymentResponse.Data.paymentMethod -ne 'Cash' -or -not $paymentResponse.Data.paidAt) {
    throw 'Payment response did not show Cash and a paid timestamp.'
}
Write-Host 'PASS: demo payment recorded as Cash.'
Write-Host "Test order: $OrderId"
Write-Host "Test bill: $($bill.id)"
