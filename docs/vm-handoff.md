# VM handoff

Continue from the `feature/anvesha-prototype` branch in `aravindg-atwork/Anvesha---Chatbot`.

On the VM with Git and Docker Compose installed:

```sh
git clone --branch feature/anvesha-prototype https://github.com/aravindg-atwork/Anvesha---Chatbot.git
cd Anvesha---Chatbot
cp .env.example .env
# Configure the VM's own environment values, then:
docker compose up -d --build
curl http://127.0.0.1:8000/api/health
```

The Compose service listens on the VM's loopback port 8000. Use an SSH tunnel for the first demo or the site's existing HTTPS reverse proxy for public access. Set secure cookies for HTTPS deployment. Qdrant stays on loopback; application data, index data and embedding models use persistent named volumes.

Git does not contain local accounts, uploaded documents, the database, embedding caches, Google credentials or OAuth tokens. A fresh VM starts with a fresh workspace unless those persistent volumes are separately migrated. Google OAuth needs the VM site's callback URL configured in both Google Cloud and the environment.

## AWS Nova next

The current answer provider is Gemini, alongside local source-quote retrieval. Nova is not connected in this commit. The next step requires the EC2 host/user and project directory, AWS region, chosen Nova model/inference profile, and the instance IAM role's model invocation access. Implement the provider against the existing retrieved-passage answer interface so citations and project isolation continue to work. Keep AWS credentials on the VM through its IAM role.

Use [demo-retrieval.md](demo-retrieval.md) for the presentation flow and current update behaviour.
