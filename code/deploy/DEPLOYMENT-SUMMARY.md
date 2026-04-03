# OpenAgent Framework - Deployment Summary

## 🎯 Deployment Overview

OpenAgent Framework 支持多种部署方式，从本地开发到企业级生产环境。

## 📦 部署矩阵

| 平台 | 类型 | 难度 | 成本 | 扩展性 | 推荐场景 |
|------|------|------|------|--------|----------|
| Docker Compose | 容器编排 | ⭐ | 💰 | 中 | 开发/测试/小规模生产 |
| Kubernetes | 容器编排 | ⭐⭐⭐ | 💰💰 | 高 | 大规模生产环境 |
| AWS ECS/Fargate | 云托管 | ⭐⭐ | 💰💰💰 | 高 | AWS 生态 |
| Azure Container Apps | 云托管 | ⭐⭐ | 💰💰 | 高 | Azure 生态 |
| GCP Cloud Run | Serverless | ⭐⭐ | 💰💰 | 高 | GCP 生态 |
| AWS Lambda | Serverless | ⭐⭐⭐ | 💰 | 中 | 事件驱动/突发流量 |
| Vercel Edge | Serverless | ⭐ | 💰 | 中 | 前端+API 一体 |
| Cloudflare Workers | Serverless | ⭐ | 💰 | 中 | 全球边缘计算 |

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │  OpenAgent   │ │  OpenAgent  │ │  OpenAgent  │
        │  Instance 1  │ │  Instance 2 │ │  Instance 3 │
        └───────┬──────┘ └──────┬──────┘ └──────┬──────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │  PostgreSQL  │ │    Redis    │ │  Prometheus │
        │   Database   │ │    Cache    │ │  Monitoring │
        └──────────────┘ └─────────────┘ └─────────────┘
```

## 🚀 快速开始

### 1. Docker Compose（最简单）

```bash
# 克隆项目
git clone https://github.com/openagent/openagent-framework.git
cd openagent-framework

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f openagent

# 访问应用
curl http://localhost:3000/health
```

### 2. Kubernetes（生产推荐）

```bash
# 使用 kubectl
kubectl apply -f deploy/kubernetes/manifests/

# 或使用 Helm
helm install openagent deploy/kubernetes/helm/

# 查看状态
kubectl get pods -n openagent
```

### 3. AWS（云部署）

```bash
# 使用 Terraform
cd deploy/aws
terraform init
terraform apply

# 获取应用 URL
terraform output application_url
```

## 📁 目录结构

```
deploy/
├── kubernetes/              # Kubernetes 部署配置
│   ├── helm/               # Helm Charts
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── ingress.yaml
│   │       ├── configmap.yaml
│   │       ├── secret.yaml
│   │       └── hpa.yaml
│   └── manifests/          # Kubernetes 原生配置
│       ├── namespace.yaml
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── configmap.yaml
│       ├── secret.yaml
│       ├── hpa.yaml
│       ├── postgres.yaml
│       └── redis.yaml
│
├── aws/                    # AWS 部署配置
│   ├── ecs-task-definition.json
│   ├── cloudformation.yaml
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── azure/                  # Azure 部署配置
│   ├── container-app.yaml
│   ├── arm-template.json
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── gcp/                    # GCP 部署配置
│   ├── cloud-run.yaml
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
└── serverless/             # Serverless 部署配置
    ├── aws-lambda/
    │   ├── handler.ts
    │   ├── serverless.yml
    │   └── package.json
    ├── vercel/
    │   ├── api/index.ts
    │   ├── vercel.json
    │   └── package.json
    └── cloudflare/
        ├── worker.ts
        ├── wrangler.toml
        └── package.json
```

## ⚙️ 配置管理

### 环境变量

所有平台都支持通过环境变量配置：

```bash
# 必需
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 可选
LOG_LEVEL=info
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Secrets 管理

| 平台 | Secrets 方案 |
|------|-------------|
| Kubernetes | Kubernetes Secrets |
| AWS | AWS Secrets Manager / Parameter Store |
| Azure | Azure Key Vault |
| GCP | Secret Manager |
| Vercel | Environment Variables |
| Cloudflare | Wrangler Secrets |

## 📊 监控和日志

### 内置监控

所有部署都包含：

- **Health Check**: `/health` - 存活检查
- **Readiness Check**: `/ready` - 就绪检查
- **Metrics**: `/metrics` - Prometheus 指标

### 日志收集

| 平台 | 日志方案 |
|------|---------|
| Docker | Docker Logs |
| Kubernetes | EFK / Loki |
| AWS | CloudWatch Logs |
| Azure | Log Analytics |
| GCP | Cloud Logging |
| Vercel | Vercel Logs |
| Cloudflare | Workers Logs |

## 💰 成本估算

### Docker Compose（自托管）

- **VPS (4GB RAM)**: $10-20/月
- **总计**: $10-20/月

### Kubernetes（生产）

- **集群 (3 nodes)**: $150-300/月
- **数据库**: $50-100/月
- **Redis**: $30-50/月
- **负载均衡器**: $20-40/月
- **总计**: $250-490/月

