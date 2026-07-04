# Inputs Terraform — POC Depulib sur OVH Public Cloud.
# Les credentials API OVH (application_key/secret, consumer_key) sont lus depuis
# l'environnement (OVH_ENDPOINT, OVH_APPLICATION_KEY, ...) par le provider ovh.

variable "ovh_endpoint" {
  description = "Endpoint API OVH (ovh-eu, ovh-ca, ...)"
  type        = string
  default     = "ovh-eu"
}

variable "project_id" {
  description = "Public Cloud Project ID / service_name (OVH_CLOUD_PROJECT_SERVICE)"
  type        = string
}

variable "region" {
  description = "Region OVH (gra, sbg, rbx, ...)"
  type        = string
  default     = "GRA11"
}

variable "s3_region" {
  description = "Region Object Storage S3 (gra, sbg, rbx)"
  type        = string
  default     = "gra"
}

variable "flavor" {
  description = "Type d'instance (petite VM sans GPU)"
  type        = string
  default     = "d2-4"
}

variable "image" {
  description = "Image OS de l'instance"
  type        = string
  default     = "Debian 12"
}

variable "bucket_name" {
  description = "Nom du bucket Object Storage pour les documents uploadés"
  type        = string
  default     = "depulib-documents"
}

variable "ssh_public_key" {
  description = "Clé SSH publique injectée dans l'instance (OVH_API_KEY dans .env)"
  type        = string
}

variable "ssh_private_key_path" {
  description = "Chemin vers la clé privée SSH correspondante (pour scp/remote-exec)"
  type        = string
  default     = "~/.ssh/id_ed25519_ovh"
}

variable "cloudtemple_api_key" {
  description = "Clé API Cloud Temple LLMaaS, écrite dans le .env de prod"
  type        = string
  sensitive   = true
}
