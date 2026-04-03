# OpenAgent Framework - Makefile
# Simplified deployment and development commands

.PHONY: help install build test clean docker-build docker-run docker-stop \
        k8s-deploy k8s-delete k8s-logs helm-install helm-delete \
        aws-deploy azure-deploy gcp-deploy \
        lambda-deploy vercel-deploy cloudflare-deploy

# Default target
.DEFAULT_GOAL := help

# Variables
DOCKER_IMAGE := openagent/openagent
DOCKER_TAG := latest
K8S_NAMESPACE := openagent
HELM_RELEASE := openagent

# Help
help: ## Show this help message
	@echo 'OpenAgent Framework - Available Commands:'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ''

# Development
install: ## Install dependencies
	npm install

build: ## Build the project
	npm run build

test: ## Run tests
	npm test

test:coverage: ## Run tests with coverage
	npm run test:coverage

clean: ## Clean build artifacts
	rm -rf dist/ coverage/ node_modules/

lint: ## Run linter
	npm run lint

format: ## Format code
	npm run format

# Docker
docker-build: ## Build Docker image
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-run: ## Run Docker container
	docker-compose up -d

docker-stop: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f openagent

docker-shell: ## Open shell in Docker container
	docker exec -it openagent sh

docker-dev: ## Run development environment
	docker-compose -f docker-compose.dev.yml up -d

docker-prod: ## Run production environment
	docker-compose up -d --scale openagent=3

# Kubernetes
k8s-namespace: ## Create Kubernetes namespace
	kubectl create namespace $(K8S_NAMESPACE) 2>/dev/null || true

k8s-deploy: k8s-namespace ## Deploy to Kubernetes using kubectl
	kubectl apply -f deploy/kubernetes/manifests/ -n $(K8S_NAMESPACE)

k8s-delete: ## Delete Kubernetes deployment
	kubectl delete -f deploy/kubernetes/manifests/ -n $(K8S_NAMESPACE)

k8s-logs: ## View Kubernetes logs
	kubectl logs -f deployment/openagent -n $(K8S_NAMESPACE)

k8s-status: ## Check Kubernetes deployment status
	kubectl get all -n $(K8S_NAMESPACE)

k8s-scale: ## Scale Kubernetes deployment (usage: make k8s-scale REPLICAS=5)
	kubectl scale deployment openagent --replicas=$(REPLICAS) -n $(K8S_NAMESPACE)

k8s-rollout: ## Restart Kubernetes deployment
	kubectl rollout restart deployment/openagent -n $(K8S_NAMESPACE)

# Helm
helm-install: ## Install using Helm
	helm install $(HELM_RELEASE) deploy/kubernetes/helm/ \
		--namespace $(K8S_NAMESPACE) \
		--create-namespace

helm-upgrade: ## Upgrade Helm deployment
	helm upgrade $(HELM_RELEASE) deploy/kubernetes/helm/ \
		--namespace $(K8S_NAMESPACE)

helm-delete: ## Delete Helm deployment
	helm uninstall $(HELM_RELEASE) --namespace $(K8S_NAMESPACE)

helm-status: ## Check Helm deployment status
	helm status $(HELM_RELEASE) --namespace $(K8S_NAMESPACE)

# AWS
aws-deploy: ## Deploy to AWS using Terraform
	cd deploy/aws && terraform apply -auto-approve

aws-destroy: ## Destroy AWS deployment
	cd deploy/aws && terraform destroy -auto-approve

aws-ecs-deploy: ## Deploy to AWS ECS
	aws ecs update-service \
		--cluster openagent-cluster \
		--service openagent-service \
		--force-new-deployment

aws-logs: ## View AWS CloudWatch logs
	aws logs tail /ecs/openagent --follow

# Azure
azure-deploy: ## Deploy to Azure using Terraform
	cd deploy/azure && terraform apply -auto-approve

azure-destroy: ## Destroy Azure deployment
	cd deploy/azure && terraform destroy -auto-approve

azure-login: ## Login to Azure
	az login

azure-app-deploy: ## Deploy to Azure Container Apps
	az containerapp create \
		--name openagent \
		--resource-group openagent-rg \
		--environment openagent-env \
		--image $(DOCKER_IMAGE):$(DOCKER_TAG)

# GCP
gcp-deploy: ## Deploy to GCP using Terraform
	cd deploy/gcp && terraform apply -auto-approve

gcp-destroy: ## Destroy GCP deployment
	cd deploy/gcp && terraform destroy -auto-approve

gcp-cloud-run-deploy: ## Deploy to Cloud Run
	gcloud run deploy openagent \
		--image $(DOCKER_IMAGE):$(DOCKER_TAG) \
		--platform managed \
		--region us-central1 \
		--allow-unauthenticated

gcp-logs: ## View GCP Cloud Run logs
	gcloud logging tail "resource.type=cloud_run_revision"

# Serverless
lambda-deploy: ## Deploy to AWS Lambda
	cd deploy/serverless/aws-lambda && npm run deploy

lambda-logs: ## View Lambda logs
	cd deploy/serverless/aws-lambda && npm run logs

vercel-deploy: ## Deploy to Vercel
	cd deploy/serverless/vercel && npm run deploy

vercel-logs: ## View Vercel logs
	cd deploy/serverless/vercel && npm run logs

cloudflare-deploy: ## Deploy to Cloudflare Workers
	cd deploy/serverless/cloudflare && npm run deploy

cloudflare-logs: ## View Cloudflare logs
	cd deploy/serverless/cloudflare && npx wrangler tail

# Monitoring
monitoring-setup: ## Setup monitoring stack
	kubectl apply -f deploy/kubernetes/manifests/monitoring/

grafana-port-forward: ## Port-forward Grafana
	kubectl port-forward svc/grafana 3001:80 -n monitoring

prometheus-port-forward: ## Port-forward Prometheus
	kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# Database
db-migrate: ## Run database migrations
	npx prisma migrate deploy

db-reset: ## Reset database
	npx prisma migrate reset --force

db-seed: ## Seed database
	npx prisma db seed

db-studio: ## Open Prisma Studio
	npx prisma studio

# CI/CD
ci: ## Run CI pipeline locally
	npm ci
	npm run lint
	npm run test:coverage
	npm run build

release: ## Create a release (usage: make release VERSION=1.0.0)
	git tag v$(VERSION)
	git push origin v$(VERSION)

# Utility
version: ## Show version
	@echo "OpenAgent Framework v1.0.0"

env-check: ## Check environment variables
	@echo "Checking environment variables..."
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set"; exit 1)
	@test -n "$(REDIS_URL)" || (echo "REDIS_URL is not set"; exit 1)
	@echo "All required environment variables are set."

health-check: ## Check application health
	@curl -f http://localhost:3000/health || (echo "Health check failed"; exit 1)
	@curl -f http://localhost:3000/ready || (echo "Readiness check failed"; exit 1)
	@echo "Health checks passed."

# Development shortcuts
dev: ## Start development server
	npm run dev

dev:docker: ## Start development environment with Docker
	docker-compose -f docker-compose.dev.yml up -d
	npm run dev

prod: ## Start production server
	npm run start