### AWS ECS

- **ECS (3 tasks)**: $100-150/月
- **RDS PostgreSQL**: $50-100/月
- **ElastiCache Redis**: $30-50/月
- **ALB**: $20-40/月
- **总计**: $200-340/月

### Serverless（按使用付费）

- **Lambda**: $0.20/百万请求 + 计算时间
- **Cloud Run**: $0.40/百万请求 + 计算时间
- **Workers**: $0.50/百万请求（免费额度内）

## 🔒 安全最佳实践

1. **密钥管理**
   - ✅ 使用平台提供的 Secrets 管理
   - ❌ 不要在代码中硬编码密钥
   - ✅ 定期轮换密钥

2. **网络安全**
   - ✅ 使用 VPC/虚拟网络隔离
   - ✅ 配置安全组/防火墙规则
   - ✅ 启用 TLS/HTTPS

3. **访问控制**
   - ✅ 使用 IAM 角色和服务账户
   - ✅ 实施最小权限原则
   - ✅ 启用审计日志

## 📈 性能优化

### 资源配置建议

| 场景 | CPU | 内存 | 副本数 |
|------|-----|------|--------|
| 开发 | 0.5 core | 256Mi | 1 |
| 测试 | 1 core | 512Mi | 2 |
| 生产（小） | 1 core | 512Mi | 3 |
| 生产（中） | 2 core | 1Gi | 5 |
| 生产（大） | 4 core | 2Gi | 10+ |

### 自动扩缩容

```yaml
# Kubernetes HPA
autoscaling:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

## 🛠️ 常用命令

### Docker

```bash
# 构建镜像
docker build -t openagent/openagent:latest .

# 运行容器
docker-compose up -d

# 查看日志
docker-compose logs -f openagent

# 扩容
docker-compose up -d --scale openagent=5
```

### Kubernetes

```bash
# 部署
kubectl apply -f deploy/kubernetes/manifests/

# 查看状态
kubectl get pods -n openagent

# 扩容
kubectl scale deployment openagent --replicas=5 -n openagent

# 滚动更新
kubectl set image deployment/openagent openagent=openagent/openagent:v2.0.0 -n openagent

# 回滚
kubectl rollout undo deployment/openagent -n openagent
```

### 云平台

```bash
# AWS
terraform apply -var="database_password=xxx"
aws ecs update-service --cluster openagent --service openagent --force-new-deployment

# Azure
az containerapp update --name openagent --resource-group openagent-rg --image openagent/openagent:v2.0.0

# GCP
gcloud run services update openagent --image openagent/openagent:v2.0.0 --region us-central1
```

## 🆘 故障排查

### 常见问题

1. **容器无法启动**
   ```bash
   # 查看日志
   kubectl logs -f deployment/openagent -n openagent
   
   # 检查事件
   kubectl describe pod <pod-name> -n openagent
   ```

2. **数据库连接失败**
   ```bash
   # 检查连接字符串
   kubectl get secret openagent-secret -n openagent -o jsonpath='{.data.database-url}' | base64 -d
   
   # 测试连接
   kubectl run -it --rm psql --image=postgres:16 --restart=Never -- \
     psql "postgresql://openagent:password@postgres:5432/openagent"
   ```

3. **性能问题**
   ```bash
   # 查看资源使用
   kubectl top pods -n openagent
   
   # 调整资源限制
   kubectl set resources deployment/openagent \
     --limits=memory=1Gi,cpu=1000m \
     --requests=memory=512Mi,cpu=500m \
     -n openagent
   ```

## 📚 相关文档

- [完整部署指南](./DEPLOYMENT.md)
- [API 文档](./docs/api.md)
- [架构设计](./docs/architecture.md)
- [性能优化](./docs/performance.md)

## 🎓 学习路径

1. **入门**: Docker Compose → 本地开发
2. **进阶**: Kubernetes → 容器编排
3. **生产**: 云平台部署（AWS/Azure/GCP）
4. **优化**: Serverless + 边缘计算

## ✅ 部署检查清单

- [ ] 配置环境变量和密钥
- [ ] 设置数据库连接
- [ ] 配置 Redis 连接
- [ ] 启用健康检查
- [ ] 配置日志收集
- [ ] 设置监控告警
- [ ] 配置自动扩缩容
- [ ] 启用 HTTPS/TLS
- [ ] 配置备份策略
- [ ] 测试故障恢复

## 🚀 推荐部署方案

### 小型项目（< 10k 用户/天）
- **推荐**: Docker Compose + VPS
- **成本**: $10-50/月
- **扩展**: 手动扩容

### 中型项目（10k-100k 用户/天）
- **推荐**: Kubernetes (Managed) 或 Cloud Platform
- **成本**: $200-500/月
- **扩展**: 自动扩缩容

### 大型项目（> 100k 用户/天）
- **推荐**: Kubernetes (Multi-region) + CDN
- **成本**: $500+/月
- **扩展**: 全球负载均衡 + 边缘计算

---

**选择适合你的部署方案，开始使用 OpenAgent Framework！** 🎉
