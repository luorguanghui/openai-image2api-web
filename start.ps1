Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  OpenAI Image2API Web" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 安装根目录依赖..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "安装根目录依赖失败！" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "[2/3] 安装服务端依赖..." -ForegroundColor Yellow
Push-Location server
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "安装服务端依赖失败！" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "[3/3] 安装客户端依赖..." -ForegroundColor Yellow
Push-Location client
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "安装客户端依赖失败！" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "==============================" -ForegroundColor Green
Write-Host "  所有依赖安装完成！" -ForegroundColor Green
Write-Host "  正在启动开发服务器..." -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

npm run dev
