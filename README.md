# Docker Hands-On Tutorial

Oct 6, 2026 · @Asim Riaz

## How to use this tutorial

By the end of these nine labs you will have built a Node.js + MongoDB app, packaged it into your own image, pushed it to a private registry, deployed it with Docker Compose, and made its data survive restarts. Each lab follows the same pattern: a short **Concept** recap, numbered **Steps** with commands to type, **Expected output** to check against, and a **Try it yourself** exercise.

### The project you will build

A small "User Profile" web app:

- **my-app** — Node.js/Express backend serving an HTML page where you can view and edit a profile
- **mongodb** — the database that stores the profile
- **mongo-express** — a web UI for browsing the database

All three run as containers on one Docker network.

### Lab environment

- One Linux machine per student (Debian/Ubuntu VM, LXD instance, or a laptop with Docker Desktop). Commands assume Debian/Ubuntu and a Bash shell.
- Roughly 4 GB RAM and 10 GB free disk.
- Internet access to pull images from Docker Hub.
- Lab 6 uses AWS ECR, which needs an AWS account. Students without one use the **local registry** track in the same lab — every later step works the same.
- A text editor (`nano`, `vim`, or VS Code).

### Conventions

- `$` at the start of a line is your shell prompt — do not type it.
- `<angle brackets>` are placeholders you replace.
- Modern Docker ships Compose as a plugin: `docker compose` (space). The older standalone `docker-compose` (hyphen) takes the same arguments. This tutorial uses `docker compose`; swap in the hyphen if your machine only has the old tool.

### Workspace

Create one folder for everything:

```bash
$ mkdir -p ~/docker-lab && cd ~/docker-lab
```

## Lab 0 — Install Docker and verify

**Goal:** a working Docker Engine, CLI, and Compose plugin, proven by running `hello-world`.

**Concept.** Docker Community Edition (CE) is free; Enterprise Edition adds paid support. On macOS and Windows you install **Docker Desktop**, which bundles the Engine, CLI, and Compose and runs Linux containers inside a small Linux VM (because Linux containers need a Linux kernel). Windows needs Windows 10+ with hardware virtualization enabled in BIOS; macOS needs at least 4 GB RAM. Very old systems used **Docker Toolbox** (VirtualBox-based), which is now retired. On Linux, Docker runs natively.

### Steps (Debian / Ubuntu)

1. Remove any old or distro-packaged versions:

```bash
$ for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove -y $pkg; done
```

2. Add Docker's official GPG key:

```bash
$ sudo apt-get update
$ sudo apt-get install -y ca-certificates curl
$ sudo install -m 0755 -d /etc/apt/keyrings
$ sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
$ sudo chmod a+r /etc/apt/keyrings/docker.asc
```

On Ubuntu, replace `debian` with `ubuntu` in the URL (here and in step 3).

3. Add the stable repository:

```bash
$ echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
$ sudo apt-get update
```

4. Install Docker CE, the CLI, containerd, and the Compose plugin:

```bash
$ sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

5. Let your user run Docker without `sudo`, then start a new login shell:

```bash
$ sudo usermod -aG docker $USER
$ newgrp docker
```

6. Verify:

```bash
$ docker --version
$ docker compose version
$ docker run hello-world
```

### Expected output

```text
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
...
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

Read that message carefully: the client contacted the daemon, the daemon pulled the image from Docker Hub, created a container, and streamed its output back to you. That is the whole Docker workflow in miniature.

### Try it yourself

- Run `docker info` and find the **Server Version**, **Storage Driver**, and the number of **Images** and **Containers**.
- Run `docker run hello-world` a second time. Why is there no "Pulling" line now?

## Lab 1 — Images, containers, and core commands

**Goal:** pull images, run containers in the foreground and background, map ports, name containers, and see the difference between `run` and `start`.

**Concept.** An **image** is a static, shareable blueprint: application code, libraries, config, and a minimal base OS (often Alpine Linux). A **container** is a running, isolated instance of an image with its own filesystem, environment variables, and network interface. One image can start many containers. Unlike a virtual machine, which boots its own guest kernel, a container shares the host kernel and virtualizes only the application layer — so images are megabytes instead of gigabytes and containers start in under a second.

### Part A — Pull and inspect images

```bash
$ docker pull redis:7.2
$ docker pull redis:7.2-alpine
$ docker images
```

**Expected:** two `redis` rows with different tags. The Alpine variant is several times smaller.

Watch the pull output: each line like `a2abf6c4d29d: Pull complete` is one **layer**. Now pull an adjacent version:

```bash
$ docker pull redis:7.0
```

Some layers show `Already exists`. Docker reused cached layers shared between versions, so only the differences were downloaded. Inspect the layers of an image:

```bash
$ docker history redis:7.2-alpine
```

