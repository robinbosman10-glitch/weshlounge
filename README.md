# Wesh Lounge Discord-bot

Paars rollenpaneel met het Wesh Lounge-logo en twee knoppen:

| Knop | Rol-ID |
| --- | --- |
| 🎉 Giveaway-ping | `1516850805322285258` |
| 🎮 Gaming-ping | `1528781954416378027` |

Klikken geeft de rol; opnieuw klikken verwijdert deze. Bevestigingen zijn privé. Beide rollen kunnen tegelijk worden geclaimd. Oude panelen blijven na een herstart werken; er is geen database nodig.

## Custom giveaways

| Commando | Werking |
| --- | --- |
| `/giveaway` | Opent een formulier voor prijs, duur, aantal winnaars en beschrijving. Extra instellingen openen een tweede formulier met kanaal, pingrol, vereiste rol, ping aan/uit en een optionele eigen afbeelding. Daarna publiceer je via het privé-overzicht. |
| `/giveawaystop` | Stopt de hele actieve giveaway direct. De knoppen worden uitgezet en er wordt **geen winnaar** geloot. Een bericht-ID of link is optioneel; zonder ID kiest de bot de nieuwste actieve giveaway in het kanaal. |

De giveaway heeft knoppen voor **Deelnemen**, **Deelnemers** en **Verlaten**. Het deelnemersaantal wordt live bijgewerkt, dubbel deelnemen is onmogelijk en een optionele vereiste rol wordt gecontroleerd. Na het verstrijken van de tijd kiest de bot automatisch unieke winnaars en maakt hij die bekend. Actieve giveaways, deelnemers en eindtijden worden opgeslagen en na een herstart hervat.

Elke giveaway krijgt automatisch een 1200×600-banner met het echte Wesh Lounge-logo. De exacte prijs komt groot in beeld. Nitro, PlayStation, Xbox, Steam, giftcards, geld en games krijgen automatisch een passende titel en accentkleur. Een beheerder kan in het instellingenformulier ook een eigen achtergrond tot 10 MB uploaden; het logo en de prijs worden daar automatisch overheen gezet. Zonder gekozen pingrol gebruikt de bot standaard Giveaway-ping (`1516850805322285258`). Met de pingkeuze op Nee wordt geen rol gepingd.

Typ alleen `/giveaway`: er zijn geen verplichte slashopties meer. Vul het formulier in, kies eventueel **Extra instellingen**, en klik op **Publiceren**. Je kunt gegevens vooraf aanpassen, een eigen afbeelding weer vervangen door de automatische banner, of het formulier annuleren. Een formulier blijft 30 minuten beschikbaar en kan alleen door de maker worden gebruikt. Bestaande actieve giveaways blijven gewoon werken.

## Online zetten met Railway

1. Maak een Railway-service vanaf deze GitHub-repository. Het Dockerfile installeert de bot en start hem.
2. Voeg onder Variables `DISCORD_TOKEN` toe met het token van je eigen bot. Zet je token nooit in GitHub of in een chatbericht. `TOKEN` wordt ook herkend voor bestaande hostinginstellingen.
3. Optioneel: voeg `GUILD_ID` toe om registratie en gebruik tot één server te beperken. Standaard wordt het commando automatisch in alle servers van deze bot geregistreerd.
4. Voeg een Railway Volume toe met mountpad `/app/data`, zodat actieve giveaways en deelnemers ook na een nieuwe deployment bewaard blijven.
5. Geef de bot **Rollen beheren** en plaats de botrol **boven beide pingrollen**.
6. Geef de bot in de gebruikte kanalen **Kanaal bekijken**, **Berichten verzenden**, **Berichtgeschiedenis lezen**, **Links insluiten** en **Bestanden bijvoegen**. Maak Giveaway-ping vermeldbaar of geef de bot toestemming om rollen te vermelden.
7. Wacht tot de logs melden dat de bot online is en de commando's zijn geregistreerd. Gebruik als beheerder `/rollenpaneel` in het gewenste kanaal.

Geen privileged intents nodig. Het paneel verschijnt voor iedereen; de bevestiging van het plaatsen verschijnt alleen voor de beheerder. Zorg dat de bot met de scopes `bot` en `applications.commands` is toegevoegd als het slashcommando ontbreekt. Draai één botinstantie/replica.

Het startscript herstelt de eigenaar van de gemounte data-map en bestaande giveawaydatabase voordat het naar de `node`-gebruiker overschakelt. Gebruik de standaard startopdracht `npm start`, zodat deze controle wordt uitgevoerd. Het Dockerfile installeert Fontconfig en DejaVu Sans voor de prijs- en type-tekst op de banners. De bot controleert de opslag bij het opstarten en vóór publicatie; bij ontbrekende schrijfrechten wordt geen tijdelijk giveawaybericht geplaatst.

## Advertenties

Beheerders kunnen `/ad discord-link:… rol:… lid:…` gebruiken. De bot plaatst een gewoon bericht met `@rol - @lid`, een lege regel en de uitnodigingslink. Er wordt geen eigen embed toegevoegd; Discord kan zelf een uitnodigingspreview tonen. Alleen de gekozen rol en gebruiker mogen worden gepingd. De rol moet vermeldbaar zijn, of de bot moet toestemming hebben om alle rollen te vermelden. Het gekozen lid moet in de server zitten. De bevestiging is privé; de advertentie is voor het hele kanaal zichtbaar.

## Lokaal uitvoeren

Node.js 24.17 of hoger. Kopieer `.env.example` naar `.env`, vul het token in en voer `npm ci` en `npm start` uit. `npm test` controleert het rollenpaneel, advertenties, dynamische banners, loting, stoppen zonder winnaar en opslag na een herstart. `npm run preview:giveaway` maakt twee echte bannervoorbeelden in `output/`.
