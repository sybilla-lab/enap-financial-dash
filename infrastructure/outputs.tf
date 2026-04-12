output "s3_bucket_name" {
  value = aws_s3_bucket.website_bucket.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.website_cdn.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.website_cdn.id
}

output "name_servers" {
  description = "Copie estes endereços e cole no painel do Registro.br"
  value       = aws_route53_zone.main.name_servers
}