### Part B — Run containers

1. Run in the foreground (attached). Your terminal is now tied to the container:

```bash
$ docker run redis:7.2
```

Press `Ctrl+C` to stop it.

2. Run in **detached** mode and give it a name:

```bash
$ docker run -d --name redis-new redis:7.2
$ docker ps
```

**Expected:** one row showing `redis-new`, status `Up`, and port `6379/tcp`. That port is only open *inside* the container's network — nothing on your host can reach it yet.

3. Run an **older version at the same time**. This is impossible with a normal OS install but trivial with Docker:

```bash
$ docker run -d --name redis-old redis:6.2
$ docker ps
```

Both versions now run side by side with no conflict.

### Part C — Port binding

The `-p <host_port>:<container_port>` flag forwards a host port into the container.

```bash
$ docker run -d --name web -p 8080:80 nginx:alpine
$ curl http://localhost:8080
```

**Expected:** the HTML of the "Welcome to nginx!" page. Open `http://<your-machine-ip>:8080` in a browser too.

Two containers can both listen on port 80 internally, but each needs a **different host port**:

```bash
$ docker run -d --name web2 -p 8081:80 nginx:alpine
$ docker run -d --name web3 -p 8080:80 nginx:alpine   # fails: port is already allocated
```

### Part D — Stop, start, and the run-vs-start difference

```bash
$ docker stop web
$ docker ps          # web is gone from the list
$ docker ps -a       # web is still there, status Exited
$ docker start web   # same container, same name, same port mapping
$ curl http://localhost:8080
```

Now see what `run` does instead:

```bash
$ docker run -d -p 8082:80 nginx:alpine
$ docker ps -a
```

You have a **new** container with a random name (like `brave_turing`). Remember: `docker run` always creates a new container from an image; `docker start` restarts an existing, stopped one with its original configuration.

### Part E — Clean up

```bash
$ docker stop $(docker ps -q)       # stop every running container
$ docker rm $(docker ps -aq)        # remove every container
$ docker rmi redis:7.0 redis:6.2    # remove images you no longer need
```

### Try it yourself

1. Run `postgres:16-alpine` detached, named `pg`, with `-e POSTGRES_PASSWORD=secret` and port `5432` mapped. Confirm it is `Up`.
2. Run a second Postgres, `postgres:15-alpine`, at the same time on host port `5433`.
3. Stop `pg`, start it again, and confirm with `docker ps -a` that no third container was created.

## Lab 2 — Debugging a container

**Goal:** read a container's logs, follow them live, and open a shell inside it to inspect its filesystem and environment.

**Concept.** Anything an app writes to stdout or stderr is captured by Docker and shown by `docker logs`. When logs are not enough, `docker exec -it` starts an extra process (usually a shell) inside a *running* container, so you can look around as if you had logged into a tiny machine.

### Steps

1. Start a container that produces logs:

```bash
$ docker run -d --name web -p 8080:80 nginx:alpine
$ curl -s localhost:8080 > /dev/null
$ curl -s localhost:8080/missing > /dev/null
```

2. Read the logs:

```bash
$ docker logs web
```

**Expected:** nginx startup lines, then two access-log lines — one `200` and one `404`.

3. Show only the last two lines:

```bash
$ docker logs --tail 2 web
```

4. Follow logs live. Open a **second terminal** and run curl a few times while this one watches:

```bash
$ docker logs -f web
```

New lines appear as each request arrives. Press `Ctrl+C` to stop following (the container keeps running).

5. Open a shell inside the container. Alpine images have `sh`, not `bash`:

```bash
$ docker exec -it web /bin/sh
```

Your prompt changes to something like `/ #`. You are now inside the container.

6. Explore:

```sh
/ # ls /
/ # cat /etc/os-release        # Alpine Linux, not your host's OS
/ # env                        # the container's own environment variables
/ # ls /usr/share/nginx/html   # where nginx serves files from
/ # ps                         # only a handful of processes — isolation at work
/ # exit
```

7. Change the running site from the inside:

```bash
$ docker exec web sh -c 'echo "<h1>Edited from inside</h1>" > /usr/share/nginx/html/index.html'
$ curl localhost:8080
```

8. Prove that container filesystems are temporary:

```bash
$ docker rm -f web
$ docker run -d --name web -p 8080:80 nginx:alpine
$ curl localhost:8080   # the default page is back — your edit is gone
```

Keep this result in mind; Lab 8 fixes it with volumes.

### Try it yourself

1. Run `docker run -d --name broken postgres:16-alpine` (no password). Run `docker ps -a` — why did it exit? Use `docker logs broken` to find the exact error message.
2. Fix it by starting a new container with the missing environment variable, then `exec` into it and run `env | grep POSTGRES`.

## Lab 3 — Networking: MongoDB and Mongo Express by hand

