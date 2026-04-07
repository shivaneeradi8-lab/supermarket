##############################################################
#  GreenCart — Post-Deploy Smoke Test
#  Usage:
#    .\scripts\post-deploy-validate.ps1 -Domain https://your-domain.vercel.app
#    .\scripts\post-deploy-validate.ps1 -Domain https://your-domain.vercel.app -CronSecret "your_secret"
#    .\scripts\post-deploy-validate.ps1 -Domain https://your-domain.vercel.app -AdminEmail admin@example.com -AdminPassword secret
##############################################################

param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    [string]$AdminEmail    = "",
    [string]$AdminPassword = "",
    [string]$CronSecret    = "",
    [switch]$Verbose
)

$Domain = $Domain.TrimEnd('/')

# ---------- helpers ----------

$PASS = 0
$FAIL = 0
$SKIP = 0
$ERRORS = [System.Collections.Generic.List[string]]::new()

function Write-Pass($msg) {
    $script:PASS++
    Write-Host "  PASS  $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    $script:FAIL++
    $script:ERRORS.Add($msg)
    Write-Host "  FAIL  $msg" -ForegroundColor Red
}

function Write-Skip($msg) {
    $script:SKIP++
    Write-Host "  SKIP  $msg" -ForegroundColor DarkYellow
}

function Write-Section($title) {
    Write-Host ""
    Write-Host "── $title ──" -ForegroundColor Cyan
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [hashtable]$Body   = $null,
        [string]$Token     = "",
        [string]$Secret    = "",
        [int]$ExpectStatus = 200,
        [switch]$Silent
    )

    $url = "$Domain$Path"
    $headers = @{ "Content-Type" = "application/json" }

    if ($Token)  { $headers["Authorization"] = "Bearer $Token" }
    if ($Secret) { $headers["Authorization"] = "Bearer $Secret" }

    try {
        $params = @{
            Uri             = $url
            Method          = $Method
            Headers         = $headers
            UseBasicParsing = $true
            ErrorAction     = "Stop"
        }
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }

        $response = Invoke-WebRequest @params
        $json     = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue

        if ($Verbose -and -not $Silent) {
            Write-Host "    → $Method $Path  [$($response.StatusCode)]" -ForegroundColor DarkGray
        }

        return [PSCustomObject]@{
            Status  = [int]$response.StatusCode
            Json    = $json
            Ok      = ([int]$response.StatusCode -eq $ExpectStatus)
            Raw     = $response.Content
        }
    }
    catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }

        if ($Verbose -and -not $Silent) {
            Write-Host "    → $Method $Path  [$status]  $($_.Exception.Message)" -ForegroundColor DarkGray
        }

        $jsonBody = $null
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $jsonBody = $reader.ReadToEnd() | ConvertFrom-Json -ErrorAction SilentlyContinue
        } catch {}

        return [PSCustomObject]@{
            Status  = $status
            Json    = $jsonBody
            Ok      = ($status -eq $ExpectStatus)
            Raw     = $null
        }
    }
}

# ---------- unique test email ----------
$stamp     = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "smoketest+$stamp@example-greencart.com"
$testPass  = "SmokeTest!$stamp"
$testName  = "Smoke Tester"
$userToken = ""

# ============================================================

Write-Host ""
Write-Host "GreenCart Post-Deploy Validation" -ForegroundColor White
Write-Host "Target: $Domain" -ForegroundColor DarkGray
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC" -ForegroundColor DarkGray

# ── 1. Connectivity ──

Write-Section "1. Basic Connectivity"

$r = Invoke-Api -Path "/" -Silent
if ($r.Status -ge 200 -and $r.Status -lt 400) {
    Write-Pass "GET /  returns $($r.Status)"
} else {
    Write-Fail "GET /  returned $($r.Status) — site may be down"
}

