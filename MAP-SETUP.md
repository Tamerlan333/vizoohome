# Studio map pin-picker: setup and testing (Stage B2)

The property "Xəritədə dəqiq yer (pin)" field now has a **"Xəritədə seç"** button. It opens a MapLibre map where you click (or drag the pin) to set the position. Typing or pasting coordinates still works exactly as before. The map is only loaded when you click the button.

## 1. Install the map library (once)
```powershell
npm install maplibre-gl@5 --save-exact
```
This changes `package.json` and `package-lock.json` (it adds one exact version). Commit both files together with the Stage B2 files, otherwise the online build cannot find the library.

## 2. Get a MapTiler key (development)
1. Create a MapTiler account and create an API key for **development**.
2. In the key settings, set the allowed HTTP origins to `http://localhost:3000` (include the port).
3. The Free plan is for development and testing only (non-commercial). Upgrade to a commercial plan **before the public map goes online**.

## 3. Put the key in `.env.local` (you edit this file yourself)
```
NEXT_PUBLIC_MAPTILER_KEY=your_development_key_here
NEXT_PUBLIC_MAP_STYLE=streets-v2
```
`NEXT_PUBLIC_MAP_STYLE` is optional (default `streets-v2`). Restart `npm run dev` after changing `.env.local`. Never commit real keys: `.env.example` only lists the names.

## 4. Test it (use the TEST dataset, not production)
1. `npm run dev`, open `http://localhost:3000/studio`, open a test listing, find "Xəritədə dəqiq yer (pin)".
2. Click **Xəritədə seç**: the map opens on Baku (or on the saved pin). The credit "© MapTiler © OpenStreetMap contributors" must be visible in the corner.
3. Click the map: the pin appears and the Latitude / Longitude boxes fill in (6 decimals). Drag the pin: the numbers follow.
4. Type new coordinates in the boxes: the pin moves. Click **Pini sil**: the pin disappears.
5. Click **Xəritəni bağla**, then open it again: it starts on the saved pin.
6. Do NOT click Publish on real listings. Check the saved value with the Vision tool: `*[_type=="property"]{title,location}`.
7. Remove the key from `.env.local` and restart: the map area shows a message and the coordinate boxes still work.
8. Try it on a phone-sized browser window too: pinch and drag the pin.

## 5. Before going live
- Upgrade the MapTiler plan (commercial use), then create a separate **production** key restricted to `https://vizoohome.az` and `https://www.vizoohome.az`.
- Add `NEXT_PUBLIC_MAPTILER_KEY` (and optionally `NEXT_PUBLIC_MAP_STYLE`) in the hosting settings (for example Vercel, Environment Variables). Do not reuse the development key.
- Set a monthly spending limit in MapTiler and keep the attribution visible.
- Every Studio map load counts toward MapTiler usage, which is why the map opens only on demand.

## 6. Troubleshooting
| What you see | Likely cause |
|---|---|
| "NEXT_PUBLIC_MAPTILER_KEY təyin olunmayıb" | The variable is missing in `.env.local`, or the dev server was not restarted. |
| "Xəritə yüklənə bilmədi" | Wrong key, the origin (`http://localhost:3000`) is not allowed for the key, or no internet. |
| Build error "Can't resolve 'maplibre-gl'" | Step 1 was skipped, or `package.json` / `package-lock.json` were not committed. |
| Type error "Cannot find module 'maplibre-gl'" | Same: run step 1. |

## 7. Rollback
`git revert` the Stage B2 commit, then `npm uninstall maplibre-gl`. Pins already saved stay in the documents as a harmless extra field.
