locals {
  tags = {
    Project      = "Research Catalog"
    BusinessUnit = "LSP"
    Environment  = var.environment
  }
}

variable "environment" {
  type = string
  default = "qa"
  description = "The name of the environment (qa, production)."

  validation {
    condition     = contains(["qa", "production"], var.environment)
    error_message = "The environment must be 'qa' or 'production'."
  }
}