$r = Invoke-Api -Path "/api/products" -Silent
if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
    Write-Pass "GET /api/products  returns 200 + success:true"
} else {
    Write-Fail "GET /api/products  returned $($r.Status) — expected 200 success:true"
}

# ── 2. Auth — Register ──

Write-Section "2. Auth — Register"

$r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{
    name     = $testName
    email    = $testEmail
    password = $testPass
} -ExpectStatus 201

if ($r.Status -eq 201 -and $r.Json.success -eq $true -and $r.Json.data.token) {
    Write-Pass "POST /api/auth/register  creates user and returns JWT"
    $userToken = $r.Json.data.token
} elseif ($r.Status -eq 400 -and $r.Json.message -match "already exists") {
    Write-Pass "POST /api/auth/register  user already exists (idempotent)"
} else {
    Write-Fail "POST /api/auth/register  returned $($r.Status): $($r.Json.message)"
}

# ── 3. Auth — Login ──

Write-Section "3. Auth — Login"

$r = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{
    email    = $testEmail
    password = $testPass
} -ExpectStatus 200

if ($r.Status -eq 200 -and $r.Json.success -eq $true -and $r.Json.data.token) {
    Write-Pass "POST /api/auth/login  returns 200 + JWT"
    $userToken = $r.Json.data.token   # refresh with fresh token
} else {
    Write-Fail "POST /api/auth/login  returned $($r.Status): $($r.Json.message)"
}

$r = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{
    email    = $testEmail
    password = "WrongPassword999!"
} -ExpectStatus 401

if ($r.Status -eq 401) {
    Write-Pass "POST /api/auth/login  rejects wrong password with 401"
} else {
    Write-Fail "POST /api/auth/login  should return 401 for wrong password, got $($r.Status)"
}

# ── 4. Protected endpoints — no token ──

Write-Section "4. Auth Guard (no token)"

foreach ($ep in @(
    @{ Method = "GET";  Path = "/api/orders" }
    @{ Method = "GET";  Path = "/api/users/profile" }
)) {
    $r = Invoke-Api -Method $ep.Method -Path $ep.Path -ExpectStatus 401 -Silent
    if ($r.Status -eq 401) {
        Write-Pass "$($ep.Method) $($ep.Path)  denies unauthenticated (401)"
    } else {
        Write-Fail "$($ep.Method) $($ep.Path)  should return 401 without token, got $($r.Status)"
    }
}

# ── 5. User profile ──

Write-Section "5. User Profile"

if ($userToken) {
    $r = Invoke-Api -Path "/api/users/profile" -Token $userToken -ExpectStatus 200
    if ($r.Status -eq 200 -and $r.Json.success -eq $true -and $r.Json.data.email) {
        Write-Pass "GET /api/users/profile  returns user data"
    } else {
        Write-Fail "GET /api/users/profile  returned $($r.Status): $($r.Json.message)"
    }

    $r = Invoke-Api -Method PUT -Path "/api/users/profile" -Token $userToken -Body @{
        name  = "Smoke Tester Updated"
        phone = "+919876543210"
    } -ExpectStatus 200

    if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
        Write-Pass "PUT /api/users/profile  updates name + phone"
    } else {
        Write-Fail "PUT /api/users/profile  returned $($r.Status): $($r.Json.message)"
    }
} else {
    Write-Skip "User profile tests skipped — no token"
}

# ── 6. Products ──

Write-Section "6. Products"

$r = Invoke-Api -Path "/api/products?limit=5&page=1"
if ($r.Status -eq 200 -and $r.Json.success -eq $true -and $null -ne $r.Json.data) {
    $count = @($r.Json.data).Count
    Write-Pass "GET /api/products?limit=5  returns $count product(s)"
} else {
    Write-Fail "GET /api/products?limit=5  returned $($r.Status)"
}

$r = Invoke-Api -Path "/api/products?category=Fruits&limit=3"
if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
    Write-Pass "GET /api/products?category=Fruits  filters by category"
} else {
    Write-Fail "GET /api/products?category=Fruits  returned $($r.Status)"
}

