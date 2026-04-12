# Configuração de Segurança (IAM)

Como você acabou de criar sua conta AWS, precisaremos de um **Usuário IAM** específico para que o GitHub Actions possa fazer o deploy sem usar sua conta raiz (root), seguindo as melhores práticas de segurança.

## Passo 1: Criar Usuário no Console AWS
1. No Console AWS, procure por **IAM**.
2. Vá em **Users** > **Create user**.
3. Nome: `github-deployer-enap`.
4. **NÃO** marque "Provide user access to the AWS Management Console" (este usuário será apenas para API).

## Passo 2: Definir Permissões
1. Na tela de permissões, escolha **Attach policies directly**.
2. Clique em **Create policy**.
3. Clique na aba **JSON** e cole o conteúdo abaixo:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:ListBucket",
                "s3:DeleteObject",
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::SEU-BUCKET-NAME",
                "arn:aws:s3:::SEU-BUCKET-NAME/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetInvalidation",
                "cloudfront:ListDistributions"
            ],
            "Resource": "*"
        }
    ]
}
```
*Substitua `SEU-BUCKET-NAME` pelo nome que você escolher para o bucket.*

4. Salve como `DeployerPolicyEnap`.
5. Volte à criação do usuário, selecione esta política e finalize.

## Passo 3: Gerar Chaves de Acesso
1. Clique no nome do usuário criado (`github-deployer-enap`).
2. Vá na aba **Security credentials**.
3. Clique em **Create access key**.
4. Escolha **Command Line Interface (CLI)**.
5. Copie a **Access Key ID** e a **Secret Access Key**.

> [!IMPORTANT]
> Você precisará dessas chaves para configurar os **Secrets** no seu repositório GitHub (AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY).