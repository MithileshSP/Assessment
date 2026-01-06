# Deployment Guide

This project is containerized using Docker Compose for easy deployment. It handles the Database, Backend (API), and Frontend (UI) as separate services.

## Prerequisites

- Docker
- Docker Compose

## Quick Start (Deploying)

1.  **Clone the repository** (if you haven't already).
2.  **Ensure `.env` files are present** (create from examples or backups if needed).
3.  **Build and Run**:

    ```bash
    docker-compose up -d --build
    ```

    - `-d`: Runs in detached mode (background).
    - `--build`: Rebuilds the images to include the latest code changes. **This is required** whenever you modify code, as the source code is copied *into* the container images.

### Alternative: Deploy Using Docker Hub Images

You can pull the pre-built images directly from Docker Hub without building locally.

1.  **Pull the images**:
    ```bash
    docker pull gokulv456/assessment-frontend
    docker pull gokulv456/assessment-backend
    ```

2.  **To deploy on a fresh server** (e.g., `192.168.10.5`), you **only** need to copy these **2 items**:

    1.  **`docker-compose.yml`** (Updated to use Hub images)
    2.  **`.env`** (Or your separate `backend/.env` / `frontend/.env` files)

    **What is NOT needed:**
    *   `frontend/` & `backend/` folders (Code is in the images)
    *   `mysql-init/` folder (The database schema is baked into `gokulv456/assessment-mysql`)
    *   `nginx.conf` (Baked into the frontend image)

3.  **Run with Pulled Images**:
    ```bash
    docker-compose up -d
    ```

4.  **Access the Application**:

    - **Localhost**: [http://localhost:100](http://localhost:100)
    - **Local Network**: `http://<YOUR_IP>:100` (e.g., `http://192.168.10.5:100`)

## How IP Switching Works (Automatic)

You **do not** need to change any configuration to switch between `localhost` and your server IP (e.g., `192.168.10.5`).

- The Frontend is served by Nginx.
- It is configured to send all API requests (starting with `/api`) to the Backend container internally.
- The browser uses a **relative path** (e.g., `/api/login` instead of `http://localhost:7000/api/login`).
- This means whatever URL you use to access the site (localhost or IP) is automatically used for the API calls too.

## Troubleshooting

-   **Check Logs**:
    ```bash
    docker-compose logs -f
    ```
-   **Restart Services**:
    ```bash
    docker-compose restart
    ```
-   **Stop and Remove**:
    ```bash
    docker-compose down
    ```
