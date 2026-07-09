# Staging deployment

The staging deployment target is a single VPS running Docker, reached over
SSH from GitHub Actions. `docker-compose.staging.yml` is an overlay on the
base compose file: it swaps `build:` for a GHCR image reference, drops dev
bind mounts, and removes the database's published port so Postgres is only
reachable from the `api` container, never from the internet.

## One-time host setup

1. Provision any small VPS running a recent Debian or Ubuntu, and point a
   DNS record at it if you want the health check and dashboard link to use a
   real hostname rather than a bare IP.
2. Copy `docker/provision-staging-host.sh` to the host and run it as root
   with the deploy username you want, e.g. `./provision-staging-host.sh
deploy`. It installs Docker and creates the deploy user.
3. Generate an SSH key pair for CI to use (`ssh-keygen -t ed25519 -f
deploy_key -N ''`), install the public half in the deploy user's
   `~/.ssh/authorized_keys`, and store the private half as the
   `STAGING_SSH_KEY` GitHub Actions secret.
4. As the deploy user, clone this repository to `~/api-test-gateway`, copy
   `.env.example` to `.env`, fill in real values, and `chmod 600 .env`.
   `IMAGE_TAG` does not need to be set manually; the deploy workflow writes
   it on every run.
5. Set the following in the repository's GitHub Actions configuration:

   | Name                | Kind     | Value                                                       |
   | ------------------- | -------- | ----------------------------------------------------------- |
   | `STAGING_HOST`      | variable | the host's address                                          |
   | `STAGING_PORT`      | variable | SSH port, only needed if not 22                             |
   | `STAGING_USER`      | variable | the deploy username                                         |
   | `STAGING_BASE_URL`  | variable | `https://<host>` (or `http://<host>:3000` without a domain) |
   | `CONTROL_PLANE_URL` | variable | the control plane's public base URL, once it exists         |
   | `STAGING_SSH_KEY`   | secret   | the deploy key's private half                               |
   | `CP_WEBHOOK_SECRET` | secret   | shared secret for the signed deploy-notification webhook    |

## What happens on every push to main

`.github/workflows/deploy-staging.yml` runs after `ci.yml` succeeds on
`main`: it SSHes in, writes the new image tag into the remote `.env`, pulls
and runs migrations, brings the stack up with `--wait`, polls
`/health/ready` from outside the host, then attempts a signed notification
to the control plane. The notify step never fails the deployment; if the
control plane isn't reachable (or doesn't exist yet), the workflow still
succeeds and just logs the failed attempt.

## Rollback

Every deploy is an immutable `sha-<commit>` image tag, so rolling back is
redeploying an older one: run the `Deploy staging` workflow manually
(`workflow_dispatch`) with `image_tag` set to the tag you want to go back
to. Database migrations are additive-only by convention, which is what
makes this safe without a separate down-migration step.
