# AWS Infrastructure - Manus App

Este diretório contém toda a infraestrutura como código (IaC) para deploy do Manus App em ambiente de produção na AWS.

## Arquitetura

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                          VPC                                │
                    │  ┌──────────────────────────────────────────────────────┐  │
                    │  │                    Public Subnets                      │  │
                    │  │  ┌─────────────────┐    ┌─────────────────┐           │  │
        Internet ───┼──┼─▶│   ALB (HTTP)    │    │   NAT Gateway   │           │  │
                    │  │  └────────┬────────┘    └────────┬────────┘           │  │
                    │  └───────────┼──────────────────────┼────────────────────┘  │
                    │              ▼                      ▼                       │
                    │  ┌───────────────────────────────────────────────────────┐  │
                    │  │                   Private Subnets                      │  │
                    │  │  ┌──────────────────────────────────────────────────┐ │  │
                    │  │  │            Auto Scaling Group                     │ │  │
                    │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │  │
                    │  │  │  │   EC2    │  │   EC2    │  │   EC2    │  ...   │ │  │
                    │  │  │  │ Node.js  │  │ Node.js  │  │ Node.js  │        │ │  │
                    │  │  │  └──────────┘  └──────────┘  └──────────┘        │ │  │
                    │  │  └──────────────────────────────────────────────────┘ │  │
                    │  │                         │                              │  │
                    │  │                         ▼                              │  │
                    │  │              ┌─────────────────────┐                   │  │
                    │  │              │   RDS PostgreSQL    │                   │  │
                    │  │              │     (Multi-AZ)      │                   │  │
                    │  │              └─────────────────────┘                   │  │
                    │  └────────────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────────────┘
```

## Recursos Criados

- **VPC** com subnets públicas e privadas em 2 AZs
- **Application Load Balancer** para distribuição de tráfego
- **Auto Scaling Group** com políticas de scaling baseadas em CPU e requests
- **RDS PostgreSQL** com Multi-AZ para alta disponibilidade
- **NAT Gateway** para acesso à internet pelas instâncias privadas
- **Security Groups** configurados seguindo o princípio de menor privilégio
- **CloudWatch Alarms** para monitoramento e alertas

## Pré-requisitos

1. **AWS CLI** instalada e configurada:
   ```bash
   aws configure
   ```

2. **Credenciais IAM** com permissões para:
   - CloudFormation
   - EC2 (VPC, Subnets, Security Groups, EC2, ALB, ASG)
   - RDS
   - IAM (criar roles e policies)
   - CloudWatch
   - Secrets Manager

3. **jq** instalado (para scripts de monitoramento):
   ```bash
   brew install jq
   ```

## Deploy

### Deploy Completo

```bash
cd infrastructure/scripts
chmod +x *.sh
./deploy.sh
```

O script irá:
1. Verificar pré-requisitos
2. Criar/verificar key pair EC2
3. Validar template CloudFormation
4. Criar ou atualizar o stack
5. Mostrar URLs e endpoints

### Deploy Manual (CloudFormation)

```bash
aws cloudformation create-stack \
  --stack-name manus-app-prod \
  --template-body file://cloudformation/main.yaml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=SuaSenhaSegura123 \
    ParameterKey=KeyName,ParameterValue=manus-app-key \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

## Gerenciamento de Scaling

### Ver Status

```bash
./scale.sh status
```

### Scale Up/Down

```bash
# Adicionar 2 instâncias
./scale.sh scale-up 2

# Remover 1 instância
./scale.sh scale-down 1

# Definir capacidade específica
./scale.sh set 4
```

### Alterar Limites

```bash
# Min: 2, Max: 10
./scale.sh limits 2 10
```

### Ver Atividades de Scaling

```bash
./scale.sh activities
```

## Monitoramento

### Health Check Completo

```bash
./healthcheck.sh
```

### Verificações Específicas

```bash
./healthcheck.sh api     # Verificar API
./healthcheck.sh lb      # Verificar Load Balancer
./healthcheck.sh asg     # Verificar Auto Scaling
./healthcheck.sh rds     # Verificar Banco de Dados
./healthcheck.sh alarms  # Verificar Alarmes
```

## Destruir Infraestrutura

⚠️ **ATENÇÃO**: Isso irá deletar todos os recursos e dados!

```bash
./destroy.sh
```

## Parâmetros CloudFormation

| Parâmetro | Descrição | Default |
|-----------|-----------|---------|
| `EnvironmentName` | Prefixo para recursos | `manus-app-prod` |
| `InstanceType` | Tipo de instância EC2 | `t3.small` |
| `MinSize` | Mínimo de instâncias no ASG | `2` |
| `MaxSize` | Máximo de instâncias no ASG | `6` |
| `DesiredCapacity` | Capacidade desejada inicial | `2` |
| `KeyName` | Nome do key pair EC2 | `manus-app-key` |
| `DBInstanceClass` | Classe da instância RDS | `db.t3.micro` |
| `DBName` | Nome do banco de dados | `manusapp` |
| `DBUsername` | Usuário admin do banco | `dbadmin` |

## Setup de Domínio Personalizado

Para configurar o domínio `www.escalaprohscmbh.com.br`:

1. Os registros DNS foram criados na Hosted Zone do Route 53.
2. **AÇÃO NECESSÁRIA**: Configure os seguintes Nameservers no seu registrador de domínio:
   - `ns-560.awsdns-06.net`
   - `ns-1644.awsdns-13.co.uk`
   - `ns-1189.awsdns-20.org`
   - `ns-450.awsdns-56.com`
3. O certificado SSL será validado automaticamente após a propagação do DNS.
| `DBPassword` | Senha do banco (obrigatório) | - |

## Políticas de Auto Scaling

### CPU Target Tracking
- **Métrica**: ASGAverageCPUUtilization
- **Target**: 70%
- Adiciona instâncias quando CPU > 70%
- Remove instâncias quando CPU < 70%

### Request Count Target Tracking
- **Métrica**: ALBRequestCountPerTarget
- **Target**: 1000 req/target
- Escala baseado no número de requests por instância

## Alarmes CloudWatch

| Alarme | Descrição | Threshold |
|--------|-----------|-----------|
| `high-cpu` | CPU alta nas instâncias | > 80% |
| `high-memory` | Memória alta nas instâncias | > 80% |
| `unhealthy-hosts` | Hosts não saudáveis no ALB | >= 1 |

## Custos Estimados

| Recurso | Custo Mensal (aprox.) |
|---------|----------------------|
| EC2 t3.small (2x) | ~$30 |
| RDS db.t3.micro (Multi-AZ) | ~$30 |
| NAT Gateway | ~$32 + data |
| ALB | ~$20 + data |
| **Total (mínimo)** | **~$120/mês** |

*Nota: Custos podem variar com utilização e região.*

## Troubleshooting

### Stack Creation Failed

```bash
# Ver eventos do stack
aws cloudformation describe-stack-events \
  --stack-name manus-app-prod \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### Instâncias não passam no health check

1. Conectar via SSM:
   ```bash
   aws ssm start-session --target <instance-id>
   ```

2. Verificar logs:
   ```bash
   tail -f /root/.pm2/logs/manus-app-error.log
   ```

### RDS não acessível

1. Verificar security group
2. Verificar que EC2 está na subnet correta
3. Testar conectividade:
   ```bash
   nc -zv <rds-endpoint> 5432
   ```

## Contato

- **Desenvolvedor**: Felipe Moura
- **Repositório**: https://github.com/felipemourabsbcripto/manus-app
