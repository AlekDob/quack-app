# Open Linear issues in Quack

Quack accepts this link:

```text
quack://open?source=linear&prompt={{prompt}}
```

Opening it creates a new Quack chat. The Linear prompt is inserted as a draft. Quack does not send it.

The desktop app validates the scheme, host, source, duplicate parameters, malformed encoding, and a 32 KiB UTF-8 size limit. Requests received while Quack is starting are held until the renderer is ready. The prompt then crosses one typed Electron IPC event and is stored in the existing composer draft state.

## Custom Link

In Linear, open **Settings → Code & reviews → Configure coding tools**.

Enable **Custom link**. Use the link above.

If Linear rejects `quack://`, use the script fallback below.

## Custom Script

This fallback is per user. It is not the global integration.

Copy [`scripts/open-linear-in-quack.mjs`](../scripts/open-linear-in-quack.mjs) to a stable local path. It needs Node.js. Then create `~/.linear/coding-tools.json` with the absolute path to that copy:

```json
{
  "openIssue": {
    "path": "/Users/you/bin/open-linear-in-quack.mjs",
    "env": ["LINEAR_PROMPT"]
  }
}
```

Make the copied file executable:

```sh
chmod +x /Users/you/bin/open-linear-in-quack.mjs
```

Enable **Custom script** in Linear. Linear passes the issue prompt through `LINEAR_PROMPT`. The helper gives the URL to the operating system as one argument. It never builds a shell command from the prompt.

## Official Linear catalog request

The catalog itself belongs to Linear. Send them this integration brief:

- **Name:** Quack
- **Platforms:** macOS, Windows, Linux
- **Launch URL:** `quack://open?source=linear&prompt={{prompt}}`
- **Payload:** UTF-8 prompt, at most 32 KiB
- **Behavior:** opens Quack, creates a new draft chat, and never sends automatically
- **Privacy:** the prompt goes directly from Linear to the user’s local Quack app. Quack sends it to a provider only after the user clicks Send.

The official catalog entry still needs to be approved by Linear. Quack can ship the protocol and fallback before that approval, but Quack cannot add itself to Linear’s built-in catalog.

Attach the Quack download link, logo, support contact, and a short screen recording of the flow.