# ── 7. Reviews ──

Write-Section "7. Reviews"

$r = Invoke-Api -Path "/api/reviews?productId=000000000000000000000001" -ExpectStatus 200 -Silent
if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
    Write-Pass "GET /api/reviews?productId=...  returns 200 (empty or not)"
} elseif ($r.Status -eq 400 -and $r.Json.message -match "Invalid") {
    Write-Pass "GET /api/reviews  validates productId format"
} else {
    Write-Fail "GET /api/reviews  returned $($r.Status): $($r.Json.message)"
}

# ── 8. Orders ──

Write-Section "8. Orders"

if ($userToken) {
    $r = Invoke-Api -Path "/api/orders" -Token $userToken -ExpectStatus 200
    if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
        $orderCount = @($r.Json.data).Count
        Write-Pass "GET /api/orders  returns $orderCount order(s) for test user"
    } else {
        Write-Fail "GET /api/orders  returned $($r.Status): $($r.Json.message)"
    }

    # Validation: empty body should 400
    $r = Invoke-Api -Method POST -Path "/api/orders" -Token $userToken -Body @{} -ExpectStatus 400 -Silent
    if ($r.Status -eq 400) {
        Write-Pass "POST /api/orders  rejects empty body with 400"
    } else {
        Write-Fail "POST /api/orders  should return 400 for empty body, got $($r.Status)"
    }
} else {
    Write-Skip "Order tests skipped — no token"
}

# ── 9. Newsletter ──

Write-Section "9. Newsletter"

$r = Invoke-Api -Method POST -Path "/api/newsletter" -Body @{ email = "smoke$stamp@test.com" } -ExpectStatus 201
if ($r.Status -eq 201 -and $r.Json.success -eq $true) {
    Write-Pass "POST /api/newsletter  subscribes new email (201)"
} elseif ($r.Status -eq 200 -and $r.Json.success -eq $true) {
    Write-Pass "POST /api/newsletter  already subscribed (200)"
} else {
    Write-Fail "POST /api/newsletter  returned $($r.Status): $($r.Json.message)"
}

$r = Invoke-Api -Method POST -Path "/api/newsletter" -Body @{ email = "not-an-email" } -ExpectStatus 400 -Silent
if ($r.Status -eq 400) {
    Write-Pass "POST /api/newsletter  rejects invalid email with 400"
} else {
    Write-Fail "POST /api/newsletter  should return 400 for bad email, got $($r.Status)"
}

# ── 10. Rate limiting ──

Write-Section "10. Rate Limiting"

$rl = $false
# Fire 7 rapid login attempts with a bad password — login limit is 5/15min
for ($i = 0; $i -lt 7; $i++) {
    $r = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{
        email    = "ratetest$stamp@example.com"
        password = "wrong"
    } -Silent
    if ($r.Status -eq 429) { $rl = $true; break }
}
if ($rl) {
    Write-Pass "Rate limiter triggers 429 after rapid repeated login attempts"
} else {
    Write-Fail "Rate limiter did NOT return 429 after 7 rapid login attempts"
}

# ── 11. Maintenance cron ──

Write-Section "11. Maintenance Cron"

if ($CronSecret) {
    $r = Invoke-Api -Path "/api/maintenance/expire-pending-orders" -Secret $CronSecret -ExpectStatus 200
    if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
        $swept = $r.Json.data.expiredCount
        Write-Pass "GET /api/maintenance/expire-pending-orders  swept $swept expired order(s)"
    } else {
        Write-Fail "GET /api/maintenance/expire-pending-orders  returned $($r.Status): $($r.Json.message)"
    }

    $r = Invoke-Api -Path "/api/maintenance/expire-pending-orders" -ExpectStatus 401 -Silent
    if ($r.Status -eq 401) {
        Write-Pass "GET /api/maintenance/expire-pending-orders  rejects missing secret (401)"
    } else {
        Write-Fail "GET /api/maintenance/expire-pending-orders  should reject no-token, got $($r.Status)"
    }
} else {
    Write-Skip "Cron tests skipped — pass -CronSecret to enable"
}

