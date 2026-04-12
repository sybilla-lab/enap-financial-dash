#!/bin/bash

# Abortar em caso de erro
set -e

echo "🚀 Iniciando deploy para AWS S3 + CloudFront..."

# 1. Carregar variáveis (ou usar via ambiente)
BUCKET_NAME=${AWS_S3_BUCKET_NAME}
DISTRIBUTION_ID=${AWS_CLOUDFRONT_DISTRIBUTION_ID}

if [ -z "$BUCKET_NAME" ]; then
    echo "❌ Erro: AWS_S3_BUCKET_NAME não definida."
    exit 1
fi

# 2. Build Angular
echo "📦 Gerando build de produção (base-href=/)..."
npm run build:prod

# 3. Preparar index.html (Angular 18 application builder fix)
# O build do Angular 18 gera index.csr.html se SSR/Prerender estiver ativo, 
# mas no S3 estático precisamos dele como index.html
if [ -f "dist/fincontrol/browser/index.csr.html" ]; then
    echo "🔧 Ajustando index.csr.html para index.html..."
    cp dist/fincontrol/browser/index.csr.html dist/fincontrol/browser/index.html
fi

# 4. Upload para S3
echo "☁️ Sincronizando arquivos com o bucket S3: $BUCKET_NAME..."
aws s3 sync dist/fincontrol/browser/ s3://$BUCKET_NAME/ --delete

# 5. Invalidar Cache CloudFront
if [ -n "$DISTRIBUTION_ID" ]; then
    echo "🧹 Invalidando cache do CloudFront..."
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
else
    echo "⚠️ Aviso: DISTRIBUTION_ID não fornecida. Cache não invalidado."
fi

echo "✅ Deploy finalizado com sucesso!"
