# Auto Quartett – CLAUDE.md

## Übersicht

Supercar-Kartenspiel für Josefs Sohn. Galerie + Quartett-Modus gegen CPU.

- **Live:** https://seppofaz.github.io/AutoQuartett/
- **GitHub:** https://github.com/sEppofaz/AutoQuartett
- **Lokaler Pfad:** `~/Dropbox/Apps/Claude/AutoQuartett/`

---

## Deployment

```bash
cd ~/Dropbox/Apps/Claude/AutoQuartett
git add -p && git commit -m "..." && git push
```

GitHub Pages deployed automatisch aus `main`. Keine Server-Restarts nötig.

**Nach jeder Änderung an app.js / style.css / index.html:**
→ `sw.js` CACHE_NAME hochzählen (v3 → v4 …) damit PWA das Update erkennt.

---

## Dateistruktur

| Datei | Zweck |
|-------|-------|
| `index.html` | App-Gerüst (Tabs, Quartett-Screens, Modal) |
| `app.js` | Gesamte App-Logik |
| `style.css` | Dark Automotive Theme |
| `cars.json` | Basisdaten 33 Autos (SSOT, nicht ändern ohne Schema zu prüfen) |
| `sw.js` | Service Worker – Cache-First, Update-Toast |
| `manifest.json` | PWA-Manifest |
| `images/` | Autofotos + PWA-Icons (icon-180.png, icon-512.png) |

---

## cars.json Schema

```json
{
  "id": "snake_case_unique",
  "name": "Vollständiger Modellname",
  "hersteller": "Hersteller",
  "land": "Deutschland",
  "baujahr": 2024,
  "antrieb": "benziner|elektro|hybrid",
  "kategorie": "legende|supercar|hypercar|elektro|bmw_m",
  "bild": null,
  "kurzbeschreibung": "Max 2 Sätze",
  "preis_eur": 250000,
  "preis_note": "optional oder null",
  "leistung_ps": 500,
  "leistung_kw": 368,
  "drehmoment_nm": 600,
  "gewicht_kg": 1400,
  "nullhundert_s": 3.5,
  "vmax_kmh": 320,
  "reichweite_km": null,
  "hubraum_ccm": 3996,
  "zylinder": 6,
  "preis_pro_ps": 500,
  "leistungsgewicht_kg_ps": 2.80,
  "nurburgring_min": null
}
```

**Custom Cars** (via localStorage) haben zusätzlich `"custom": true` und `"bild": "https://..."` (Wikipedia-URL).

---

## Backend – Claude API Proxy (Hetzner)

**Endpoint:** `POST https://umbenennen.duckdns.org/autoquartett/car-lookup`
**Request:** `{ "name": "Bugatti Chiron" }`
**Response:** vollständiges car-Objekt inkl. `bild`-URL (Wikipedia)

**Serverpfad:** `/opt/rename-webhook/services/autoquartett/routes.py`
**Blueprint:** `autoquartett_bp` – in `webhook.py` registriert
**Modell:** `claude-haiku-4-5-20251001` (~0,001–0,002 € pro Lookup)
**CORS:** nur `https://seppofaz.github.io` erlaubt

Deployment: wie alle rename-webhook Services → `git push` auf Mac, dann auf Server:
```bash
ssh root@89.167.104.145 "git -C /opt/rename-webhook pull && systemctl restart rename-webhook"
```

---

## localStorage Keys

| Key | Inhalt |
|-----|--------|
| `aq_custom` | Array custom cars (JSON) |

---

## PWA – Pitfalls

- **sw.js CACHE_NAME** nach jeder Änderung hochzählen: `autoquartett-v3` → `v4`
- **`updateViaCache: 'none'`** in `register()` – GitHub Pages cached sw.js, ohne diese Option erkennt iOS-PWA kein Update
- **`visibilitychange`-Handler** ruft `reg.update()` auf – iOS friert PWAs ein statt zu beenden, DOMContentLoaded läuft nicht neu durch
- **`reg.update()`** wird bereits beim App-Start aufgerufen – reicht für Browser, nicht für iOS PWA allein

---

## Spielkategorien (7 Stück)

| key | Einheit | Wer gewinnt |
|-----|---------|-------------|
| `preis_eur` | € | höher |
| `leistung_ps` | PS | höher |
| `drehmoment_nm` | Nm | höher |
| `vmax_kmh` | km/h | höher |
| `nullhundert_s` | s | **niedriger** |
| `leistungsgewicht_kg_ps` | kg/PS | **niedriger** |
| `preis_pro_ps` | €/PS | höher |
