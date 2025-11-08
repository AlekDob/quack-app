# 🔔 Setup Discord Notifications

## Step 1: Crea un Webhook su Discord

1. Apri Discord e vai sul server dove vuoi ricevere le notifiche
2. Click destro sul canale → **Edit Channel**
3. Vai su **Integrations** → **Webhooks**
4. Click **"New Webhook"**
5. Personalizza:
   - **Name**: Quack Releases
   - **Channel**: Scegli il canale (#releases, #general, etc.)
   - (Opzionale) Cambia l'avatar con un'icona duck 🦆
6. Click **"Copy Webhook URL"**

L'URL avrà questo formato:
```
https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz
```

---

## Step 2: Aggiungi il Webhook a GitHub

1. Vai su GitHub repository settings:
   ```
   https://github.com/alekdob/quack-app/settings/secrets/actions
   ```

2. Click **"New repository secret"**

3. Compila:
   - **Name**: `DISCORD_WEBHOOK`
   - **Secret**: Incolla l'URL del webhook copiato da Discord

4. Click **"Add secret"**

---

## Step 3: Testa la Configurazione

Quando farai la tua prima release su production, riceverai un messaggio su Discord come questo:

```
🦆 New Quack Release!

Version v0.1.1 is now available!

📦 Downloads
GitHub Releases

🔄 Auto-Update
Existing users will be notified automatically
```

---

## Personalizzazione Avanzata (Opzionale)

Puoi personalizzare il messaggio Discord modificando il file:
```
.github/workflows/production-release.yml
```

Cerca la sezione "Send Discord Notification" e modifica:
- **title**: Il titolo dell'embed
- **description**: La descrizione
- **color**: Il colore del bordo (5814783 = blu Quack)
- **fields**: I campi informativi

---

🦆 **Done!** Ora riceverai notifiche Discord ad ogni release!
