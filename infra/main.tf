# Infra POC Depulib — OVH Public Cloud.
# 1 instance (Next.js + SQLite en Docker) + 1 bucket S3 (documents uploadés).
# L'inférence IA est déléguée à Cloud Temple LLMaaS → la VM n'a pas besoin de GPU.

terraform {
  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 1.5"
    }
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 2.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Credentials API OVH lus depuis l'env : OVH_ENDPOINT, OVH_APPLICATION_KEY,
# OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY.
provider "ovh" {
  endpoint = var.ovh_endpoint
}

# --- Credentials OpenStack générés à la volée depuis le token OVH ---
# Permet à Terraform de piloter Nova (instance) et de créer les clés S3, sans
# credentials OpenStack manuels.
resource "ovh_cloud_project_user" "app" {
  service_name = var.project_id
  description  = "depulib-terraform"
  role_names   = ["objectstore_operator", "compute_operator"]
}

# openstack_ec2_credential a besoin d'un provider openstack authentifié.
provider "openstack" {
  auth_url    = "https://auth.cloud.ovh.net/v3"
  domain_name = "Default"
  user_name   = ovh_cloud_project_user.app.username
  password    = ovh_cloud_project_user.app.password
  tenant_id   = var.project_id
  region      = var.region
}

# --- Clés S3 (Access Key / Secret Key) pour l'app ---
resource "openstack_identity_ec2_credential_v3" "s3" {}

# --- Bucket via l'API S3 d'OVH (pas Swift) ---
# L'app utilise le SDK S3 → on crée le bucket avec le MÊME protocole et les
# MÊMES clés, pour éviter les écarts catalog Swift ↔ endpoint S3.
provider "aws" {
  region     = var.s3_region
  access_key = openstack_identity_ec2_credential_v3.s3.access
  secret_key = openstack_identity_ec2_credential_v3.s3.secret
  endpoints { s3 = "https://s3.${var.s3_region}.io.cloud.ovh.net" }
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
}

resource "aws_s3_bucket" "documents" {
  bucket = var.bucket_name
}

# --- Clé SSH ---
resource "openstack_compute_keypair_v2" "deploy" {
  name       = "depulib-deploy"
  public_key = var.ssh_public_key
}

# --- Instance ---
# image_name (pas de data source) : évite une lecture pendant le plan, avant que
# le user OpenStack (et donc le provider) n'existe.
resource "openstack_compute_instance_v2" "app" {
  name        = "depulib-poc"
  flavor_name = var.flavor
  image_name  = var.image
  key_pair    = openstack_compute_keypair_v2.deploy.name
  region      = var.region

  network {
    name = "Ext-Net" # réseau public OVH (IP publique)
  }

  # cloud-init : installe Docker + docker compose plugin.
  user_data = file("${path.module}/cloud-init.yaml")

  # --- Déploiement du code local via SSH ---
  connection {
    type        = "ssh"
    host        = self.access_ip_v4
    user        = "debian"
    private_key = file(pathexpand(var.ssh_private_key_path))
    timeout     = "5m"
  }

  # Attend que cloud-init ait fini d'installer Docker.
  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait || true",
      "mkdir -p /home/debian/depulib",
    ]
  }

  # Archive le code local (git archive → respecte .gitignore : pas de
  # node_modules/.next/data). Le Dockerfile rebuild tout de toute façon.
  # abspath : le -o est indépendant du working_dir, et le provisioner file lit
  # le même chemin absolu.
  provisioner "local-exec" {
    command     = "git archive --format=tar.gz -o ${abspath(path.module)}/.depulib-src.tar.gz HEAD"
    working_dir = "${path.module}/.."
  }

  provisioner "file" {
    source      = "${abspath(path.module)}/.depulib-src.tar.gz"
    destination = "/home/debian/depulib/src.tar.gz"
  }

  # Extrait le code et écrit le .env de prod. Le .env passe en UNE ligne base64
  # (sensible) → Terraform masque 1 ligne, pas tout le build. Décodé sur la VM.
  provisioner "remote-exec" {
    inline = [
      "cd /home/debian/depulib",
      "tar -xzf src.tar.gz && rm src.tar.gz",
      "echo '${base64encode(join("\n", [
        "CLOUDTEMPLE_LLMAAS_API_KEY=${var.cloudtemple_api_key}",
        "S3_ENDPOINT=https://s3.${var.s3_region}.io.cloud.ovh.net",
        "S3_REGION=${var.s3_region}",
        "S3_BUCKET=${var.bucket_name}",
        "S3_ACCESS_KEY=${openstack_identity_ec2_credential_v3.s3.access}",
        "S3_SECRET_KEY=${openstack_identity_ec2_credential_v3.s3.secret}",
      ]))}' | base64 -d > .env",
    ]
  }

  # Build + lancement EN ARRIÈRE-PLAN, logs sur la VM (pas dans Terraform).
  # nohup + redirection → Terraform reçoit une ligne et rend la main tout de
  # suite ; le build (plusieurs min) continue sur la VM. Suivi : voir README.
  provisioner "remote-exec" {
    inline = [
      "cd /home/debian/depulib",
      "sudo nohup docker compose up -d --build > /home/debian/deploy.log 2>&1 &",
      "sleep 2 && echo 'Build lancé en arrière-plan. Logs : ssh debian@<ip> tail -f deploy.log'",
    ]
  }
}
