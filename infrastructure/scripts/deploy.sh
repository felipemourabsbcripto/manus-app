#!/bin/bash
# ============================================================
# Manus App - AWS Production Deployment Script
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="manus-app-prod"
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="production"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
}

# Create or update key pair
setup_key_pair() {
    print_status "Setting up EC2 key pair..."
    
    KEY_NAME="manus-app-key"
    KEY_FILE="${KEY_NAME}.pem"
    
    # Check if key pair exists
    if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &> /dev/null; then
        print_warning "Key pair '$KEY_NAME' already exists"
    else
        # Create new key pair
        aws ec2 create-key-pair \
            --key-name "$KEY_NAME" \
            --query 'KeyMaterial' \
            --output text \
            --region "$REGION" > "$KEY_FILE"
        
        chmod 400 "$KEY_FILE"
        print_success "Key pair created and saved to $KEY_FILE"
    fi
}

# Validate CloudFormation template
validate_template() {
    print_status "Validating CloudFormation template..."
    
    TEMPLATE_FILE="$(dirname "$0")/../cloudformation/main.yaml"
    
    if [ ! -f "$TEMPLATE_FILE" ]; then
        print_error "Template file not found: $TEMPLATE_FILE"
        exit 1
    fi
    
    aws cloudformation validate-template \
        --template-body "file://$TEMPLATE_FILE" \
        --region "$REGION" > /dev/null
    
    print_success "Template validation passed!"
}

# Deploy CloudFormation stack
deploy_stack() {
    print_status "Deploying CloudFormation stack..."
    
    TEMPLATE_FILE="$(dirname "$0")/../cloudformation/main.yaml"
    
    # Generate random password for RDS
    DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        print_status "Stack exists. Updating..."
        
        aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$TEMPLATE_FILE" \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="$STACK_NAME" \
                ParameterKey=DBPassword,ParameterValue="$DB_PASSWORD" \
                ParameterKey=KeyName,ParameterValue="manus-app-key" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION" || true
        
        print_status "Waiting for stack update to complete..."
        aws cloudformation wait stack-update-complete \
            --stack-name "$STACK_NAME" \
            --region "$REGION" 2>/dev/null || true
    else
        print_status "Creating new stack..."
        
        aws cloudformation create-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$TEMPLATE_FILE" \
            --parameters \
                ParameterKey=EnvironmentName,ParameterValue="$STACK_NAME" \
                ParameterKey=DBPassword,ParameterValue="$DB_PASSWORD" \
                ParameterKey=KeyName,ParameterValue="manus-app-key" \
            --capabilities CAPABILITY_NAMED_IAM \
            --region "$REGION"
        
        print_status "Waiting for stack creation to complete..."
        print_warning "This may take 15-20 minutes..."
        
        aws cloudformation wait stack-create-complete \
            --stack-name "$STACK_NAME" \
            --region "$REGION"
    fi
    
    # Save DB password to secrets manager
    aws secretsmanager create-secret \
        --name "${STACK_NAME}/db-password" \
        --secret-string "$DB_PASSWORD" \
        --region "$REGION" 2>/dev/null || \
    aws secretsmanager update-secret \
        --secret-id "${STACK_NAME}/db-password" \
        --secret-string "$DB_PASSWORD" \
        --region "$REGION" 2>/dev/null || true
    
    print_success "Stack deployment completed!"
}

# Get stack outputs
get_outputs() {
    print_status "Getting stack outputs..."
    
    echo ""
    echo "============================================="
    echo "         DEPLOYMENT INFORMATION"
    echo "============================================="
    
    # Get Load Balancer URL
    LB_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerURL'].OutputValue" \
        --output text \
        --region "$REGION")
    
    # Get RDS Endpoint
    RDS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='RDSEndpoint'].OutputValue" \
        --output text \
        --region "$REGION")
    
    # Get ASG Name
    ASG_NAME=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" \
        --output text \
        --region "$REGION")
    
    echo ""
    echo "Application URL: $LB_URL"
    echo "Database Endpoint: $RDS_ENDPOINT"
    echo "Auto Scaling Group: $ASG_NAME"
    echo ""
    echo "============================================="
    
    print_success "Deployment complete!"
}

# Test the deployment
test_deployment() {
    print_status "Testing deployment..."
    
    LB_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerURL'].OutputValue" \
        --output text \
        --region "$REGION")
    
    # Wait for instances to be healthy
    print_status "Waiting for instances to become healthy (this may take a few minutes)..."
    sleep 60
    
    # Test API endpoint
    print_status "Testing API endpoint..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${LB_URL}/api/funcionarios" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "API is responding correctly!"
    else
        print_warning "API returned HTTP $HTTP_CODE. Application may still be starting up."
    fi
}

# Main execution
main() {
    echo ""
    echo "============================================="
    echo "    Manus App - AWS Production Deployment"
    echo "============================================="
    echo ""
    
    check_prerequisites
    setup_key_pair
    validate_template
    deploy_stack
    get_outputs
    test_deployment
    
    echo ""
    print_success "Deployment process completed successfully!"
    echo ""
}

# Run main function
main "$@"
