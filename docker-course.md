

### **Intro and Course Overview**
* **Course Structure**: Combines conceptual theoretical explanations with hands-on practical demonstrations.
* **Core Goal**: Covers what Docker is, the problems it solves, key architectural differences compared to virtual machines, basic administration, local development workflows, containerizing applications, image registries, production deployment, and persistent data storage.
* **Workflow Preview**: Covers building a Node.js web application, connecting it to a MongoDB database, running multi-container stacks with Docker Compose, packaging custom images with Dockerfiles, publishing images to Amazon ECR, deploying containers, and persisting state with Docker Volumes.

---

### **What is Docker?**
* **Concept & Definition**: A tool to package applications along with all their dependencies, configuration files, and libraries into a single portable, isolated artifact.
* **Traditional Setup Issues**:
  * Manual OS-level installation of service binaries (e.g., PostgreSQL, Redis) on local machines.
  * OS-specific installation differences across developer machines.
  * Multi-step installation processes prone to environment configuration errors.
  * Tedious environment setups when managing applications with numerous dependencies.
* **Docker Solutions**:
  * Eliminates local OS service installations; applications run in isolated operating system layers.
  * Standardizes environment startup down to a single Docker command regardless of the host OS.
  * Supports running multiple conflicting versions of the same service concurrently on one machine without version overlap.
* **Container Repositories**:
  * **Public Repositories**: Docker Hub hosts over 100,000 official and community application images (e.g., Jenkins, Postgres).
  * **Private Repositories**: Organizations host private registries to securely store proprietary application artifacts.

---

### **What is a Container?**
* **Technical Anatomy**: Containers consist of stacked image layers. The base layer is typically a lightweight Linux distribution (e.g., Alpine Linux) to maintain a minimal container size.
* **Image vs. Container**:
  * **Image**: The executable package/artifact containing application code, configurations, system libraries, and dependencies. It is a static blueprint that can be shared across teams.
  * **Container**: The active, isolated runtime environment instantiated from an image.
* **Layer Caching**: Images are split into independent download layers. When updating or downloading new versions of an image, Docker reuses existing cached layers shared between versions, saving bandwidth and pull time.
* **Runtime Isolation**: Each container possesses its own virtualized filesystem, environment variable space, and network interface isolated from the host.

---

### **Docker vs. Virtual Machine**
* **Operating System Layers**:
  * **OS Kernel**: Interacts directly with underlying hardware (CPU, RAM).
  * **Applications Layer**: Runs on top of the kernel (GUI, libraries, binaries).
* **Virtualization Comparison**:
  * **Virtual Machines (VMs)**: Virtualize the entire hardware and OS stack. Each VM runs its own dedicated guest OS kernel alongside the application layer.
  * **Docker Containers**: Virtualize only the application layer. Containers share the host operating system kernel directly, making them much more lightweight.
* **Key Differences**:
  * **Size**: Docker images are megabytes in size vs. gigabytes for VM images.
  * **Startup Speed**: Containers boot near-instantly, whereas VMs require booting a full operating system kernel.
  * **Kernel Compatibility**: Docker containers require host kernel compatibility. Linux-based containers require a Linux kernel or a lightweight Linux VM wrapper on non-Linux operating systems.

---

### **Docker Installation**
* **Editions**: Docker offers Community Edition (CE) for free/open use and Enterprise Edition.
* **Operating System Requirements**:
  * **macOS**: Requires modern macOS versions and at least 4 GB of RAM. Installs Docker Engine, Docker CLI, and Docker Compose as a bundle.
  * **Windows**: Docker Desktop natively requires Windows 10 with hardware virtualization enabled in BIOS/Task Manager.
  * **Legacy Systems**: Windows versions prior to 10 or older Macs use **Docker Toolbox**, which installs Oracle VM VirtualBox as an OS bridge.
* **Linux Installation**:
  * Configured via distribution package managers (e.g., `apt` on Ubuntu/Debian).
  * Requires setting up official Docker GPG keys and stable software repositories prior to installing `docker-ce`.
* **Installation Verification**: Verify setup by running `docker run hello-world`.

