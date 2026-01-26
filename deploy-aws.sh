#!/bin/bash

# Configuration
APP_NAME="manus-app"
TIMESTAMP=$(date +%s)
BUCKET_NAME="manus-deploy-${TIMESTAMP}"
INSTANCE_NAME="ManusApp-Server"
REGION="sa-east-1"  # São Paulo

echo "🚀 Starting Deployment for $APP_NAME..."

# 1. Check Prerequisites
if ! command -v zip &> /dev/null; then
    echo "❌ Error: 'zip' is required."
    exit 1
fi
if ! command -v aws &> /dev/null; then
    echo "❌ Error: 'aws' CLI is required."
    exit 1
fi

# 2. Package Application
echo "📦 Zipping application..."
zip -q -r app.zip . -x "node_modules/*" -x ".git/*" -x "dist/*" -x "deploy-aws.sh"
echo "✅ Zip created: app.zip"

# 3. Upload to S3 (Temporary Storage)
echo "☁️  Creating S3 Bucket: $BUCKET_NAME..."
aws s3 mb s3://$BUCKET_NAME --region $REGION

echo "⬆️  Uploading app.zip..."
aws s3 cp app.zip s3://$BUCKET_NAME/app.zip

echo "🔗 Generating secure download link..."
PRE_SIGNED_URL=$(aws s3 presign s3://$BUCKET_NAME/app.zip --expires-in 3600 --region $REGION)

# 4. Create Lightsail Instance
echo "💡 Launching AWS Lightsail Instance ($INSTANCE_NAME)..."

# User Data Script: Runs on instance startup
USER_DATA="#!/bin/bash
# Log setup
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo 'Starting Setup...'
apt-get update
apt-get install -y docker.io unzip

echo 'Downloading App...'
curl \"$PRE_SIGNED_URL\" -o /home/ubuntu/app.zip

cd /home/ubuntu
unzip -q app.zip

echo 'Building Docker Image...'
docker build -t manus-app .

echo 'Running Container...'
# Map port 80 (HTTP) to 3000 (App)
docker run -d -p 80:3000 --restart always --name manus-app manus-app

echo 'Setup Complete!'
"

aws lightsail create-instances \
    --region $REGION \
    --instance-names $INSTANCE_NAME \
    --availability-zone ${REGION}a \
    --blueprint-id ubuntu_22_04 \
    --bundle-id micro_2_0 \
    --user-data "$USER_DATA"

echo ""
echo "✅ Deployment Triggered!"
echo "------------------------------------------------"
echo "Your instance '$INSTANCE_NAME' is starting up."
echo "It may take 5-10 minutes to install Docker and build."
echo ""
echo "To check IP address:"
echo "   aws lightsail get-instances --instance-names $INSTANCE_NAME"
echo ""
echo "⚠️  cleanup: Remember to delete s3://$BUCKET_NAME after deployment."
