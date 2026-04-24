terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}

  resource_provider_registrations = "none"
}

# Variables
variable "location" {
  description = "Azure region (check quota first!)"
  type        = string
  default     = "northeurope"
}

variable "project" {
  description = "Short project name used as prefix"
  type        = string
  default     = "eadca2"
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}"
  location = var.location
  tags = {
    project    = var.project
    managed_by = "terraform"
    module     = "EAD-CA2"
  }
}

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  name                = "acr${var.project}${substr(md5(azurerm_resource_group.main.id), 0, 6)}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = azurerm_resource_group.main.tags
}

# Log Analytics for AKS monitoring add-on
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.project}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# AKS cluster (Free tier, 2 nodes Standard_B2s)
resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-${var.project}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "aks-${var.project}"

  # Free tier control plane (best-effort SLO, not SLA — fine for coursework)
  sku_tier = "Free"

  default_node_pool {
    name                 = "system"
    vm_size              = "Standard_B2s_v2"   # 2 vCPU, 4 GB RAM — budget-friendly
    node_count           = 1
    os_disk_size_gb      = 30
    auto_scaling_enabled = true
    min_count            = 1
    max_count            = 3
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "calico"   # Enables NetworkPolicy — needed for RMP security section
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  tags = azurerm_resource_group.main.tags
}

#  Allow AKS to pull from ACR without any secret
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  skip_service_principal_aad_check = true
}

# Outputs 
output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.main.name
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "acr_name" {
  value = azurerm_container_registry.main.name
}

output "get_credentials_cmd" {
  value = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.main.name} --overwrite-existing"
}