# OpenAgent Framework - Deployment Guide

This guide covers deployment options for OpenAgent Framework on various platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Cloud Platform Deployment](#cloud-platform-deployment)
5. [Serverless Deployment](#serverless-deployment)
6. [Configuration](#configuration)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- Node.js 20+
- Docker (for containerized deployment)
- Kubernetes cluster (for K8s deployment)
- Cloud account (AWS, Azure, or GCP)

### Optional

- Helm 3+ (for Kubernetes deployment)
- Terraform (for infrastructure as code)
- kubectl (for Kubernetes management)
- wrangler (for Cloudflare Workers)
- serverless framework (for AWS Lambda)

## Docker Deployment

### Quick Start

```bash
# Build the image
docker build -t openagent/openagent:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f openagent

# Stop services
docker-compose down
```

### Development Environment

```bash
# Use development compose file
docker-compose -f docker-compose.dev.yml up -d

# Access services:
# - Application: http://localhost:3000
# - Adminer (DB GUI): http://localhost:8080
# - Redis Commander: http://localhost:8081
```

### Production Environment

```bash
# Build optimized image
docker build -t openagent/openagent:latest .

# Run with production compose
docker-compose -f docker-compose.yml up -d

# Scale the application
docker-compose up -d --scale openagent=3
```

## Kubernetes Deployment

### Using kubectl

```bash
# Create namespace and resources
kubectl apply -f deploy/kubernetes/manifests/

# Check deployment status
kubectl get pods -n openagent
kubectl get services -n openagent

# View logs
kubectl logs -f deployment/openagent -n openagent

# Scale deployment
kubectl scale deployment openagent --replicas=5 -n openagent
```

### Using Helm

```bash
# Install with default values
helm install openagent deploy/kubernetes/helm/

# Install with custom values
helm install openagent deploy/kubernetes/helm/ \
  --set replicaCount=5 \
  --set image.tag=v1.0.0 \
  --set resources.limits.memory=1Gi

# Upgrade deployment
helm upgrade openagent deploy/kubernetes/helm/ \
  --set image.tag=v1.1.0

# Rollback if needed
helm rollback openagent

# Uninstall
helm uninstall openagent
```

### Minikube (Local Testing)

```bash
# Start minikube
minikube start

# Enable ingress
minikube addons enable ingress

# Deploy OpenAgent
kubectl apply -f deploy/kubernetes/manifests/

# Get minikube IP
minikube ip

# Access application
curl http://$(minikube ip)/health
```

## Cloud Platform Deployment

### AWS (ECS Fargate)

#### Using CloudFormation

```bash
# Deploy stack
aws cloudformation deploy \
  --template-file deploy/aws/cloudformation.yaml \
  --stack-name openagent \
  --parameter-overrides \
      ImageTag=latest \
      VpcId=vpc-xxxxx \
      SubnetIds=subnet-xxxxx,subnet-yyyyy \
      DatabasePassword=your-password \
      RedisPassword=your-password \
  --capabilities CAPABILITY_IAM

# Get load balancer URL
aws cloudformation describe-stacks \
  --stack-name openagent \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text
```

#### Using Terraform

```bash
# Initialize Terraform
cd deploy/aws/
terraform init

# Plan deployment
terraform plan \
  -var="aws_region=us-east-1" \
  -var="database_password=your-password" \
  -var="redis_password=your-password"

# Apply configuration
terraform apply \
  -var="aws_region=us-east-1" \
  -var="database_password=your-password" \
  -var="redis_password=your-password"

# Get application URL
terraform output application_url
```

### Azure (Container Apps)

#### Using Azure CLI

```bash
# Create resource group
az group create --name openagent-rg --location eastus

# Create Container Apps environment
az containerapp env create \
  --name openagent-env \
  --resource-group openagent-rg \
  --location eastus

# Deploy container app
az containerapp create \
  --name openagent \
  --resource-group openagent-rg \
  --environment openagent-env \
  --image openagent/openagent:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10 \
  --env-vars \
    NODE_ENV=production \
    LOG_LEVEL=info \
    DATABASE_URL=<your-database-url> \
    REDIS_URL=<your-redis-url>

# Get application URL
az containerapp show \
  --name openagent \
  --resource-group openagent-rg \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

#### Using Terraform

```bash
# Navigate to Azure deployment
cd deploy/azure/

# Initialize and apply
terraform init
terraform apply \
  -var="azure_region=East US" \
  -var="database_url=your-database-url" \
  -var="redis_url=your-redis-url"
```

### Google Cloud (Cloud Run)

#### Using gcloud CLI

```bash
# Deploy to Cloud Run
gcloud run deploy openagent \
  --image openagent/openagent:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 2 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,LOG_LEVEL=info \
  --set-secrets DATABASE_URL=openagent-db-url:latest,REDIS_URL=openagent-redis-url:latest

# Get service URL
gcloud run services describe openagent \
  --region us-central1 \
  --format 'value(status.url)'
```

## Serverless Deployment

### AWS Lambda

```bash
# Navigate to Lambda deployment
cd deploy/serverless/aws-lambda/

# Install dependencies
npm install

# Build
npm run build

# Deploy
npm run deploy

# Or deploy to specific stage
npx serverless deploy --stage production

# View logs
npx serverless logs -f api -t
```

### Vercel

```bash
# Navigate to Vercel deployment
cd deploy/serverless/vercel/

# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs
```

### Cloudflare Workers

```bash
# Navigate to Cloudflare deployment
cd deploy/serverless/cloudflare/

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Deploy
npm run deploy

# View logs in real-time
npx wrangler tail

# Deploy to production
npx wrangler deploy --env production
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Application environment | `development` | Yes |
| `LOG_LEVEL` | Logging level | `info` | No |
| `PORT` | Server port | `3000` | Yes |
| `DATABASE_URL` | PostgreSQL connection URL | - | Yes |
| `REDIS_URL` | Redis connection URL | - | Yes |
| `OPENAI_API_KEY` | OpenAI API key | - | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | No |

### Secrets Management

#### Kubernetes

```bash
# Create secret from literal
kubectl create secret generic openagent-secret \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --namespace openagent

# Create secret from file
kubectl create secret generic openagent-secret \
  --from-file=database-url=./secrets/db-url.txt \
  --namespace openagent
```

#### AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name openagent/database-url \
  --secret-string "postgresql://..."

# Update secret
aws secretsmanager put-secret-value \
  --secret-id openagent/database-url \
  --secret-string "postgresql://..."
```

## Monitoring

### Prometheus + Grafana

```bash
# Deploy monitoring stack
kubectl apply -f deploy/kubernetes/manifests/monitoring/

# Access Grafana
kubectl port-forward svc/grafana 3001:80 -n monitoring

# Default credentials: admin/admin
```

### CloudWatch (AWS)

```bash
# View logs
aws logs tail /ecs/openagent --follow

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace ECS/ContainerInsights \
  --metric-name CpuUtilized
```

### Health Checks

All deployments include health checks:

- **Liveness**: `/health` - Checks if the application is running
- **Readiness**: `/ready` - Checks if the application is ready to receive traffic

## Troubleshooting

### Common Issues

#### 1. Pod not starting in Kubernetes

```bash
# Check pod status
kubectl describe pod <pod-name> -n openagent

# Check logs
kubectl logs <pod-name> -n openagent

# Check events
kubectl get events -n openagent --sort-by='.lastTimestamp'
```

#### 2. Database connection issues

```bash
# Verify database is accessible
kubectl run -it --rm psql --image=postgres:16-alpine --restart=Never -- \
  psql "postgresql://openagent:password@postgres:5432/openagent"

# Check database credentials
kubectl get secret openagent-secret -n openagent -o jsonpath='{.data.database-url}' | base64 -d
```

#### 3. High memory usage

```bash
# Check resource usage
kubectl top pods -n openagent

# Increase memory limit
kubectl set resources deployment/openagent \
  --limits=memory=1Gi \
  --requests=memory=512Mi \
  -n openagent
```

#### 4. Ingress not working

```bash
# Check ingress status
kubectl get ingress -n openagent

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify DNS resolution
nslookup openagent.example.com
```

### Performance Tuning

#### Kubernetes

```yaml
# Adjust HPA settings
autoscaling:
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
```

#### Docker

```yaml
# docker-compose.yml
services:
  openagent:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

## Best Practices

1. **Security**
   - Always use secrets for sensitive data
   - Enable network policies in Kubernetes
   - Use HTTPS for all external traffic
   - Regularly update dependencies

2. **High Availability**
   - Deploy at least 2 replicas
   - Use pod disruption budgets
   - Implement proper health checks
   - Configure horizontal pod autoscaling

3. **Monitoring**
   - Enable logging and metrics collection
   - Set up alerts for critical metrics
   - Use distributed tracing
   - Monitor resource usage

4. **Backup**
   - Regular database backups
   - Configuration backup
   - Disaster recovery plan

5. **Cost Optimization**
   - Right-size resources
   - Use spot/preemptible instances when appropriate
   - Implement auto-scaling
   - Monitor and optimize costs

## Support

- GitHub Issues: https://github.com/openagent/openagent-framework/issues
- Documentation: https://docs.openagent.dev
- Community: https://discord.gg/openagent
