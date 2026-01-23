#!/bin/bash
# ============================================================
# Manus App - Destroy AWS Infrastructure
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

STACK_NAME="manus-app-prod"
REGION="${AWS_REGION:-us-east-1}"

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

# Confirm destruction
confirm_destroy() {
    echo ""
    echo "============================================="
    echo "    ⚠️  WARNING: DESTRUCTIVE OPERATION"
    echo "============================================="
    echo ""
    echo "This will DELETE all production resources:"
    echo "  - VPC and all networking"
    echo "  - Load Balancer"
    echo "  - Auto Scaling Group and EC2 instances"
    echo "  - RDS Database (data will be LOST)"
    echo "  - All CloudWatch alarms"
    echo ""
    print_warning "This action cannot be undone!"
    echo ""
    
    read -p "Type 'destroy' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "destroy" ]; then
        print_status "Operation cancelled"
        exit 0
    fi
}

# Delete secrets
delete_secrets() {
    print_status "Deleting secrets from Secrets Manager..."
    
    aws secretsmanager delete-secret \
        --secret-id "${STACK_NAME}/db-password" \
        --force-delete-without-recovery \
        --region "$REGION" 2>/dev/null || true
    
    print_success "Secrets deleted"
}

# Delete CloudFormation stack
delete_stack() {
    print_status "Deleting CloudFormation stack..."
    
    # Check if stack exists
    if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null; then
        print_warning "Stack '$STACK_NAME' does not exist"
        return 0
    fi
    
    # Delete the stack
    aws cloudformation delete-stack \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    print_status "Waiting for stack deletion to complete..."
    print_warning "This may take 10-15 minutes..."
    
    aws cloudformation wait stack-delete-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
    
    print_success "Stack deleted successfully!"
}

# Delete key pair (optional)
delete_key_pair() {
    read -p "Delete the key pair 'manus-app-key'? (y/N): " DELETE_KEY
    
    if [ "$DELETE_KEY" = "y" ] || [ "$DELETE_KEY" = "Y" ]; then
        aws ec2 delete-key-pair \
            --key-name "manus-app-key" \
            --region "$REGION" 2>/dev/null || true
        
        print_success "Key pair deleted"
    fi
}

# Main execution
main() {
    echo ""
    echo "============================================="
    echo "    Manus App - Destroy Infrastructure"
    echo "============================================="
    echo ""
    
    confirm_destroy
    echo ""
    
    delete_secrets
    delete_stack
    delete_key_pair
    
    echo ""
    print_success "All resources have been deleted!"
    echo ""
}

main "$@"
