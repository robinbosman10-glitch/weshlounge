# Wesh Lounge Discord-bot

Paars rollenpaneel met het Wesh Lounge-logo en twee knoppen:

| Knop | Rol-ID |
| --- | --- |
| 🎉 Giveaway-ping | `1516850805322285258` |
| 🎮 Gaming-ping | `1528781954416378027` |

Klikken geeft de rol; opnieuw klikken verwijdert deze. Bevestigingen zijn privé. Beide rollen kunnen tegelijk worden geclaimd. Oude panelen blijven na een herstart werken; er is geen database nodig.

## Online zetten met Railway

1. Maak een Railway-service vanaf deze GitHub-repository. Het Dockerfile installeert de bot en start hem.
2. Voeg onder Variables `DISCORD_TOKEN` toe met het token van je eigen bot. Zet je token nooit in GitHub of in een chatbericht. `TOKEN` wordt ook herkend voor bestaande hostinginstellingen.
3. Optioneel: voeg `GUILD_ID` toe om registratie en gebruik tot één server te beperken. Standaard wordt het commando automatisch in alle servers van deze bot geregistreerd.
4. Geef de bot **Rollen beheren** en plaats de botrol **boven beide pingrollen**.
5. Geef de bot in het paneelkanaal **Kanaal bekijken**, **Berichten verzenden**, **Links insluiten** en **Bestanden bijvoegen**.
6. Wacht tot de logs melden dat de bot online is en `/rollenpaneel` is geregistreerd. Gebruik als beheerder `/rollenpaneel` in het gewenste kanaal.

Geen privileged intents nodig. Het paneel verschijnt voor iedereen; de bevestiging van het plaatsen verschijnt alleen voor de beheerder. Zorg dat de bot met de scopes `bot` en `applications.commands` is toegevoegd als het slashcommando ontbreekt. Draai één botinstantie/replica.

## Advertenties

Beheerders kunnen `/ad discord-link:… rol:… lid:…` gebruiken. De bot plaatst een gewoon bericht met `@rol - @lid`, een lege regel en de uitnodigingslink. Er wordt geen eigen embed toegevoegd; Discord kan zelf een uitnodigingspreview tonen. Alleen de gekozen rol en gebruiker mogen worden gepingd. De rol moet vermeldbaar zijn, of de bot moet toestemming hebben om alle rollen te vermelden. Het gekozen lid moet in de server zitten. De bevestiging is privé; de advertentie is voor het hele kanaal zichtbaar.

## Lokaal uitvoeren

Node.js 24.17 of hoger. Kopieer `.env.example` naar `.env`, vul het token in en voer `npm ci` en `npm start` uit. `npm test` controleert het paneel, de rolkoppelingen en het toekennen/verwijderen met gemockte Discord-aanroepen.
