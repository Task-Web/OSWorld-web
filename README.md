# OSWorld Website

## Quick Start
To start the OSWorld website services, use the following command:

```bash
git clone --recurse-submodules git@github.com:adlsdztony/OSWorld-web.git

./gen-compose.sh

docker compose -f docker-compose.generated.yml up -d
```