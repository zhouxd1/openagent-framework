# Azure Provider Configuration
provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.azure_region
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Container Apps Environment
resource "azurerm_container_app_environment" "main" {
  name                = "${var.project_name}-env"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# Container App
resource "azurerm_container_app" "main" {
  name                         = var.project_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  secret {
    name  = "database-url"
    value = var.database_url
  }

  secret {
    name  = "redis-url"
    value = var.redis_url
  }

  container {
    name   = var.project_name
    image  = "${var.docker_image}:${var.image_tag}"
    cpu    = 0.5
    memory = "1Gi"

    env {
      name  = "NODE_ENV"
      value = "production"
    }

    env {
      name  = "LOG_LEVEL"
      value = var.log_level
    }

    env {
      name  = "PORT"
      value = "3000"
    }

    env {
      name        = "DATABASE_URL"
      secret_name = "database-url"
    }

    env {
      name        = "REDIS_URL"
      secret_name = "redis-url"
    }
  }

  ingress {
    target_port = 3000
    external_enabled = true

    traffic_weight {
      percentage = 100
      latest_revision = true
    }
  }
}
