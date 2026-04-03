#!/bin/bash

echo "========================================"
echo "OpenAgent Framework - Local Deployment"
echo "========================================"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "Please install Docker first"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed"
    echo "Please install Docker Compose first"
    exit 1
fi

# Stop old services
echo "[1/4] Stopping old services..."
docker-compose down 2>/dev/null

# Build and start services
echo "[2/4] Building and starting services..."
docker-compose up -d --build

# Wait for services to start
echo "[3/4] Waiting for services to start..."
sleep 10

# Check status
echo "[4/4] Checking service status..."
docker-compose ps

echo ""
echo "========================================"
echo "OpenAgent Framework is running!"
echo "========================================"
echo ""
echo "Services:"
echo "  - OpenAgent API:     http://localhost:3000"
echo "  - PostgreSQL:        localhost:5432"
echo "  - Redis:             localhost:6379"
echo ""
echo "Commands:"
echo "  - View logs:         docker-compose logs -f"
echo "  - Stop services:     docker-compose down"
echo "  - Restart:           docker-compose restart"
echo ""

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
fi

# Open browser (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 2>/dev/null || echo "Please open http://localhost:3000 in your browser"
fi
