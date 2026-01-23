#!/bin/bash
# ============================================================
# Manus App - Auto Scaling Management Script
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

# Get ASG name from CloudFormation
get_asg_name() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" \
        --output text \
        --region "$REGION"
}

# Show current scaling status
status() {
    print_status "Getting Auto Scaling Group status..."
    
    ASG_NAME=$(get_asg_name)
    
    if [ -z "$ASG_NAME" ] || [ "$ASG_NAME" = "None" ]; then
        print_error "Auto Scaling Group not found. Is the stack deployed?"
        exit 1
    fi
    
    echo ""
    echo "============================================="
    echo "      AUTO SCALING GROUP STATUS"
    echo "============================================="
    
    aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].{
            Name: AutoScalingGroupName,
            MinSize: MinSize,
            MaxSize: MaxSize,
            DesiredCapacity: DesiredCapacity,
            InstanceCount: length(Instances),
            HealthyInstances: length(Instances[?HealthStatus==`Healthy`])
        }' \
        --output table
    
    echo ""
    echo "Instances:"
    echo ""
    
    aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].Instances[*].{
            InstanceId: InstanceId,
            HealthStatus: HealthStatus,
            LifecycleState: LifecycleState,
            AZ: AvailabilityZone
        }' \
        --output table
    
    echo ""
    echo "============================================="
}

# Scale up
scale_up() {
    local COUNT=${1:-1}
    
    print_status "Scaling up by $COUNT instance(s)..."
    
    ASG_NAME=$(get_asg_name)
    
    # Get current desired capacity
    CURRENT=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].DesiredCapacity' \
        --output text)
    
    NEW_CAPACITY=$((CURRENT + COUNT))
    
    # Get max size
    MAX_SIZE=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].MaxSize' \
        --output text)
    
    if [ "$NEW_CAPACITY" -gt "$MAX_SIZE" ]; then
        print_warning "New capacity ($NEW_CAPACITY) exceeds max size ($MAX_SIZE)"
        NEW_CAPACITY=$MAX_SIZE
    fi
    
    aws autoscaling set-desired-capacity \
        --auto-scaling-group-name "$ASG_NAME" \
        --desired-capacity "$NEW_CAPACITY" \
        --region "$REGION"
    
    print_success "Scaled up! New desired capacity: $NEW_CAPACITY"
}

# Scale down
scale_down() {
    local COUNT=${1:-1}
    
    print_status "Scaling down by $COUNT instance(s)..."
    
    ASG_NAME=$(get_asg_name)
    
    # Get current desired capacity
    CURRENT=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].DesiredCapacity' \
        --output text)
    
    NEW_CAPACITY=$((CURRENT - COUNT))
    
    # Get min size
    MIN_SIZE=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "$ASG_NAME" \
        --region "$REGION" \
        --query 'AutoScalingGroups[0].MinSize' \
        --output text)
    
    if [ "$NEW_CAPACITY" -lt "$MIN_SIZE" ]; then
        print_warning "New capacity ($NEW_CAPACITY) is below min size ($MIN_SIZE)"
        NEW_CAPACITY=$MIN_SIZE
    fi
    
    aws autoscaling set-desired-capacity \
        --auto-scaling-group-name "$ASG_NAME" \
        --desired-capacity "$NEW_CAPACITY" \
        --region "$REGION"
    
    print_success "Scaled down! New desired capacity: $NEW_CAPACITY"
}

# Set specific capacity
set_capacity() {
    local CAPACITY=$1
    
    if [ -z "$CAPACITY" ]; then
        print_error "Please specify the desired capacity"
        exit 1
    fi
    
    print_status "Setting desired capacity to $CAPACITY..."
    
    ASG_NAME=$(get_asg_name)
    
    aws autoscaling set-desired-capacity \
        --auto-scaling-group-name "$ASG_NAME" \
        --desired-capacity "$CAPACITY" \
        --region "$REGION"
    
    print_success "Desired capacity set to $CAPACITY"
}

# Update scaling limits
update_limits() {
    local MIN=$1
    local MAX=$2
    
    if [ -z "$MIN" ] || [ -z "$MAX" ]; then
        print_error "Please specify both min and max size"
        echo "Usage: $0 limits <min> <max>"
        exit 1
    fi
    
    print_status "Updating scaling limits to min=$MIN, max=$MAX..."
    
    ASG_NAME=$(get_asg_name)
    
    aws autoscaling update-auto-scaling-group \
        --auto-scaling-group-name "$ASG_NAME" \
        --min-size "$MIN" \
        --max-size "$MAX" \
        --region "$REGION"
    
    print_success "Scaling limits updated!"
}

# Show scaling activities
activities() {
    print_status "Getting recent scaling activities..."
    
    ASG_NAME=$(get_asg_name)
    
    echo ""
    echo "============================================="
    echo "      RECENT SCALING ACTIVITIES"
    echo "============================================="
    
    aws autoscaling describe-scaling-activities \
        --auto-scaling-group-name "$ASG_NAME" \
        --max-items 10 \
        --region "$REGION" \
        --query 'Activities[*].{
            Activity: Description,
            Status: StatusCode,
            StartTime: StartTime,
            Cause: Cause
        }' \
        --output table
    
    echo ""
}

# Show help
show_help() {
    echo ""
    echo "Manus App - Auto Scaling Management"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  status            Show current Auto Scaling Group status"
    echo "  scale-up [n]      Scale up by n instances (default: 1)"
    echo "  scale-down [n]    Scale down by n instances (default: 1)"
    echo "  set <capacity>    Set specific desired capacity"
    echo "  limits <min> <max> Update min/max scaling limits"
    echo "  activities        Show recent scaling activities"
    echo "  help              Show this help message"
    echo ""
}

# Main execution
case "${1:-status}" in
    status)
        status
        ;;
    scale-up|up)
        scale_up "${2:-1}"
        ;;
    scale-down|down)
        scale_down "${2:-1}"
        ;;
    set)
        set_capacity "$2"
        ;;
    limits)
        update_limits "$2" "$3"
        ;;
    activities)
        activities
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
