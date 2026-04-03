@echo off
REM OpenAgent Framework - Deployment Validation Script (Windows)
REM This script validates the deployment configuration

echo ========================================
echo OpenAgent Framework - Deployment Validation
echo ========================================
echo.

REM Colors are not supported in Windows CMD, using simple text
set TOTAL_CHECKS=0
set PASSED_CHECKS=0
set FAILED_CHECKS=0

REM Function to check file exists
goto :main

:check_file
set file=%~1
set description=%~2
set /a TOTAL_CHECKS+=1

if exist "%file%" (
    echo [OK] %description%
    set /a PASSED_CHECKS+=1
) else (
    echo [FAIL] %description% - File not found: %file%
    set /a FAILED_CHECKS+=1
)
goto :eof

:check_directory
set dir=%~1
set description=%~2
set /a TOTAL_CHECKS+=1

if exist "%dir%\*" (
    echo [OK] %description%
    set /a PASSED_CHECKS+=1
) else (
    echo [FAIL] %description% - Directory not found: %dir%
    set /a FAILED_CHECKS+=1
)
goto :eof

:main
echo Checking Directory Structure...
echo.

REM Check main directories
call :check_directory "deploy" "Deploy directory"
call :check_directory "deploy\kubernetes" "Kubernetes deployment directory"
call :check_directory "deploy\kubernetes\helm" "Helm charts directory"
call :check_directory "deploy\kubernetes\helm\templates" "Helm templates directory"
call :check_directory "deploy\kubernetes\manifests" "Kubernetes manifests directory"
call :check_directory "deploy\aws" "AWS deployment directory"
call :check_directory "deploy\azure" "Azure deployment directory"
call :check_directory "deploy\gcp" "GCP deployment directory"
call :check_directory "deploy\serverless" "Serverless deployment directory"
call :check_directory "deploy\serverless\aws-lambda" "AWS Lambda directory"
call :check_directory "deploy\serverless\vercel" "Vercel directory"
call :check_directory "deploy\serverless\vercel\api" "Vercel API directory"
call :check_directory "deploy\serverless\cloudflare" "Cloudflare Workers directory"
call :check_directory ".github" "GitHub directory"
call :check_directory ".github\workflows" "GitHub workflows directory"

echo.
echo Checking Kubernetes Configuration...
echo.

REM Kubernetes - Helm
call :check_file "deploy\kubernetes\helm\Chart.yaml" "Helm Chart.yaml"
call :check_file "deploy\kubernetes\helm\values.yaml" "Helm values.yaml"
call :check_file "deploy\kubernetes\helm\templates\_helpers.tpl" "Helm helpers template"
call :check_file "deploy\kubernetes\helm\templates\deployment.yaml" "Helm deployment template"
call :check_file "deploy\kubernetes\helm\templates\service.yaml" "Helm service template"
call :check_file "deploy\kubernetes\helm\templates\ingress.yaml" "Helm ingress template"
call :check_file "deploy\kubernetes\helm\templates\configmap.yaml" "Helm configmap template"
call :check_file "deploy\kubernetes\helm\templates\secret.yaml" "Helm secret template"
call :check_file "deploy\kubernetes\helm\templates\hpa.yaml" "Helm HPA template"

REM Kubernetes - Manifests
call :check_file "deploy\kubernetes\manifests\namespace.yaml" "Kubernetes namespace"
call :check_file "deploy\kubernetes\manifests\deployment.yaml" "Kubernetes deployment"
call :check_file "deploy\kubernetes\manifests\service.yaml" "Kubernetes service"
call :check_file "deploy\kubernetes\manifests\ingress.yaml" "Kubernetes ingress"
call :check_file "deploy\kubernetes\manifests\configmap.yaml" "Kubernetes configmap"
call :check_file "deploy\kubernetes\manifests\secret.yaml" "Kubernetes secret"
call :check_file "deploy\kubernetes\manifests\hpa.yaml" "Kubernetes HPA"
call :check_file "deploy\kubernetes\manifests\postgres.yaml" "PostgreSQL deployment"
call :check_file "deploy\kubernetes\manifests\redis.yaml" "Redis deployment"