**Goal:** create a custom network and connect two containers that find each other by name.

**Concept.** Docker gives containers isolated virtual networks. On a **custom bridge network** (created with `docker network create`), Docker runs a built-in DNS, so a container can reach another simply by using its **container name** as the hostname — no `localhost`, no port mapping. Port mapping (`-p`) is only needed for traffic coming from *outside* Docker, such as your browser.

### Steps

1. See the networks Docker already has:

```bash
$ docker network ls
```

**Expected:** `bridge`, `host`, and `none`.

2. Create your own network:

```bash
$ docker network create mongo-network
```

3. Start MongoDB on that network. The two `-e` flags create the root user on first start:

```bash
$ docker run -d \
    --name mongodb \
    --network mongo-network \
    -p 27017:27017 \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD=password \
    mongo:7
```

Check it is ready:

```bash
$ docker logs mongodb | grep -i "waiting for connections"
```

4. Start Mongo Express on the same network. Note `ME_CONFIG_MONGODB_SERVER=mongodb` — that is the container name, used as a hostname:

```bash
$ docker run -d \
    --name mongo-express \
    --network mongo-network \
    -p 8081:8081 \
    -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \
    -e ME_CONFIG_MONGODB_ADMINPASSWORD=password \
    -e ME_CONFIG_MONGODB_SERVER=mongodb \
    mongo-express
```

5. Confirm the connection:

```bash
$ docker logs mongo-express
```

**Expected:** a line like `Server is open to allow connections from anyone (0.0.0.0)` and no connection errors. If you see `ECONNREFUSED`, MongoDB was not ready yet — run `docker restart mongo-express`.

6. Open `http://<your-machine-ip>:8081` in a browser. Log in with Mongo Express's own web login, which defaults to **admin / pass**.
7. In the UI, create a database named `my-db` and inside it a collection named `users`. You will use these in Lab 5.
8. Prove name resolution from inside the network:

```bash
$ docker run --rm --network mongo-network busybox ping -c 2 mongodb
```

**Expected:** replies from an IP like `172.18.0.2`. Docker's DNS turned the name `mongodb` into the container's IP.

9. Compare with the default network, which has no name resolution:

```bash
$ docker run --rm busybox ping -c 2 mongodb   # fails: bad address 'mongodb'
```

10. Inspect the network to see who is connected:

```bash
$ docker network inspect mongo-network
```

### The connection string

An application **inside** this network connects with:

```text
mongodb://admin:password@mongodb:27017
```

An application running **directly on your host** (not in Docker) uses the mapped port instead:

```text
mongodb://admin:password@localhost:27017
```

### Clean up

```bash
$ docker rm -f mongodb mongo-express
$ docker network rm mongo-network
```

### Try it yourself

Run the same pair again, but name the database container `db` instead of `mongodb`. Which single environment variable on Mongo Express must change for it to connect?

## Lab 4 — Docker Compose: one file, whole stack

**Goal:** replace the long `docker run` commands from Lab 3 with a single YAML file and manage the stack with one command.

**Concept.** A Compose file declares each container as a **service** with its image, ports, and environment. Compose creates a shared default network for all services automatically, so services reach each other by **service name**. `up` creates and starts everything; `down` stops and removes the containers and the network.

### Steps

1. Make a project folder:

```bash
$ mkdir -p ~/docker-lab/app && cd ~/docker-lab/app
```

2. Create `mongo.yaml`:

```yaml
services:
  mongodb:
    image: mongo:7
    ports:
      - 27017:27017
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password

  mongo-express:
    image: mongo-express
    restart: always            # retry until MongoDB is ready
    ports:
      - 8081:8081
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=password
      - ME_CONFIG_MONGODB_SERVER=mongodb
    depends_on:
      - mongodb
```

Compare this line by line with the Lab 3 commands: `--name` became the service key, `-p` became `ports`, `-e` became `environment`, and `--network` disappeared because Compose handles it. Older tutorials start with `version: '3'`; current Compose ignores that key, so you can leave it out.

3. Start the stack in the foreground to watch both logs interleaved:

```bash
$ docker compose -f mongo.yaml up
```

Press `Ctrl+C` once it settles. Then start it detached:

```bash
$ docker compose -f mongo.yaml up -d
```

4. Inspect what Compose made:

```bash
$ docker compose -f mongo.yaml ps
$ docker network ls
```

**Expected:** containers named like `app-mongodb-1` and `app-mongo-express-1`, plus a network named `app_default`. The `app` prefix comes from the folder name.

5. Read logs for one service:

```bash
$ docker compose -f mongo.yaml logs -f mongo-express
```

6. Open `http://<your-machine-ip>:8081`, log in (admin / pass), and recreate the `my-db` database with a `users` collection.
7. Tear it down and bring it back:

