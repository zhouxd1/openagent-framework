# OpenAgent Framework - Cloud Deployment

<div align="center">

![Deployment](https://img.shields.io/badge/Deployment-Ready-brightgreen)
![Platforms](https://img.shields.io/badge/Platforms-8+-blue)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20%7C%20GitLab%20CI-orange)

**Enterprise-grade cloud deployment for OpenAgent Framework**

[Quick Start](#quick-start) • [Platforms](#platforms) • [Documentation](#documentation) • [Support](#support)

</div>

---

## 📖 Overview

OpenAgent Framework 支持多种云部署方案，从本地 Docker 到企业级 Kubernetes 集群，再到 Serverless 边缘计算。

### ✨ Features

- 🐳 **Docker** - 多阶段构建，优化的生产镜像
- ☸️ **Kubernetes** - Helm Charts + 原生 Manifests
- ☁️ **Multi-Cloud** - AWS, Azure, GCP 全覆盖
- ⚡ **Serverless** - Lambda, Vercel, Cloudflare Workers
- 🔄 **CI/CD** - GitHub Actions, GitLab CI 自动化
- 📊 **Monitoring** - Prometheus + Grafana 集成
- 🔒 **Security** - 密钥管理，安全上下文
- 📈 **Auto-Scaling** - HPA 自动扩缩容

---

## 🚀 Quick Start

### Docker Compose (最快)

```bash
# 克隆项目
git clone https://github.com/openagent/openagent-framework.git
cd openagent-framework

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f openagent

# 访问应用
curl http://localhost:3000/health
```

### Kubernetes (生产推荐)

```bash
# 使用 kubectl
kubectl apply -f deploy/kubernetes/manifests/

# 或使用 Helm
helm install openagent deploy/kubernetes/helm/
```

### 云平台 (AWS 示例)

```bash
# 使用 Terraform
cd deploy/aws
terraform init
terraform apply

# 获取应用 URL
terraform output application_url
```

---

## 🏗️ Platforms

### 容器编排

| 平台 | 难度 | 成本 | 推荐场景 |
|------|------|------|----------|
| [Docker Compose](./deploy/DEPLOYMENT.md#docker-deployment) | ⭐ | 💰 | 开发/测试/小规模生产 |
| [Kubernetes](./deploy/DEPLOYMENT.md#kubernetes-deployment) | ⭐⭐⭐ | 💰💰 | 大规模生产环境 |

### 云平台

| 平台 | 难度 | 成本 | 推荐场景 |
|------|------|------|----------|
| [AWS (ECS/Fargate)](./deploy/aws/) | ⭐⭐ | 💰💰💰 | AWS 生态 |
| [Azure (Container Apps)](./deploy/azure/) | ⭐⭐ | 💰💰 | Azure 生态 |
| [GCP (Cloud Run)](./deploy/gcp/) | ⭐⭐ | 💰💰 | GCP 生态 |

### Serverless

| 平台 | 难度 | 成本 | 推荐场景 |
|------|------|------|----------|
| [AWS Lambda](./deploy/serverless/aws-lambda/) | ⭐⭐⭐ | 💰 | 事件驱动/突发流量 |
| [Vercel Edge](./deploy/serverless/vercel/) | ⭐ | 💰 | 前端+API 一体 |
| [Cloudflare Workers](./deploy/serverless/cloudflare/) | ⭐ | 💰 | 全球边缘计算 |

---

## 📁 Directory Structure

```
deploy/
├── kubernetes/              # Kubernetes 部署
│   ├── helm/               # Helm Charts
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/      # 9 个模板文件
│   └── manifests/          # 原生 Manifests (9 个文件)
│
├── aws/                    # AWS 部署
│   ├── ecs-task-definition.json
│   ├── cloudformation.yaml
│   └── terraform/          # 3 个 TF 文件
│
├── azure/                  # Azure 部署
│   ├── container-app.yaml
│   ├── arm-template.json
│   └── terraform/          # 3 个 TF 文件
│
├── gcp/                    # GCP 部署
│   ├── cloud-run.yaml
│   └── terraform/          # 3 个 TF 文件
│
└── serverless/             # Serverless 部署
    ├── aws-lambda/         # 3 个文件
    ├── vercel/             # 3 个文件
    └── cloudflare/         # 3 个文件

.github/workflows/          # CI/CD
├── ci.yml                  # 持续集成
├── deploy.yml              # 自动部署
└── release.yml             # 版本发布

Dockerfile                  # 生产镜像
Dockerfile.dev              # 开发镜像
docker-compose.yml          # 生产编排
docker-compose.dev.yml      # 开发编排
```

---

## 📊 Deployment Matrix

### 特性对比

| 特性 | Docker | K8s | AWS | Azure | GCP | Lambda | Vercel | CF Workers |
|------|--------|-----|-----|-------|-----|--------|--------|------------|
| 自动扩容 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 负载均衡 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 健康检查 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 滚动更新 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 零停机 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 密钥管理 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 监控集成 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 多区域 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 边缘计算 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### 成本对比

| 场景 | 推荐方案 | 月成本 | 说明 |
|------|----------|--------|------|
| 开发/测试 | Docker Compose | $0 | 使用现有资源 |
| 小型生产 | Docker Compose + VPS | $10-50 | 4GB RAM VPS |
| 中型生产 | Kubernetes (Managed) | $200-500 | 3 节点集群 |
| 大型生产 | Multi-region K8s | $500+ | 全球部署 |
| Serverless | Lambda/Vercel/Workers | $0-100 | 按使用付费 |

---

## 📚 Documentation

### 部署指南

- **[完整部署指南](./deploy/DEPLOYMENT.md)** - 详细的部署步骤和配置
- **[部署摘要](./deploy/DEPLOYMENT-SUMMARY.md)** - 快速开始和最佳实践
- **[部署报告](./deploy/CLOUD-DEPLOYMENT-REPORT.md)** - 完整的实施报告

### 配置参考

- **[Kubernetes 配置](./deploy/kubernetes/)** - Helm Charts 和 Manifests
- **[AWS 配置](./deploy/aws/)** - ECS, CloudFormation, Terraform
- **[Azure 配置](./deploy/azure/)** - Container Apps, ARM, Terraform
- **[GCP 配置](./deploy/gcp/)** - Cloud Run, Terraform

### CI/CD

- **[GitHub Actions](./.github/workflows/)** - CI, Deploy, Release
- **[GitLab CI](./.gitlab-ci.yml)** - 完整流水线

---

## 🔧 Configuration

### 环境变量

```bash
# 必需
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://:password@host:6379

# 可选
LOG_LEVEL=info
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Secrets 管理

| 平台 | 方案 |
|------|------|
| Kubernetes | Kubernetes Secrets |
| AWS | AWS Secrets Manager |
| Azure | Azure Key Vault |
| GCP | Secret Manager |
| Vercel | Environment Variables |
| Cloudflare | Wrangler Secrets |

---

## 📈 Monitoring

### 健康检查

- **Liveness**: `GET /health` - 存活检查
- **Readiness**: `GET /ready` - 就绪检查
- **Metrics**: `GET /metrics` - Prometheus 指标

### 监控集成

```bash
# Prometheus
kubectl apply -f prometheus.yml

# Grafana
docker-compose --profile monitoring up -d
```

---

## 🔒 Security

### 最佳实践

- ✅ 所有密钥使用 Secret 管理
- ✅ 容器以非 root 用户运行
- ✅ 只读文件系统
- ✅ 网络策略隔离
- ✅ TLS/HTTPS 加密
- ✅ 定期安全扫描

---

## 🛠️ Development

### 本地开发

```bash
# 使用开发环境
docker-compose -f docker-compose.dev.yml up -d

# 访问服务
# - 应用: http://localhost:3000
# - 数据库 GUI: http://localhost:8080
# - Redis GUI: http://localhost:8081
```

### 验证部署

```bash
# Linux/Mac
./deploy/validate-deployment.sh

# Windows
.\deploy\validate-deployment.bat
```

---

## 🎯 Use Cases

### 场景 1: 小型项目
**需求**: < 10k 用户/天  
**方案**: Docker Compose + VPS  
**成本**: $10-50/月

```bash
docker-compose up -d
```

### 场景 2: 中型项目
**需求**: 10k-100k 用户/天  
**方案**: Kubernetes (Managed)  
**成本**: $200-500/月

```bash
helm install openagent deploy/kubernetes/helm/
```

### 场景 3: 大型项目
**需求**: > 100k 用户/天  
**方案**: Cloud Platform + CDN  
**成本**: $500+/月

```bash
terraform apply
```

### 场景 4: 事件驱动
**需求**: 突发流量  
**方案**: Serverless  
**成本**: 按使用付费

```bash
npx serverless deploy
```

---

## 🆘 Support

### 故障排查

查看 [故障排查指南](./deploy/DEPLOYMENT.md#troubleshooting)

### 常见问题

1. **容器无法启动** → 检查日志和资源限制
2. **数据库连接失败** → 验证连接字符串和网络
3. **性能问题** → 调整资源配置和 HPA

### 获取帮助

- 📖 [文档](./deploy/DEPLOYMENT.md)
- 💬 [Discord](https://discord.gg/openagent)
- 🐛 [Issues](https://github.com/openagent/openagent-framework/issues)

---

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

## 🙏 Acknowledgments

- Docker
- Kubernetes
- AWS, Azure, GCP
- Vercel, Cloudflare
- Open Source Community

---

<div align="center">

**Made with ❤️ by OpenAgent Team**

[⬆ Back to Top](#openagent-framework---cloud-deployment)

</div>
