---
title: Connectivity
description: Connect a Paseo client to your daemon through SSH, the relay, or Tailscale.
nav: Connectivity
order: 4
category: Getting started
---

# Connectivity

Your Paseo app connects to the daemon running on your computer or server. Paseo Desktop and the CLI can tunnel through SSH. Mobile clients can connect through the Paseo relay, directly with Tailscale, or through a Cloudflare Tunnel.

This is client-to-daemon transport. If you are looking for the service that starts agents from GitHub, Slack, and Discord events, that is [Hub](/docs/hub).

- [SSH](#ssh)
- [Paseo relay](#paseo-relay)
- [Cloudflare Tunnel](#cloudflare-tunnel)
- [Tailscale](#tailscale)

## SSH

SSH transport connects to an existing daemon through your local OpenSSH client. It does not install, start, or configure Paseo on the remote host.

Before connecting:

1. Start the Paseo daemon on the remote host.
2. Confirm `ssh user@host` works with a key or SSH agent. Paseo uses non-interactive SSH and follows your OpenSSH config.

The CLI accepts an SSH URI as its host:

```bash
paseo --host ssh://user@host ls -a
```

The daemon is expected at `127.0.0.1:6767` on the remote host. The port in the SSH URL is the SSH server port:

```bash
paseo --host ssh://user@host:2222 ls -a
```

Set a different remote daemon port with `daemonPort`:

```bash
paseo --host 'ssh://user@host?daemonPort=7777' ls -a
```

Put `--host` before the command. `paseo daemon status` observes the default local home; use `paseo --host ssh://user@host daemon status` to query a remote daemon. `paseo --host ssh://user@host run --cwd /path/on/remote ...` requires a working directory that exists on the remote host.

In Paseo Desktop, open **Settings → Add host → Remote SSH** and enter the same `ssh://` destination, including `:port` or `?daemonPort=` when those differ from the defaults.

If the remote daemon has a password, enter it in **Daemon password**; it is stored with the host and sent on every connection, the same as a direct connection's password. SSH login itself stays key-based — Paseo never prompts for an SSH password.

## Paseo relay

The relay works without Tailscale, port forwarding, or network configuration. Traffic is [end-to-end encrypted](/docs/security).

Relay is disabled until you enable it.

### Enable relay from Paseo Desktop

1. Open **Settings → your host → Devices → Relay**.
2. Select **Enable relay**.
3. Scan the QR code with Paseo on your phone, or copy the pairing link and paste it into the phone app.

### Enable relay from the CLI

Run:

```bash
paseo daemon pair
```

Confirm when prompted. Paseo prints a QR code and pairing link. Scan the QR code with Paseo on your phone, or choose **Paste pairing link** in the phone app.

## Cloudflare Tunnel

Cloudflare Tunnel gives the daemon a public HTTPS address without opening a port. Run `cloudflared` on the daemon machine, not on the phone.

Set a password first, then start a quick tunnel:

```bash
paseo daemon set-password
paseo daemon restart
cloudflared tunnel --url http://127.0.0.1:6767
```

`cloudflared` prints a URL such as `https://random-words.trycloudflare.com`. Paseo allows `*.trycloudflare.com` hostnames by default, so the quick tunnel needs no hostname configuration.

Connect from the phone:

1. Open **Settings → Add host → Direct connection**.
2. Enter the hostname from the tunnel URL in **Host**, without `https://`.
3. Enter `443` in **Port**.
4. Turn on **Use SSL** and enter the daemon password.
5. Select **Connect**.

From the CLI, pass the URL directly:

```bash
paseo --host https://random-words.trycloudflare.com ls -a
```

Add `?password=<daemon-password>` when the daemon requires a password.

A quick tunnel gets a new hostname every time `cloudflared` starts. For a stable address, run a named tunnel with your own domain and add that domain to `daemon.hostnames`:

```bash
paseo daemon config set daemon.hostnames '[".paseo.example.com"]'
```

The tunnel is public, so keep the daemon password enabled.

## Tailscale

Install [Tailscale](https://tailscale.com/download) on the daemon machine and your phone. Sign in to the same tailnet on both devices.

1. On a device already connected to the host, open **Settings → your host → Devices**. You can also use the phone step during setup.
2. Turn on **Tailscale** and copy the address.
3. In Paseo on your phone, open **Settings → Add host → Direct connection**.
4. Enter the IP in **Host** and the number after it in **Port**. Leave **Use SSL** off, then select **Connect**.

If the host was already paired through the relay, Paseo adds the direct connection to the same host.

## Troubleshooting

- **SSH authentication failed:** Run `ssh user@host` in a terminal and fix the key, agent, host key, or `~/.ssh/config` entry there. Paseo does not prompt for SSH passwords.
- **SSH connects but Paseo is refused:** Run `paseo daemon status` on the remote host. SSH transport does not start the daemon.
- **SSH connects but Paseo reports "Password required":** The remote daemon is password-protected. Remove the SSH connection from the host and add it again, this time entering the daemon password in **Daemon password**.
- **Connection timed out:** Check that Tailscale is connected on both devices and that you used the daemon machine's Tailscale IP.
- **Connection refused:** Run `paseo daemon status` and confirm the daemon is running on the configured IP and port.
- **Config change has no effect:** Run `paseo reload`. Restart if the command reports a change to the main listen address.