```bash
$ docker compose -f mongo.yaml down
$ docker compose -f mongo.yaml up -d
```

Open Mongo Express again. **`my-db` is gone.** `down` removed the containers, and the data lived inside the MongoDB container's temporary filesystem. Lab 8 fixes this.

### Useful Compose commands

| Command | What it does |
| --- | --- |
| `docker compose -f mongo.yaml up -d` | Create and start all services in the background |
| `docker compose -f mongo.yaml ps` | List this stack's containers |
| `docker compose -f mongo.yaml logs -f <service>` | Follow one service's logs |
| `docker compose -f mongo.yaml stop` | Stop containers, keep them |
| `docker compose -f mongo.yaml start` | Start stopped containers |
| `docker compose -f mongo.yaml down` | Stop and remove containers and the network |
| `docker compose -f mongo.yaml exec mongodb mongosh -u admin -p password` | Run a command inside a service |

If you name the file `docker-compose.yaml` or `compose.yaml`, you can drop `-f`.

### Try it yourself

Add a third service, `cache`, using `redis:7.2-alpine` with no published ports. Bring the stack up, then prove `mongo-express` can reach it by name:

```bash
$ docker compose -f mongo.yaml exec mongo-express ping -c 2 cache
```

## Lab 5 — Build the Node.js app and its Dockerfile

**Goal:** write a small Express app, package it into your own image with a Dockerfile, and run it next to MongoDB.

**Concept.** A **Dockerfile** is a recipe; each instruction adds a layer to the image:

| Instruction | Purpose | Runs when |
| --- | --- | --- |
| `FROM` | Base image to start from | Build |
| `ENV` | Set an environment variable baked into the image | Build (value used at runtime) |
| `RUN` | Execute a shell command, saving the result as a layer | Build |
| `COPY` | Copy files from your machine into the image | Build |
| `WORKDIR` | Set the working directory for later instructions | Build |
| `CMD` | Default command when a container starts | Runtime |

Only one `CMD` takes effect; if you write several, the last one wins.

### Project layout

```text
~/docker-lab/app/
├── mongo.yaml          (from Lab 4)
├── Dockerfile
├── .dockerignore
└── app/
    ├── package.json
    ├── server.js
    └── index.html
```

```bash
$ cd ~/docker-lab/app && mkdir -p app
```

### Step 1 — Write the application

`app/package.json`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.19.2",
    "mongodb": "^6.8.0"
  }
}
```

`app/server.js`:

```javascript
const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || 'mongodb://admin:password@localhost:27017';
const DB_NAME = 'my-db';
const client = new MongoClient(MONGO_URL);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/get-profile', async (req, res) => {
  const profile = await client.db(DB_NAME).collection('users').findOne({ userid: 1 });
  res.json(profile || {});
});

app.post('/update-profile', async (req, res) => {
  const { name, email, interests } = req.body;
  const profile = { userid: 1, name, email, interests };
  await client.db(DB_NAME).collection('users')
    .updateOne({ userid: 1 }, { $set: profile }, { upsert: true });
  res.json(profile);
});

