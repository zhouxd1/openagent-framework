#!/bin/bash

# OpenAgent Framework - Deployment Validation Script
# This script validates the deployment configuration

set -e

echo "🔍 OpenAgent Framework - Deployment Validation"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $description - File not found: $file"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# Function to check directory exists
check_directory() {
    local dir=$1
    local description=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $description - Directory not found: $dir"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

echo "📁 Checking Directory Structure..."
echo ""

# Check main directories
check_directory "deploy" "Deploy directory"
check_directory "deploy/kubernetes" "Kubernetes deployment directory"
check_directory "deploy/kubernetes/helm" "Helm charts directory"
check_directory "deploy/kubernetes/helm/templates" "Helm templates directory"
check_directory "deploy/kubernetes/manifests" "Kubernetes manifests directory"
check_directory "deploy/aws" "AWS deployment directory"
check_directory "deploy/azure" "Azure deployment directory"
check_directory "deploy/gcp" "GCP deployment directory"
check_directory "deploy/serverless" "Serverless deployment directory"
check_directory "deploy/serverless/aws-lambda" "AWS Lambda directory"
check_directory "deploy/serverless/vercel" "Vercel directory"
check_directory "deploy/serverless/vercel/api" "Vercel API directory"
check_directory "deploy/serverless/cloudflare" "Cloudflare Workers directory"
check_directory ".github" "GitHub directory"
check_directory ".github/workflows" "GitHub workflows directory"

echo ""
echo "📄 Checking Kubernetes Configuration..."
echo ""

# Kubernetes - Helm
check_file "deploy/kubernetes/helm/Chart.yaml" "Helm Chart.yaml"
check_file "deploy/kubernetes/helm/values.yaml" "Helm values.yaml"
check_file "deploy/kubernetes/helm/templates/_helpers.tpl" "Helm helpers template"
check_file "deploy/kubernetes/helm/templates/deployment.yaml" "Helm deployment template"
check_file "deploy/kubernetes/helm/templates/service.yaml" "Helm service template"
check_file "deploy/kubernetes/helm/templates/ingress.yaml" "Helm ingress template"
check_file "deploy/kubernetes/helm/templates/configmap.yaml" "Helm configmap template"
check_file "deploy/kubernetes/helm/templates/secret.yaml" "Helm secret template"
check_file "deploy/kubernetes/helm/templates/hpa.yaml" "Helm HPA template"

# Kubernetes - Manifests
check_file "deploy/kubernetes/manifests/namespace.yaml" "Kubernetes namespace"
check_file "deploy/kubernetes/manifests/deployment.yaml" "Kubernetes deployment"
check_file "deploy/kubernetes/manifests/service.yaml" "Kubernetes service"
check_file "deploy/kubernetes/manifests/ingress.yaml" "Kubernetes ingress"
check_file "deploy/kubernetes/manifests/configmap.yaml" "Kubernetes configmap"
check_file "deploy/kubernetes/manifests/secret.yaml" "Kubernetes secret"
check_file "deploy/kubernetes/manifests/hpa.yaml" "Kubernetes HPA"
check_file "deploy/kubernetes/manifests/postgres.yaml" "PostgreSQL deployment"
check_file "deploy/kubernetes/manifests/redis.yaml" "Redis deployment"

echo ""
echo "☁️  Checking Cloud Platform Configuration..."
echo ""

# AWS
check_file "deploy/aws/ecs-task-definition.json" "AWS ECS task definition"
check_file "deploy/aws/cloudformation.yaml" "AWS CloudFormation template"
check_file "deploy/aws/main.tf" "AWS Terraform main"
check_file "deploy/aws/variables.tf" "AWS Terraform variables"
check_file "deploy/aws/outputs.tf" "AWS Terraform outputs"

# Azure
check_file "deploy/azure/container-app.yaml" "Azure Container App config"
check_file "deploy/azure/arm-template.json" "Azure ARM template"
check_file "deploy/azure/main.tf" "Azure Terraform main"
check_file "deploy/azure/variables.tf" "Azure Terraform variables"
check_file "deploy/azure/outputs.tf" "Azure Terraform outputs"

# GCP
check_file "deploy/gcp/cloud-run.yaml" "GCP Cloud Run config"
check_file "deploy/gcp/main.tf" "GCP Terraform main"
check_file "deploy/gcp/variables.tf" "GCP Terraform variables"
check_file "deploy/gcp/outputs.tf" "GCP Terraform outputs"

echo ""
echo "🚀 Checking Docker Configuration..."
echo ""

check_file "Dockerfile" "Production Dockerfile"
check_file "Dockerfile.dev" "Development Dockerfile"
check_file "docker-compose.yml" "Production Docker Compose"
check_file "docker-compose.dev.yml" "Development Docker Compose"
check_file ".dockerignore" "Docker ignore file"
check_file "prometheus.yml" "Prometheus configuration"

echo ""
echo "⚡ Checking Serverless Configuration..."
echo ""

# AWS Lambda
check_file "deploy/serverless/aws-lambda/handler.ts" "Lambda handler"
check_file "deploy/serverless/aws-lambda/serverless.yml" "Serverless Framework config"
check_file "deploy/serverless/aws-lambda/package.json" "Lambda package.json"

# Vercel
check_file "deploy/serverless/vercel/api/index.ts" "Vercel handler"
check_file "deploy/serverless/vercel/vercel.json" "Vercel configuration"
check_file "deploy/serverless/vercel/package.json" "Vercel package.json"

# Cloudflare Workers
check_file "deploy/serverless/cloudflare/worker.ts" "Cloudflare Worker handler"
check_file "deploy/serverless/cloudflare/wrangler.toml" "Wrangler configuration"
check_file "deploy/serverless/cloudflare/package.json" "Workers package.json"

echo ""
echo "🔄 Checking CI/CD Configuration..."
echo ""

check_file ".github/workflows/ci.yml" "GitHub Actions CI workflow"
check_file ".github/workflows/deploy.yml" "GitHub Actions deploy workflow"
check_file ".github/workflows/release.yml" "GitHub Actions release workflow"
check_file ".gitlab-ci.yml" "GitLab CI configuration"

echo ""
echo "📚 Checking Documentation..."
echo ""

check_file "deploy/DEPLOYMENT.md" "Deployment guide"
check_file "deploy/DEPLOYMENT-SUMMARY.md" "Deployment summary"
check_file "Makefile" "Makefile for deployment commands"

echo ""
echo "================================================"
echo "📊 Validation Summary"
echo "================================================"
echo ""
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ All deployment configurations are valid!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some deployment configurations are missing!${NC}"
    exit 1
fi