echo.
echo Checking Cloud Platform Configuration...
echo.

REM AWS
call :check_file "deploy\aws\ecs-task-definition.json" "AWS ECS task definition"
call :check_file "deploy\aws\cloudformation.yaml" "AWS CloudFormation template"
call :check_file "deploy\aws\main.tf" "AWS Terraform main"
call :check_file "deploy\aws\variables.tf" "AWS Terraform variables"
call :check_file "deploy\aws\outputs.tf" "AWS Terraform outputs"

REM Azure
call :check_file "deploy\azure\container-app.yaml" "Azure Container App config"
call :check_file "deploy\azure\arm-template.json" "Azure ARM template"
call :check_file "deploy\azure\main.tf" "Azure Terraform main"
call :check_file "deploy\azure\variables.tf" "Azure Terraform variables"
call :check_file "deploy\azure\outputs.tf" "Azure Terraform outputs"

REM GCP
call :check_file "deploy\gcp\cloud-run.yaml" "GCP Cloud Run config"
call :check_file "deploy\gcp\main.tf" "GCP Terraform main"
call :check_file "deploy\gcp\variables.tf" "GCP Terraform variables"
call :check_file "deploy\gcp\outputs.tf" "GCP Terraform outputs"

echo.
echo Checking Docker Configuration...
echo.

call :check_file "Dockerfile" "Production Dockerfile"
call :check_file "Dockerfile.dev" "Development Dockerfile"
call :check_file "docker-compose.yml" "Production Docker Compose"
call :check_file "docker-compose.dev.yml" "Development Docker Compose"
call :check_file ".dockerignore" "Docker ignore file"
call :check_file "prometheus.yml" "Prometheus configuration"

echo.
echo Checking Serverless Configuration...
echo.

REM AWS Lambda
call :check_file "deploy\serverless\aws-lambda\handler.ts" "Lambda handler"
call :check_file "deploy\serverless\aws-lambda\serverless.yml" "Serverless Framework config"
call :check_file "deploy\serverless\aws-lambda\package.json" "Lambda package.json"

REM Vercel
call :check_file "deploy\serverless\vercel\api\index.ts" "Vercel handler"
call :check_file "deploy\serverless\vercel\vercel.json" "Vercel configuration"
call :check_file "deploy\serverless\vercel\package.json" "Vercel package.json"

REM Cloudflare Workers
call :check_file "deploy\serverless\cloudflare\worker.ts" "Cloudflare Worker handler"
call :check_file "deploy\serverless\cloudflare\wrangler.toml" "Wrangler configuration"
call :check_file "deploy\serverless\cloudflare\package.json" "Workers package.json"

echo.
echo Checking CI/CD Configuration...
echo.

call :check_file ".github\workflows\ci.yml" "GitHub Actions CI workflow"
call :check_file ".github\workflows\deploy.yml" "GitHub Actions deploy workflow"
call :check_file ".github\workflows\release.yml" "GitHub Actions release workflow"
call :check_file ".gitlab-ci.yml" "GitLab CI configuration"

echo.
echo Checking Documentation...
echo.

call :check_file "deploy\DEPLOYMENT.md" "Deployment guide"
call :check_file "deploy\DEPLOYMENT-SUMMARY.md" "Deployment summary"
call :check_file "Makefile" "Makefile for deployment commands"

echo.
echo ========================================
echo Validation Summary
echo ========================================
echo.
echo Total Checks: %TOTAL_CHECKS%
echo Passed: %PASSED_CHECKS%
echo Failed: %FAILED_CHECKS%
echo.

if %FAILED_CHECKS% equ 0 (
    echo [SUCCESS] All deployment configurations are valid!
    exit /b 0
) else (
    echo [ERROR] Some deployment configurations are missing!
    exit /b 1
)