---

### **Docker Commands**
* **Image Management**:
  * `docker pull <image>:<tag>` — Fetches an image from Docker Hub without running it.
  * `docker images` — Lists all locally available images, their tags, and disk size.
* **Container Lifecycle**:
  * `docker run <image>` — Pulls (if missing) and executes a new container instance.
  * `docker run -d <image>` — Runs the container in **detached mode** (background process).
  * `docker run -p <host_port>:<container_port> <image>` — Binds a port on the host machine to a port inside the container to make services accessible externally.
  * `docker run --name <custom_name> <image>` — Assigns a human-readable name to the container instance.
  * `docker ps` — Displays currently active/running containers.
  * `docker ps -a` — Displays all containers, including stopped ones.
  * `docker stop <container_id/name>` — Gracefully stops a running container.
  * `docker start <container_id/name>` — Restarts a previously stopped container instance using its existing configuration.
* **Key Distinctions**:
  * `docker run` creates a **new** container instance from an image.
  * `docker start` re-executes an **existing**, stopped container instance.

---

### **Debugging a Container**
* **Inspection Commands**:
  * `docker logs <container_id/name>` — Prints stdout/stderr log output produced by the containerized application.
  * `docker logs -f <container_id/name>` — Streams logs in real-time.
  * `docker logs --tail <number> <container_id/name>` — Views only the last lines of container log history.
* **Interactive Terminal Access**:
  * `docker exec -it <container_id/name> /bin/bash` (or `/bin/sh`) — Spawns an interactive terminal shell inside a running container.
  * Allows navigating the container's virtual filesystem, verifying environment variables using `env`, and checking internal paths.

---

### **Demo Project Overview – Docker in Practice**
* **Software Development Lifecycle Integration**:
  1. **Development**: Developer codes locally, running dependent databases/services as Docker containers.
  2. **Continuous Integration (CI)**: Code commits trigger a build tool (e.g., Jenkins) that compiles the app and packages it into a Docker image.
  3. **Registry Storage**: Jenkins pushes the newly constructed Docker image to a secure private container registry.
  4. **Deployment**: Staging/production servers pull the application image from the private repository alongside public dependency containers (e.g., MongoDB) to run the application.

---

### **Developing with Containers**
* **Demo Application Stack**: Node.js/Express backend serving a front-end UI, backed by a MongoDB container and a Mongo Express web-based database UI container.
* **Docker Networking**:
  * Containers run in isolated virtual networks created by Docker.
  * `docker network create <network_name>` creates a custom bridge network.
  * Containers connected to the same custom Docker network communicate directly using **container names** as hostnames without needing `localhost` or port mappings.
* **Environment Configuration**:
  * `-e MONGO_INITDB_ROOT_USERNAME=admin` and `-e MONGO_INITDB_ROOT_PASSWORD=password` pass environment flags during startup.
* **Database Connection Strings**:
  * Applications running inside the Docker network connect via `mongodb://admin:password@mongodb:27017/` where `mongodb` is the container name.

---

### **Docker Compose – Running Multiple Services**
* **Purpose**: Replaces executing multiple verbose `docker run` commands with a single declarative configuration file (`docker-compose.yaml`).
* **YAML Syntax & Structure**:
  * `version`: Schema version (e.g., `'3'`).
  * `services`: Outlines each container instance, specifying `image`, `ports`, `environment` variables, and container startup options.
* **Automatic Networking**: Docker Compose automatically creates a shared default network for all services listed in the file.
* **CLI Commands**:
  * `docker-compose -f <filename.yaml> up` — Creates and starts all defined containers.
  * `docker-compose -f <filename.yaml> up -d` — Starts the stack in detached background mode.
  * `docker-compose -f <filename.yaml> down` — Stops containers and cleans up the associated network.

---

