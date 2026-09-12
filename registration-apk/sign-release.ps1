$ErrorActionPreference = 'Stop'

$projectDir = [System.IO.Path]::GetFullPath($PSScriptRoot)
$unsignedApk = [System.IO.Path]::GetFullPath((Join-Path $projectDir 'app\build\outputs\apk\release\app-release-unsigned.apk'))
$alignedApk = [System.IO.Path]::GetFullPath((Join-Path $projectDir 'Cabarian-Registration-v3.0-unsigned-aligned.apk'))
$signedApk = [System.IO.Path]::GetFullPath((Join-Path $projectDir 'INSTALL-THIS-Cabarian-Registration-v3.0.apk'))
$keystore = 'C:\Users\judea\cabarian-registration.keystore'
$keyAlias = 'cabarian-registration'
$buildToolsDir = 'C:\Users\judea\.bubblewrap\android_sdk\build-tools\36.1.0'
$javaHome = 'C:\Users\judea\.bubblewrap\jdk\jdk-17.0.11+9'
$zipAlign = Join-Path $buildToolsDir 'zipalign.exe'
$apkSigner = Join-Path $buildToolsDir 'apksigner.bat'
$aapt = Join-Path $buildToolsDir 'aapt.exe'

foreach ($outputPath in @($alignedApk, $signedApk)) {
    if (-not $outputPath.StartsWith($projectDir + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside the APK project: $outputPath"
    }
}

foreach ($requiredPath in @($unsignedApk, $keystore, $zipAlign, $apkSigner, $aapt, (Join-Path $javaHome 'bin\java.exe'))) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required file was not found: $requiredPath"
    }
}

$storeSecure = Read-Host 'Keystore password' -AsSecureString
$keySecure = Read-Host 'Key password' -AsSecureString
$storePointer = [IntPtr]::Zero
$keyPointer = [IntPtr]::Zero

try {
    $storePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($storeSecure)
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($keySecure)
    $env:CABARIAN_BUILD_STORE_PASS = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($storePointer)
    $env:CABARIAN_BUILD_KEY_PASS = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    $env:JAVA_HOME = $javaHome

    & $zipAlign -f 4 $unsignedApk $alignedApk
    if ($LASTEXITCODE -ne 0) {
        throw "zipalign failed with exit code $LASTEXITCODE."
    }

    & $apkSigner sign `
        --ks $keystore `
        --ks-key-alias $keyAlias `
        --ks-pass 'env:CABARIAN_BUILD_STORE_PASS' `
        --key-pass 'env:CABARIAN_BUILD_KEY_PASS' `
        --v4-signing-enabled true `
        --out $signedApk `
        $alignedApk
    if ($LASTEXITCODE -ne 0) {
        throw "APK signing failed with exit code $LASTEXITCODE."
    }

    & $apkSigner verify --verbose --print-certs $signedApk
    if ($LASTEXITCODE -ne 0) {
        throw "APK signature verification failed with exit code $LASTEXITCODE."
    }

    $badging = (& $aapt dump badging $signedApk) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $badging -notmatch "versionCode='38'") {
        throw 'The signed APK is not the expected Version 3.0 build.'
    }

    $permissions = (& $aapt dump permissions $signedApk) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $permissions -notmatch 'android\.permission\.CAMERA') {
        throw 'The signed APK does not contain android.permission.CAMERA.'
    }

    Write-Host ''
    Write-Host "Signed APK ready: $signedApk" -ForegroundColor Green
} finally {
    Remove-Item Env:CABARIAN_BUILD_STORE_PASS -ErrorAction SilentlyContinue
    Remove-Item Env:CABARIAN_BUILD_KEY_PASS -ErrorAction SilentlyContinue

    if ($storePointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($storePointer)
    }
    if ($keyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
}
