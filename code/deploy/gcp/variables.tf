# GCP Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

# Project Configuration
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "openagent"
}

# Docker Configuration
variable "docker_image" {
  description = "Docker image repository"
  type        = string
  default     = "openagent/openagent"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

# Application Configuration
variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

# Database Configuration
variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
  sensitive   = true
}