# ── 12. Admin endpoints ──

Write-Section "12. Admin Endpoints"

$adminToken = ""
if ($AdminEmail -and $AdminPassword) {
    $r = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{
        email    = $AdminEmail
        password = $AdminPassword
    } -ExpectStatus 200 -Silent

    if ($r.Status -eq 200 -and $r.Json.data.token) {
        $adminToken = $r.Json.data.token
        Write-Pass "Admin login successful"
    } else {
        Write-Fail "Admin login failed ($($r.Status)): $($r.Json.message)"
    }
} else {
    Write-Skip "Admin tests skipped — pass -AdminEmail / -AdminPassword to enable"
}

if ($adminToken) {
    $r = Invoke-Api -Path "/api/admin/payments/failures?minutes=60&limit=10" -Token $adminToken -ExpectStatus 200
    if ($r.Status -eq 200 -and $r.Json.success -eq $true) {
        $total = $r.Json.data.summary.totalFailures
        Write-Pass "GET /api/admin/payments/failures  returns monitoring data (totalFailures=$total)"
    } else {
        Write-Fail "GET /api/admin/payments/failures  returned $($r.Status): $($r.Json.message)"
    }

    # Non-admin user should be denied
    if ($userToken) {
        $r = Invoke-Api -Path "/api/admin/payments/failures" -Token $userToken -ExpectStatus 403 -Silent
        if ($r.Status -eq 403) {
            Write-Pass "GET /api/admin/payments/failures  denies non-admin (403)"
        } else {
            Write-Fail "GET /api/admin/payments/failures  should return 403 for non-admin, got $($r.Status)"
        }
    }
}

# ── 13. Security: 404 / method not allowed ──

Write-Section "13. Security Hardening"

$r = Invoke-Api -Path "/api/nonexistent-endpoint-xyz" -ExpectStatus 404 -Silent
if ($r.Status -eq 404) {
    Write-Pass "GET /api/nonexistent  returns 404"
} else {
    Write-Fail "GET /api/nonexistent  returned $($r.Status) — expected 404"
}

# Stripe webhook must reject requests without a stripe-signature header
$r = Invoke-Api -Method POST -Path "/api/payments/webhook" -Body @{ test = 1 } -ExpectStatus 400 -Silent
if ($r.Status -eq 400) {
    Write-Pass "POST /api/payments/webhook  rejects missing stripe-signature (400)"
} else {
    Write-Fail "POST /api/payments/webhook  should return 400 without signature, got $($r.Status)"
}

# ── Summary ──

Write-Host ""
Write-Host "────────────────────────────────────────" -ForegroundColor White
$total = $PASS + $FAIL + $SKIP
Write-Host "Results: $total checks — " -NoNewline -ForegroundColor White
Write-Host "$PASS passed" -NoNewline -ForegroundColor Green
Write-Host ", " -NoNewline
Write-Host "$FAIL failed" -NoNewline -ForegroundColor $(if ($FAIL -gt 0) { "Red" } else { "Green" })
Write-Host ", " -NoNewline
Write-Host "$SKIP skipped" -ForegroundColor DarkYellow

if ($ERRORS.Count -gt 0) {
    Write-Host ""
    Write-Host "Failures:" -ForegroundColor Red
    foreach ($e in $ERRORS) {
        Write-Host "  • $e" -ForegroundColor Red
    }
}

Write-Host ""

if ($FAIL -eq 0) {
    Write-Host "All checks passed. GreenCart is live and healthy." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$FAIL check(s) failed. Review the failures above before going fully live." -ForegroundColor Red
    exit 1
}
