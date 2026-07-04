output "instance_ip" {
  description = "IP publique de la VM (http://<ip>:3000)"
  value       = openstack_compute_instance_v2.app.access_ip_v4
}

output "bucket_endpoint" {
  description = "Endpoint S3 du bucket documents"
  value       = "https://s3.${var.s3_region}.io.cloud.ovh.net/${var.bucket_name}"
}

output "s3_access_key" {
  description = "Access Key S3 (pour l'app)"
  value       = openstack_identity_ec2_credential_v3.s3.access
  sensitive   = true
}

output "s3_secret_key" {
  description = "Secret Key S3 (pour l'app)"
  value       = openstack_identity_ec2_credential_v3.s3.secret
  sensitive   = true
}