### **Dockerfile – Building Our Own Docker Image**
* **Definition**: A text manifest containing instructions to build a custom Docker image layer by layer.
* **Core Directives**:
  * `FROM <image>:<tag>` — Defines the parent base image (e.g., `FROM node:13-alpine`).
  * `ENV <key>=<value>` — Sets persistent environment variables inside the image.
  * `RUN <command>` — Executes build-time shell commands to construct image layers (e.g., `RUN mkdir -p /home/app`).
  * `COPY <host_path> <container_path>` — Copies local source files into the container image filesystem.
  * `CMD ["executable", "param"]` — Defines the default runtime entry-point command executed when the container starts (e.g., `CMD ["node", "server.js"]`).
* **Build & Cleanup Commands**:
  * `docker build -t <image_name>:<tag> .` — Compiles a Dockerfile in the current directory into an image.
  * `docker rm <container_id>` — Deletes a stopped container instance.
  * `docker rmi <image_id>` — Deletes a local image.

---

### **Private Docker Repository – Pushing Our Image to AWS ECR**
* **Amazon ECR Setup**: AWS Elastic Container Registry stores private Docker images per repository name.
* **Registry Image Naming Convention**:
  * Private images require a full domain path: `<registry_domain>/<repository_name>:<tag>`.
* **Publishing Workflow**:
  1. **Authentication**: Authenticate local Docker client with AWS ECR (`aws ecr get-login-password | docker login ...`).
  2. **Image Tagging**: Re-tag local image to match the target registry endpoint:
     `docker tag my-app:1.0 <aws_account_id>.dkr.ecr.<region>.amazonaws.com/my-app:1.0`.
  3. **Pushing**: Upload the tagged image layers to ECR:
     `docker push <full_image_name>:<tag>`.
  4. **Layer Optimization**: Modified builds upload only updated layers while reusing unchanged base layers.

---

### **Deploy Our Containerized App**
* **Deployment Architecture**:
  * Staging/Production servers authenticate to the private registry using `docker login`.
  * Public dependencies (MongoDB, Mongo Express) pull automatically from Docker Hub; custom app images pull securely from AWS ECR.
* **Execution**: Deployment is triggered via `docker-compose -f mongo.yaml up -d`.
* **Inter-Container Communication**: Containers route traffic to each other across the shared Compose network using internal service names as DNS hostnames.

---

### **Docker Volumes – Persist Data in Docker**
* **The Ephemeral Problem**: Container virtual filesystems are temporary. Stopping or destroying a container completely wipes its internal data state.
* **Volume Architecture**:
  * Docker Volumes mount a directory on the host machine's physical storage into a virtual path inside the container.
  * Bidirectional synchronization ensures data written by the container persists on the host machine across container recreations.
* **Volume Types**:
  * **Host Volumes**: Directly mounts a user-specified host directory (`-v /path/on/host:/path/in/container`).
  * **Anonymous Volumes**: Docker automatically manages an unnamed directory under `/var/lib/docker/volumes/`.
  * **Named Volumes**: Docker manages host path storage under `/var/lib/docker/volumes/<volume_name>/_data`, referenced by a named alias. **Recommended for production environments**.

---

### **Volumes Demo – Configure Persistence for Demo Project**
* **Compose Volume Configuration**:
  * Declare top-level `volumes:` key in `docker-compose.yaml` (e.g., `mongo-data:`).
  * Map named volume under service configuration to MongoDB's internal data storage path:
    `volumes: - mongo-data:/data/db`.
* **Verification**: Running `docker-compose down` followed by `docker-compose up` retains all database records, collections, and configurations intact.
* **Physical Storage Paths by OS**:
  * **Linux**: `/var/lib/docker/volumes/<volume_name>/_data`.
  * **Windows**: `C:\ProgramData\Docker\volumes\<volume_name>\_data`.
  * **macOS**: Managed inside Docker Desktop's lightweight virtual machine storage space.

---

### **Wrap Up**
* **Course Conclusion**: Summarizes the path from foundational containerization to multi-container deployment and persistence.
* **Next Steps**: Managing production deployments across large server clusters requires container orchestration tools like **Kubernetes** to automate scaling, self-healing, load balancing, and multi-node container management.

---

Would you like me to turn this handout into a study guide report or generate a quick flashcard deck to test your knowledge on these Docker commands and concepts?