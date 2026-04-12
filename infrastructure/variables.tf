variable "aws_region" {
  description = "Região da AWS"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Nome único do bucket S3 para o frontend"
  type        = string
}

variable "domain_name" {
  description = "Domínio principal da aplicação"
  type        = string
  default     = "sybillalabs.com.br"
}
