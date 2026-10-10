# ==============================================================================
# INFRAESTRUCTURA MULTI-CLOUD: DESPLIEGUE EN AMAZON WEB SERVICES (AWS)
# Demostración de Cero Vendor Lock-in (Fozna Solutions)
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "sismos-centroamerica"
      Environment = "production"
      ManagedBy   = "Terraform-Fozna"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

# 1. Red y VPC Aislada en AWS
resource "aws_vpc" "sismos_vpc" {
  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "sismos-vpc-aws"
  }
}

# 2. Base de Datos Gestionada: Amazon RDS PostgreSQL 16 con PostGIS
resource "aws_db_subnet_group" "sismos_db_subnets" {
  name       = "sismos-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_db_instance" "postgres_postgis" {
  identifier             = "sismos-db-prod"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  db_name                = "sismos_db"
  username               = "sismos_app"
  password               = "ManagedBySecretsManager2026!"
  db_subnet_group_name   = aws_db_subnet_group.sismos_db_subnets.name
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = {
    Name = "sismos-postgres-postgis-aws"
  }
}

# 3. Clúster de Contenedores Elásticos: AWS ECS Fargate
resource "aws_ecs_cluster" "sismos_cluster" {
  name = "sismos-cluster-prod"
}

# 4. Tarea y Servicio Backend en Fargate (Equivalente exacto a Cloud Run en GCP)
resource "aws_ecs_task_definition" "backend_task" {
  family                   = "sismos-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"

  container_definitions = jsonencode([
    {
      name      = "sismos-backend"
      image     = "public.ecr.aws/fozna/sismos-backend:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
        }
      ]
      environment = [
        { name = "SPRING_PROFILES_ACTIVE", value = "aws-prod" },
        { name = "DB_HOST", value = aws_db_instance.postgres_postgis.address }
      ]
    }
  ])
}

# Subredes privadas de soporte
resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.sismos_vpc.id
  cidr_block        = "10.10.1.0/24"
  availability_zone = "${var.aws_region}a"
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.sismos_vpc.id
  cidr_block        = "10.10.2.0/24"
  availability_zone = "${var.aws_region}b"
}
