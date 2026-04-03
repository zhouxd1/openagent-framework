# Outputs
output "container_app_url" {
  description = "URL of the Container App"
  value       = azurerm_container_app.main.latest_revision_fqdn
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "environment_name" {
  description = "Name of the Container Apps environment"
  value       = azurerm_container_app_environment.main.name
}
