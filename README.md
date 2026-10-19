### Download JSON folder
```
npx degit asimriaz/Advance-DBMS-Fall-2026/JSON#NoSQL JSON
```

### Load collection in MongoDB
```
docker exec -i mongo-db mongoimport --jsonArray -d academic -c courses < courses.json
```

### Use mongoshell
```
docker exec -it mongo-db mongosh
```


<details>
<summary><b>Install Node.js with NVM</b></summary>

1. Install Dependencies

Ensure your package list is updated and that curl and git are installed on your system:
```
sudo apt update && sudo apt install curl git -y
```


2. Download and Run the NVM Script

Run the official script to download and install NVM:
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```


3. Reload Your Environment

The script automatically appends the necessary environment variables to your shell profile (e.g., ~/.bashrc). Load these changes into your current session without logging out:
bash
```
source ~/.bashrc
```

### Quick Start: Installing Node.js

Now that NVM is set up, you can easily manage Node.js versions:

- Install the latest Long Term Support (LTS) version:bash
```
nvm install --lts
```
- Install a specific version:bash
```
nvm install 24.11.1
```
- Verify your Node.js and NPM versions:bash
```
node -v
npm -v
```

</details