client.connect()
  .then(() => {
    console.log('Connected to MongoDB at', MONGO_URL.replace(/\/\/.*@/, '//***@'));
    app.listen(3000, () => console.log('App listening on port 3000'));
  })
  .catch(err => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
```

`app/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>User Profile</title>
  <style>
    body { font-family: sans-serif; max-width: 420px; margin: 40px auto; }
    label { display: block; margin-top: 12px; }
    input { width: 100%; padding: 6px; }
    button { margin-top: 16px; padding: 8px 16px; }
  </style>
</head>
<body>
  <h1>User Profile</h1>
  <label>Name <input id="name"></label>
  <label>Email <input id="email"></label>
  <label>Interests <input id="interests"></label>
  <button onclick="save()">Save</button>
  <p id="status"></p>

  <script>
    async function load() {
      const p = await (await fetch('/get-profile')).json();
      for (const f of ['name', 'email', 'interests']) {
        document.getElementById(f).value = p[f] || '';
      }
    }
    async function save() {
      const body = {};
      for (const f of ['name', 'email', 'interests']) {
        body[f] = document.getElementById(f).value;
      }
      await fetch('/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      document.getElementById('status').textContent = 'Saved.';
    }
    load();
  </script>
</body>
</html>
```

**Optional — run it the "developer" way.** If Node.js is installed on your machine, start the Lab 4 stack and run the app directly on the host. It connects to MongoDB through the mapped port `27017` on `localhost`:

```bash
$ docker compose -f mongo.yaml up -d
$ cd app && npm install && node server.js
```

This is the development workflow from the notes: your code runs locally, its dependencies run in containers. Stop it with `Ctrl+C` and `cd ..`.

### Step 2 — Write the Dockerfile

`Dockerfile` (in `~/docker-lab/app`, next to `mongo.yaml`):

```dockerfile
FROM node:20-alpine

ENV MONGO_URL=mongodb://admin:password@mongodb:27017

RUN mkdir -p /home/app

COPY ./app /home/app

WORKDIR /home/app

RUN npm install

CMD ["node", "server.js"]
```

Note the hostname in `MONGO_URL` is `mongodb`, the service name — because this app will run *inside* the Docker network. Older tutorials use `node:13-alpine`; that version is long out of support, so use a current LTS tag. Putting credentials in `ENV` is fine for a lab but not for real projects; Lab 7 shows how to pass them at runtime instead.

`.dockerignore` keeps local clutter out of the image:

```text
app/node_modules
*.log
```

### Step 3 — Build the image

```bash
$ docker build -t my-app:1.0 .
```

The `.` is the **build context**: the folder whose files `COPY` can see. Watch each step print as a numbered layer.

```bash
$ docker images my-app
```

**Expected:** `my-app   1.0   ...   ~150MB`.

### Step 4 — Run it on the stack's network

Make sure the Lab 4 stack is up, then attach your app to its network (`app_default`):

```bash
$ docker compose -f mongo.yaml up -d
$ docker run -d --name my-app --network app_default -p 3000:3000 my-app:1.0
$ docker logs my-app
```

**Expected:** `Connected to MongoDB at mongodb://***@mongodb:27017` and `App listening on port 3000`.

Open `http://<your-machine-ip>:3000`, fill in the form, and click **Save**. Refresh the page — the values reload from MongoDB. In Mongo Express (`:8081`), open `my-db` → `users` and see your document.

### Step 5 — Look inside your image

```bash
$ docker exec -it my-app /bin/sh
/home/app # ls             # server.js, index.html, package.json, node_modules
/home/app # env | grep MONGO
/home/app # exit
```

### Step 6 — Change, rebuild, replace

Edit the `<h1>` in `index.html` to say `User Profile v2`. An image never changes after it is built, so you must rebuild and replace the container:

```bash
$ docker rm -f my-app          # remove the old container
$ docker rmi my-app:1.0        # remove the old image (optional)
$ docker build -t my-app:1.1 .
$ docker run -d --name my-app --network app_default -p 3000:3000 my-app:1.1
```

Refresh the browser to see v2.

### Try it yourself

The Dockerfile above re-runs `npm install` every time *any* file changes, because `COPY ./app` comes before it. Rewrite it so that only `package.json` is copied first, `npm install` runs, and the rest of the code is copied afterwards. Rebuild twice after editing only `index.html` and confirm the second build shows `CACHED` for the `npm install` step.

## Lab 6 — Push your image to a private registry

**Goal:** store `my-app` in a private registry so any server can pull it.

**Concept.** Docker Hub is a public registry; companies keep their own images in **private** registries such as AWS Elastic Container Registry (ECR). A private image's name includes the registry address:

```text
<registry_domain>/<repository_name>:<tag>
```

Plain names like `mongo:7` are shorthand for `docker.io/library/mongo:7`. The workflow is always the same: **log in → tag → push**. Pick **Track A** (AWS ECR) if you have an AWS account, otherwise **Track B** (local registry). Labs 7 and 8 work with either.

### Track A — AWS ECR

Prerequisites: the AWS CLI installed and configured (`aws configure`) with credentials allowed to use ECR. Replace `<account_id>` and `<region>` (for example `eu-central-1`) throughout.

1. Create a repository (one per image):

```bash
$ aws ecr create-repository --repository-name my-app --region <region>
```

2. Log your Docker client in to ECR:

```bash
$ aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account_id>.dkr.ecr.<region>.amazonaws.com
```

**Expected:** `Login Succeeded`.

3. Tag your local image with the full registry name. Tagging adds a second name; it does not copy anything:

```bash
$ docker tag my-app:1.1 <account_id>.dkr.ecr.<region>.amazonaws.com/my-app:1.0
$ docker images | grep my-app
```

Both names show the same **IMAGE ID**.

4. Push:

```bash
$ docker push <account_id>.dkr.ecr.<region>.amazonaws.com/my-app:1.0
```

5. Confirm in the AWS console (ECR → Repositories → my-app) or with:

```bash
$ aws ecr list-images --repository-name my-app --region <region>
```

### Track B — Local private registry

Docker's official `registry` image is a complete private registry in one container.

1. Start it:

```bash
$ docker run -d --name registry --restart always -p 5000:5000 registry:2
```

2. Tag and push:

```bash
$ docker tag my-app:1.1 localhost:5000/my-app:1.0
$ docker push localhost:5000/my-app:1.0
```

3. List what the registry holds:

```bash
$ curl http://localhost:5000/v2/_catalog
$ curl http://localhost:5000/v2/my-app/tags/list
```

**Expected:** `{"repositories":["my-app"]}` and `{"name":"my-app","tags":["1.0"]}`.

**Classroom variant (shared registry).** If the instructor runs one registry for the whole class at `<instructor-ip>:5000`, students push to `<instructor-ip>:5000/<your-name>-my-app:1.0`. Because this registry uses plain HTTP, each student machine must trust it. Add this to `/etc/docker/daemon.json` and restart Docker:

```json
{ "insecure-registries": ["<instructor-ip>:5000"] }
```

```bash
$ sudo systemctl restart docker
```

This is acceptable on a closed lab network only. Real registries use HTTPS.

### Both tracks — see layer reuse

Change `index.html` again (for example `v3`), rebuild, tag as `1.1`, and push:

```bash
$ docker build -t my-app:1.2 .
$ docker tag my-app:1.2 <registry>/my-app:1.1
$ docker push <registry>/my-app:1.1
```

**Expected:** most lines say `Layer already exists`. Only the changed layer is uploaded — the Node base layers are reused.

### Try it yourself

Delete your local copies (`docker rmi` both registry-tagged names), then `docker pull` the image back from your registry. Run `docker images` to confirm it came from the registry.

## Lab 7 — Deploy the containerized app

**Goal:** run the full stack on a "server" that pulls your app from the private registry and its dependencies from Docker Hub, using one Compose file.

&#91;embedded content: from laptop to server · 4 hops\]

In a real team, the CI server builds and pushes the image after every commit; in this lab you play every role yourself. The deployment server never sees your source code — only the image.

### Steps

1. **Pick your server.** Ideally a second machine (another VM or a classmate's instance). If you only have one machine, simulate a clean server by removing your local app images first:

```bash
$ docker rm -f my-app
$ docker compose -f ~/docker-lab/app/mongo.yaml down
$ docker images --format '{{.Repository}}:{{.Tag}}' | grep my-app | xargs -r docker rmi
```

2. **Log in to the registry from the server.**

- Track A: run the same `aws ecr get-login-password ... | docker login ...` command from Lab 6.
- Track B, same machine: no login needed for `localhost:5000`.
- Track B, classroom registry: add the `insecure-registries` entry from Lab 6 on this machine too.

3. **Create a deployment folder** with only two files — no source code:

```bash
$ mkdir -p ~/deploy && cd ~/deploy
```

`.env` holds the secrets, kept out of the Compose file:

```text
MONGO_USER=admin
MONGO_PASS=password
```

`mongo.yaml` (replace `<registry>` with your ECR domain or `localhost:5000`):

```yaml
services:
  my-app:
    image: <registry>/my-app:1.0
    restart: always
    ports:
      - 3000:3000
    environment:
      - MONGO_URL=mongodb://${MONGO_USER}:${MONGO_PASS}@mongodb:27017
    depends_on:
      - mongodb

  mongodb:
    image: mongo:7
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASS}

  mongo-express:
    image: mongo-express
    restart: always
    ports:
      - 8081:8081
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=${MONGO_USER}
      - ME_CONFIG_MONGODB_ADMINPASSWORD=${MONGO_PASS}
      - ME_CONFIG_MONGODB_SERVER=mongodb
    depends_on:
      - mongodb
```

Three things changed from Lab 4. `my-app` now comes from your registry. `MONGO_URL` in `environment` overrides the value baked into the image, so the image holds no real credentials. And `mongodb` no longer publishes port `27017`: only containers on the Compose network can reach the database, which is safer.

4. **Deploy:**

```bash
$ docker compose -f mongo.yaml up -d
```

**Expected:** Compose pulls `my-app` from your registry and `mongo`/`mongo-express` from Docker Hub, then starts all three.

5. **Verify:**

```bash
$ docker compose -f mongo.yaml ps
$ docker compose -f mongo.yaml logs my-app
```

Open `http://<server-ip>:3000`, save a profile, and check it in Mongo Express at `:8081`.

6. **Check that services talk by name.** From inside `my-app`, the database is reachable as `mongodb`:

```bash
$ docker compose -f mongo.yaml exec my-app ping -c 2 mongodb
```

7. **Roll out a new version.** Change the tag in `mongo.yaml` to `1.1` (the one you pushed in Lab 6) and run:

```bash
$ docker compose -f mongo.yaml up -d
```

Compose recreates only `my-app`; the database containers keep running.

### Try it yourself

Try to connect to MongoDB from the host with `nc -zv localhost 27017` (or any Mongo client). Why does it fail now when it worked in Lab 4? Is that a bug or a feature?

## Lab 8 — Volumes: make data survive

**Goal:** see each volume type in action, then give the deployed MongoDB a named volume so profiles survive `down` and `up`.

**Concept.** A container's filesystem is thrown away with the container (you saw this in Labs 2 and 4). A **volume** mounts storage from the host into a path inside the container; whatever the container writes there lands on the host and outlives the container.

| Type | Syntax | Who picks the host folder | Best for |
| --- | --- | --- | --- |
| Host (bind mount) | `-v /path/on/host:/path/in/container` | You | Editing code or config from the host |
| Anonymous | `-v /path/in/container` | Docker, random name | Throwaway data |
| Named | `-v name:/path/in/container` | Docker, under a name you choose | Databases and production data |

### Part A — Host volume

```bash
$ mkdir -p ~/docker-lab/site
$ echo '<h1>Served from my host folder</h1>' > ~/docker-lab/site/index.html
$ docker run -d --name site -p 8090:80 -v ~/docker-lab/site:/usr/share/nginx/html nginx:alpine
$ curl localhost:8090
```

Edit `~/docker-lab/site/index.html` on the host and `curl` again — the change is live with no rebuild. The sync works both ways:

```bash
$ docker exec site sh -c 'echo "<p>written by the container</p>" >> /usr/share/nginx/html/index.html'
$ cat ~/docker-lab/site/index.html
```

Now delete and recreate the container — the content stays, unlike Lab 2:

```bash
$ docker rm -f site
$ docker run -d --name site -p 8090:80 -v ~/docker-lab/site:/usr/share/nginx/html nginx:alpine
$ curl localhost:8090
$ docker rm -f site
```

### Part B — Anonymous and named volumes

```bash
$ docker run -d --name anon -v /data busybox sleep 3600
$ docker volume create demo-data
$ docker run -d --name named -v demo-data:/data busybox sleep 3600
$ docker volume ls
```

**Expected:** one volume with a long random hash name (anonymous) and one called `demo-data`.

Write into the named volume, destroy the container, and read it back from a new one:

```bash
$ docker exec named sh -c 'echo hello > /data/note.txt'
$ docker rm -f named
$ docker run --rm -v demo-data:/data busybox cat /data/note.txt    # prints: hello
```

Find where it lives on the host:

```bash
$ docker volume inspect demo-data
$ sudo ls /var/lib/docker/volumes/demo-data/_data
```

Clean up:

```bash
$ docker rm -f anon
$ docker volume prune -f       # removes unused anonymous volumes
$ docker volume rm demo-data
```

### Part C — Persist the deployed MongoDB

1. Bring up the Lab 7 stack and save a profile at `:3000`. Then run `down` and `up` — the profile is gone. That is the problem you are about to fix.
2. Edit `~/deploy/mongo.yaml`. Add a top-level `volumes:` key and mount the named volume at MongoDB's data path, `/data/db`:

```yaml
services:
  my-app:
    # ... unchanged ...

  mongodb:
    image: mongo:7
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASS}
    volumes:
      - mongo-data:/data/db

  mongo-express:
    # ... unchanged ...

volumes:
  mongo-data:
    driver: local
```

Every database image documents its own data path: `/data/db` for MongoDB, `/var/lib/postgresql/data` for Postgres, `/var/lib/mysql` for MySQL.

3. Apply and test:

```bash
$ cd ~/deploy
$ docker compose -f mongo.yaml up -d
```

Save a profile in the browser, then:

```bash
$ docker compose -f mongo.yaml down
$ docker compose -f mongo.yaml up -d
```

Refresh `:3000`. **The profile is still there.** Mongo Express shows `my-db` and the `users` collection intact.

4. See the volume Compose created (prefixed with the folder name):

```bash
$ docker volume ls            # deploy_mongo-data
$ docker volume inspect deploy_mongo-data
```

5. Know how to really delete it. `down` keeps named volumes; `down -v` removes them along with all data:

```bash
$ docker compose -f mongo.yaml down -v   # careful: wipes the database
```

### Where volumes live on each OS

| Host OS | Path of a named volume |
| --- | --- |
| Linux | `/var/lib/docker/volumes/<volume_name>/_data` |
| Windows | `C:\ProgramData\Docker\volumes\<volume_name>\_data` |
| macOS | Inside Docker Desktop's Linux VM, not directly on the Mac filesystem |

On macOS (and Windows with the WSL 2 backend), you can still reach the data from a container: `docker run --rm -it -v deploy_mongo-data:/data alpine sh`.

### Try it yourself

Back up the database volume to a tar file on your host, then restore it into a fresh volume:

```bash
$ docker run --rm -v deploy_mongo-data:/data -v $PWD:/backup alpine tar czf /backup/mongo-backup.tgz -C /data .
```

Write the matching restore command yourself (hint: create a new volume and run `tar xzf` into it), point `mongo.yaml` at the new volume, and confirm your profile is still there.

## Capstone, cheat sheet, and troubleshooting

### Capstone challenge

Without looking back, rebuild the whole project from an empty folder in under 45 minutes:

- [ ] Write `server.js`, `index.html`, `package.json`, and a cache-friendly Dockerfile
- [ ] Build `my-app:2.0` and push it to your registry
- [ ] Write a `mongo.yaml` that pulls `my-app:2.0`, reads credentials from `.env`, does not publish MongoDB's port, and stores data in a named volume
- [ ] Deploy, save a profile, run `down` then `up`, and show the profile survived
- [ ] Show the instructor `docker compose ps`, `docker volume ls`, and your registry's tag list

**Stretch goals:** add a `healthcheck` to `mongodb` and change `my-app`'s `depends_on` to wait for `condition: service_healthy`; add a `.dockerignore`; run the app as the non-root `node` user with `USER node`.

### Command cheat sheet

| Task | Command |
| --- | --- |
| Pull an image | `docker pull <image>:<tag>` |
| List images | `docker images` |
| Run detached, named, with a port | `docker run -d --name <name> -p <host>:<container> <image>` |
| Pass an environment variable | `docker run -e KEY=value <image>` |
| List running / all containers | `docker ps` / `docker ps -a` |
| Stop / start an existing container | `docker stop <name>` / `docker start <name>` |
| Logs, follow, last N lines | `docker logs <name>` / `-f` / `--tail N` |
| Shell inside a container | `docker exec -it <name> /bin/sh` |
| Remove a container / image | `docker rm <name>` / `docker rmi <image>` |
| Create a network | `docker network create <name>` |
| Build an image | `docker build -t <name>:<tag> .` |
| Tag for a registry | `docker tag <name>:<tag> <registry>/<repo>:<tag>` |
| Log in / push | `docker login <registry>` / `docker push <registry>/<repo>:<tag>` |
| Compose up / down | `docker compose -f <file> up -d` / `down` |
| List / inspect volumes | `docker volume ls` / `docker volume inspect <name>` |
| Free disk space | `docker system prune` (add `-a --volumes` with care) |

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `permission denied ... docker.sock` | Your user is not in the `docker` group | `sudo usermod -aG docker $USER`, then log out and back in |
| `port is already allocated` | Another container or process uses that host port | Pick another host port, or `docker ps` to find and stop the other container |
| Mongo Express logs `ECONNREFUSED` | MongoDB was not ready yet | Add `restart: always` or run `docker restart mongo-express` |
| App logs `getaddrinfo ENOTFOUND mongodb` | App is not on the same network as MongoDB, or the name differs | Use `--network <name>` or put both in one Compose file; check the service name |
| `Authentication failed` from MongoDB | Credentials changed after the volume was first created | `MONGO_INITDB_*` only applies to an empty volume: reset with `down -v` (deletes data) or use the original credentials |
| `http: server gave HTTP response to HTTPS client` on push | Docker expects HTTPS from a remote registry | Add the registry to `insecure-registries` in `/etc/docker/daemon.json` (lab only) |
| ECR push says `no basic auth credentials` | Login expired (ECR tokens last 12 hours) | Re-run the `aws ecr get-login-password ... \| docker login ...` command |
| Container exits right away | The main process crashed or finished | `docker logs <name>`; for a shell image, give it a long-running command |
| Code change not visible | Container still runs the old image | Rebuild, then remove and re-run the container (or `docker compose up -d --build`) |

### Answer key for "Try it yourself"

- **Lab 0:** the image is already cached locally, so nothing is pulled.
- **Lab 1:** `docker run -d --name pg -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16-alpine`; the second uses `-p 5433:5432 postgres:15-alpine` and a different name.
- **Lab 2:** Postgres refuses to start without `POSTGRES_PASSWORD`; the log says the superuser password is not specified.
- **Lab 3:** `ME_CONFIG_MONGODB_SERVER=db`.
- **Lab 4:** add `cache: { image: redis:7.2-alpine }` under `services`; the ping resolves because Compose puts all services on one network.
- **Lab 5:** `COPY ./app/package.json /home/app/` → `WORKDIR /home/app` → `RUN npm install` → `COPY ./app /home/app`.
- **Lab 6:** after `docker rmi`, `docker pull <registry>/my-app:1.0` downloads it again.
- **Lab 7:** MongoDB's port is no longer published, so only containers on the Compose network can reach it — a deliberate security feature.
- **Lab 8:** `docker volume create mongo-restore` then `docker run --rm -v mongo-restore:/data -v $PWD:/backup alpine tar xzf /backup/mongo-backup.tgz -C /data`; in `mongo.yaml`, declare it as `mongo-restore: { external: true }` and mount `mongo-restore:/data/db`.
