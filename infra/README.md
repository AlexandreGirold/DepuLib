# Infra — Depulib sur OVH Public Cloud

Provisionne **1 VM** (Next.js + SQLite en Docker) et **1 bucket S3** (documents
uploadés) via Terraform. L'IA est déléguée à Cloud Temple LLMaaS → pas de GPU.

## Prérequis

1. **Terraform** ≥ 1.5, une clé SSH (`~/.ssh/id_ed25519`).
2. **Credentials API OVH** exportés dans le shell (déjà dans le `.env` racine) :

   ```bash
   set -a && source ../.env && set +a
   ```

   Ça exporte `OVH_ENDPOINT`, `OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`,
   `OVH_CONSUMER_KEY` — que le provider `ovh` lit automatiquement.

   Le `.env` racine définit aussi 3 lignes `TF_VAR_*` qui remplissent les
   variables Terraform (`project_id`, `ssh_public_key`, `cloudtemple_api_key`)
   automatiquement. **Pas besoin de `terraform.tfvars`.**

   > ⚠️ Chaque nouveau terminal repart sans ces variables. Refais
   > `set -a && source ../.env && set +a` avant toute commande `terraform`,
   > sinon tu auras des prompts « Enter a value » et une erreur d'auth OVH.

## Déploiement

```bash
terraform init
terraform plan
terraform apply
```

À la fin, `terraform output` donne l'IP publique :

```bash
terraform output instance_ip   # → http://<ip>:3000
```

Le bucket S3 et ses clés sont créés par Terraform et injectés automatiquement
dans le `.env` de la VM (l'app s'y connecte sans intervention).

## Tester

### 1. Avant de déployer — la config Terraform est valide

```bash
terraform validate   # doit afficher « Success! »
terraform plan       # liste les ressources à créer, sans rien créer
```

### 2. Avant de déployer — l'app + upload multi-fichiers marchent en local

Le storage bascule sur le **disque local** tant que `S3_ENDPOINT` est vide, donc
tu peux tester tout le parcours upload sans bucket :

```bash
cd ..
docker compose up --build       # http://localhost:3000
```

Connecte-toi en `jean.lobby` (représentant) → dépose une contribution → dépose
**plusieurs PDF** d'un coup → tu dois voir *« N document(s) ajouté(s) »* et un
**résumé IA combiné** unique. Les fichiers atterrissent dans `data/uploads/`.

### 3. Après `terraform apply` — l'app tourne sur la VM

```bash
IP=$(terraform output -raw instance_ip)
curl -sf http://$IP:3000/api/ia/health && echo "  ✅ app up"
```

Ouvre `http://$IP:3000`, refais le parcours upload. Cette fois les fichiers vont
dans le **bucket OVH**, pas sur le disque de la VM. Vérifie-le :

```bash
# clés S3 générées par Terraform
export AWS_ACCESS_KEY_ID=$(terraform output -raw s3_access_key)
export AWS_SECRET_ACCESS_KEY=$(terraform output -raw s3_secret_key)
aws s3 ls s3://depulib-documents/ \
  --endpoint-url $(terraform output -raw bucket_endpoint | sed 's#/depulib-documents##')
# → doit lister les <timestamp>-<nom>.pdf que tu viens d'uploader
```

### Erreurs courantes

- **`Enter a value` / `missing authentication information`** → tu as oublié
  `set -a && source ../.env && set +a` dans ce terminal.
- **`You must provide a password to authenticate` (provider openstack)** → le
  user OpenStack (`ovh_cloud_project_user.app`) vient d'être créé et ses
  credentials mettent quelques secondes à se propager côté OVH. Relance
  simplement `terraform apply` : au 2ᵉ passage le user existe déjà.

### 4. Débugger si l'app ne répond pas

```bash
ssh debian@$IP
cd depulib && sudo docker compose logs -f    # logs de l'app
sudo docker compose ps                        # état du conteneur
```

## Détruire

```bash
terraform destroy
```

## Notes POC

- **State local** (`terraform.tfstate`), gitignoré. Pas de backend distant.
- Le code est poussé par **`git archive`** (tarball, respecte `.gitignore` → pas
  de `node_modules`/`.next`) depuis ta machine, pas de repo distant. Les
  provisioners ne rejouent que si l'instance est recréée ; pour redéployer sans
  recréer la VM → `terraform taint openstack_compute_instance_v2.app` puis
  `apply`, ou `ssh` + `docker compose up` à la main.
- Un seul environnement. Pour multi-env / CI/CD → post-hackathon.
