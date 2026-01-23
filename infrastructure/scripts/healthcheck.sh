#!/bin/bash
# ============================================================
# Manus App - Health Check and Monitoring Script
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
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Check Load Balancer health
check_lb() {
    print_status "Checking Load Balancer..."
    
    # Get TG ARN
    TG_ARN=$(aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --logical-resource-id ALBTargetGroup \
        --query 'StackResources[0].PhysicalResourceId' \
        --output text \
        --region "$REGION" 2>/dev/null)
    
    if [ -z "$TG_ARN" ] || [ "$TG_ARN" = "None" ]; then
        print_error "Target Group not found"
        return 1
    fi
    
    # Get target health
    HEALTH=$(aws elbv2 describe-target-health \
        --target-group-arn "$TG_ARN" \
        --region "$REGION" \
        --query 'TargetHealthDescriptions[*].{
            Target: Target.Id,
            State: TargetHealth.State,
            Reason: TargetHealth.Reason
        }' \
        --output json)
    
    HEALTHY_COUNT=$(echo "$HEALTH" | jq '[.[] | select(.State == "healthy")] | length')
    TOTAL_COUNT=$(echo "$HEALTH" | jq 'length')
    
    if [ "$HEALTHY_COUNT" -eq "$TOTAL_COUNT" ] && [ "$TOTAL_COUNT" -gt 0 ]; then
        print_success "Load Balancer: $HEALTHY_COUNT/$TOTAL_COUNT targets healthy"
    else
        print_warning "Load Balancer: $HEALTHY_COUNT/$TOTAL_COUNT targets healthy"
    fi
    
    echo "$HEALTH" | jq -r '.[] | "  - \(.Target): \(.State) \(if .Reason then "(\(.Reason))" else "" end)"'
}

# Check RDS health
check_rds() {
    print_status "Checking RDS Database..."
    
    DB_INSTANCE=$(aws cloudformation describe-stack-resources \
        --stack-name "$STACK_NAME" \
        --logical-resource-id RDSInstance \
        --query 'StackResources[0].PhysicalResourceId' \
        --output text \
        --region "$REGION" 2>/dev/null)
    
    if [ -z "$DB_INSTANCE" ] || [ "$DB_INSTANCE" = "None" ]; then
        print_error "RDS instance not found"
        return 1
    fi
    
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$DB_INSTANCE" \
        --region "$REGION" \
        --query 'DBInstances[0].{
            Status: DBInstanceStatus,
            MultiAZ: MultiAZ,
            Storage: AllocatedStorage,
            Class: DBInstanceClass
        }' \
        --output json)
    
    DB_STATUS=$(echo "$STATUS" | jq -r '.Status')
    
    if [ "$DB_STATUS" = "available" ]; then
        print_success "RDS Database: available"
        echo "$STATUS" | jq -r '"  - MultiAZ: \(.MultiAZ)\n  - Storage: \(.Storage)GB\n  - Class: \(.Class)"'
    else
        print_warning "RDS Database: $DB_STATUS"
    fi
}

# Check ASG health
check_asg() {
    print_status "Checking Auto Scaling Group..."
    
    ASG_NAME=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" \
        --output text \
        --region "$REGION")
    
    if [ -z "$ASG_NAME" ] || [ "$ASG_NAME" = "None" ]; then
        print_error "Auto Scaling Group not found"
        return 1
    fi
    
    ASG_INFO=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0]' \
        --output json)
    
    DESIRED=$(echo "$ASG_INFO" | jq -r '.DesiredCapacity')
    RUNNING=$(echo "$ASG_INFO" | jq '[.Instances[] | select(.LifecycleState == "InService")] | length')
    HEALTHY=$(echo "$ASG_INFO" | jq '[.Instances[] | select(.HealthStatus == "Healthy")] | length')
    
    if [ "$RUNNING" -eq "$DESIRED" ] && [ "$HEALTHY" -eq "$DESIRED" ]; then
        print_success "Auto Scaling Group: $RUNNING/$DESIRED instances running, all healthy"
    else
        print_warning "Auto Scaling Group: $RUNNING/$DESIRED running, $HEALTHY healthy"
    fi
    
    echo "  - Min Size: $(echo "$ASG_INFO" | jq -r '.MinSize')"
    echo "  - Max Size: $(echo "$ASG_INFO" | jq -r '.MaxSize')"
    echo "  - Desired: $DESIRED"
}

# Check CloudWatch alarms
check_alarms() {
    print_status "Checking CloudWatch Alarms..."
    
    ALARMS=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "$STACK_NAME" \
        --region "$REGION" \
        --query 'MetricAlarms[*].{
            Name: AlarmName,
            State: StateValue,
            Metric: MetricName
        }' \
        --output json)
    
    ALARM_COUNT=$(echo "$ALARMS" | jq '[.[] | select(.State == "ALARM")] | length')
    TOTAL_ALARMS=$(echo "$ALARMS" | jq 'length')
    
    if [ "$ALARM_COUNT" -eq 0 ]; then
        print_success "CloudWatch Alarms: All $TOTAL_ALARMS alarms OK"
    else
        print_error "CloudWatch Alarms: $ALARM_COUNT of $TOTAL_ALARMS in ALARM state"
    fi
    
    echo "$ALARMS" | jq -r '.[] | "  - \(.Name): \(.State)"'
}

# Check API endpoint
check_api() {
    print_status "Checking API endpoint..."
    
    LB_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerURL'].OutputValue" \
        --output text \
        --region "$REGION")
    
    if [ -z "$LB_URL" ] || [ "$LB_URL" = "None" ]; then
        print_error "Load Balancer URL not found"
        return 1
    fi
    
    # Test health endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${LB_URL}/api/funcionarios" --connect-timeout 5 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "API endpoint: Responding (HTTP $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "000" ]; then
        print_error "API endpoint: Not reachable"
    else
        print_warning "API endpoint: HTTP $HTTP_CODE"
    fi
    
    echo "  - URL: $LB_URL"
}

# Run all checks
run_all_checks() {
    echo ""
    echo "============================================="
    echo "    MANUS APP - HEALTH CHECK REPORT"
    echo "============================================="
    echo "  Stack: $STACK_NAME"
    echo "  Region: $REGION"
    echo "  Time: $(date)"
    echo "============================================="
    echo ""
    
    check_api
    echo ""
    check_lb
    echo ""
    check_asg
    echo ""
    check_rds
    echo ""
    check_alarms
    
    echo ""
    echo "============================================="
    echo ""
}

# Show help
show_help() {
    echo ""
    echo "Manus App - Health Check Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all        Run all health checks (default)"
    echo "  api        Check API endpoint"
    echo "  lb         Check Load Balancer"
    echo "  asg        Check Auto Scaling Group"
    echo "  rds        Check RDS Database"
    echo "  alarms     Check CloudWatch Alarms"
    echo "  help       Show this help message"
    echo ""
}

# Main execution
case "${1:-all}" in
    all)
        run_all_checks
        ;;
    api)
        check_api
        ;;
    lb)
        check_lb
        ;;
    asg)
        check_asg
        ;;
    rds)
        check_rds
        ;;
    alarms)
        check_alarms
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
