# Implementierungsplan: Two-Way Fan Chart (Issue #95)

Basiert auf: [Design-Dokument](design-two-way-fan-chart.md)
Basis: v3.2.x
Branch: `feature/two-way-fan-chart`

> **Abweichungen von der Originalplanung (Stand 2026-04-12)**:
>
> - **F8 (Family Colors) und F10 (Marriage-Arc)** wurden in v3.3.0 statt
>   v3.4.0 implementiert. Marriage-Arcs werden fuer Nachkommen-Partner
>   angezeigt, Family Colors faerben Partner-Arcs und Kinder-Arcs pro
>   Partner-Familie.
> - **Descendant IDs** verwenden sequentielle Integers statt der geplanten
>   xref-basierten String-IDs. Die xref-basierte Strategie aus dem Design-
>   Dokument wurde zugunsten einfacherer sequentieller IDs aufgegeben.
> - **F6 (Places)** ist teilweise umgesetzt: Places werden fuer Nachkommen
>   angezeigt wenn die Arc-Breite ausreicht (>= 20deg). Bei schmalen Arcs
>   werden kompakte Jahr-only-Dates verwendet. Images (F7) bleiben v3.4.0.

## Vorgehensweise

Umsetzung per **TDD (Test-Driven Development)**:

1. Test schreiben der das erwartete Verhalten beschreibt (Red)
2. Minimalen Code schreiben der den Test bestehen laesst (Green)
3. Refactoring ohne Verhaltensaenderung (Refactor)

Tests werden **phasenbegleitend** geschrieben, nicht gesammelt am Ende.
Jeder Schritt der PHP-Code aendert bekommt einen PHPUnit-Test davor.
JS-Aenderungen werden per Playwright verifiziert sobald sie visuell
testbar sind. Phase 4 ist reine Integrationsverifikation.

PHPUnit via `make bash` im buildbox Container.
Playwright mit Headless Chrome via CDP.

## v3.3.0 (MVP)

Feste Tiefe=1 (Partner + Kinder), Ceiling 270deg / Floor 180deg wenn
showDescendants aktiv, volle NodeData (keine Subclass), direkte
Arc-Berechnung ohne zweite D3-Hierarchie. Zusaetzlich (ueber den
urspruenglichen MVP-Umfang hinaus): Marriage-Arcs fuer Nachkommen-Partner
(F10), Family Colors pro Partner-Familie (F8), Places bei ausreichend
breiten Arcs (F6 teilweise). IDs verwenden sequentielle Integers
(Abweichung von der geplanten xref-basierten Strategie).

### Vor Phase 1: Pre-Implementierungs-Checks

1. **Issue #95 validieren**: Issue nochmal lesen und pruefen ob die Community-
   Anfrage mit dem geplanten MVP (Partner + Kinder der Zentralperson)
   uebereinstimmt. Falls User "kompletten Nachkommen-Baum" erwarten,
   Abgrenzung im Issue-Kommentar klar kommunizieren.
2. **Repo-weiter Grep nach Generation-Annahmen**: Pruefen ob irgendwo im
   Backend stillschweigend angenommen wird dass Generationen nicht-negativ
   sind (`$generation > 0`, `$generation >= 1`, `generation < X` etc.).
   Potentielle Stellen: DateProcessor, PlaceProcessor, buildTimespan().
3. **spouseFamilies() Sortierung** (bereits verifiziert): `spouseFamilies()`
   nutzt `facts(['FAMS'], false, ...)` -- `sort=false` = GEDCOM-Record-
   Reihenfolge, NICHT Heiratsdatum. Tests duerfen sich nicht auf
   chronologische Sortierung verlassen.

### Phase 1: PHP Datenstruktur

#### Schritt 1.1: Node.php erweitern

**Datei**: `src/Model/Node.php`

- `protected array $partners = []` Property
- `protected array $children = []` Property
- `addPartner(Node $partner): self`
- `setChildren(array $children): self`
- `getPartners(): array`
- `getChildren(): array`
- `protected array $unassignedChildren = []` Property (fuer Privacy-Fall:
  sichtbare Kinder ohne sichtbaren Partner)
- `addUnassignedChild(Node $child): self`
- `getUnassignedChildren(): array`
- `jsonSerialize()`: `partners`, `children` und `unassignedChildren` nur
  serialisieren wenn nicht leer

**Test zuerst**: Unit-Test fuer Node-Serialisierung:
  - Node ohne Partners/Children -> kein `partners`/`children` Key im JSON
  - Node mit Partner -> `partners` Array im JSON
  - Node mit Partner + Children -> verschachteltes JSON

#### Schritt 1.2: Configuration.php erweitern

**Datei**: `src/Configuration.php`

- `getShowDescendants(): bool` (Default: false)
- `getFanDegreeUnclamped(): int` -- gibt den isBetween+integer()-Wert OHNE
  Descendant-Clamp zurueck (wird in page.phtml fuer fanDegreeRaw Init benoetigt)
- `getFanDegree()`: bei `getShowDescendants() === true` auf 180-270 clampen.
  Reihenfolge: erst `isBetween(180, 360)` + `integer()` (gibt Default bei
  Out-of-Range zurueck, kein Clamping), dann `min(270, max(180, $result))`
  als nachgelagerter Clamp auf dem integer()-Ergebnis
- Keine neuen Slider oder Konstanten fuer Nachkommen-Generationen in v3.3.0

**Test zuerst**: Unit-Tests:
  - `getShowDescendants()` Default = false
  - `getFanDegree()` gibt 300 zurueck wenn showDescendants=false und Wert=300
  - `getFanDegree()` gibt 270 zurueck wenn showDescendants=true und Wert=300
  - `getFanDegree()` gibt 210 zurueck wenn showDescendants=true und Wert=210
  - `getFanDegree()` gibt 210 zurueck wenn showDescendants=true und Wert=90
    (isBetween(180,360) rejected 90, Fallback auf Default 210, Clamp laesst 210)

#### Schritt 1.3: DataFacade.php erweitern

**Datei**: `src/Facade/DataFacade.php`

- Neue private Methode `buildDescendantStructure(Node $rootNode, Individual $individual): void`
  - Iteriert ueber `$individual->spouseFamilies()`
  - Pro Familie: Spouse ermitteln via `$family->spouse($individual)` (Argument
    erforderlich -- zero-argument Call wirft `ArgumentCountError`)
  - **Privacy-Check**: Wenn spouse() null zurueckgibt, pruefen ob ein
    HUSB/WIFE-Pointer im Family-Record existiert. Wenn ja: Spouse ist
    privacy-hidden -> KEINEN leeren Partner-Node erzeugen (wuerde Existenz
    eines privaten Partners leaken). Wenn nein: genuiner "unbekannter Partner".
  - Partner-Node mit `getNodeData(1, $spouse)` am Call-Site (generation=1,
    da getNodeData() immer positive Generationen erwartet),
    danach `->setGeneration(-1)` auf dem zurueckgegebenen NodeData.
    **v3.3.0 Feld-Suppression** (**Abweichung**: Places und Marriage-Daten
    werden in der tatsaechlichen Implementierung NICHT mehr unterdrueckt,
    da F6/F10 in v3.3.0 vorgezogen wurden. Places werden bei ausreichend
    breiten Arcs (>= 20deg) angezeigt, Marriage-Arcs fuer Partner sind
    aktiv. Images werden weiterhin unterdrueckt (F7 bleibt v3.4.0).
    Schmale Arcs verwenden kompakte Jahr-only-Dates.)
    Urspruenglicher Plan war, nach `getNodeData()` fuer Nachkommen
    folgende Felder zu leeren:
    - ~~Places: `->setBirthPlace('')->setDeathPlace('')->setMarriagePlace('')`~~
    - Images: `->setThumbnail('')`
    - ~~Marriage-Daten: `->setMarriageDate('')->setMarriageDateOfParents('')`~~
      ~~(marriageDate zeigt die Ehe des Partners, nicht der Zentralperson;~~
       ~~marriageDateOfParents zeigt die Ehe der Eltern des Partners --~~
       ~~beides ist fuer Nachkommen-Arcs semantisch falsch)~~
    - ~~Timespan: `->setTimespan(...)` muss NEU berechnet werden ohne Places,~~
      ~~da `buildTimespan()` Places in den composite String einbaut BEVOR~~
      ~~die Place-Felder geleert werden.~~
    Dates (birth, death) bleiben erhalten -- sie erscheinen in v3.3.0
    Nachkommen-Arcs als Jahr/Datum-Beschriftung.
    Wenn Spouse null UND kein HUSB/WIFE-Pointer: `createEmptyPartnerNode(-1)`.
    Wenn Spouse hidden (HUSB/WIFE-Pointer vorhanden aber spouse()=null):
    KEINEN Partner-Node erzeugen. Sichtbare Kinder dieser Familie als
    `unassignedChildren` an Root-Node haengen (via `addUnassignedChild()`).
    Kein `continue` -- Kinder muessen verarbeitet werden, nur Partner fehlt.
  - Pro Familie: Kinder-Nodes mit `getNodeData(2, $child)` am Call-Site (generation=2),
    danach `->setGeneration(-2)` auf dem zurueckgegebenen NodeData.
  - Partner ohne Kinder: Partner-Arc trotzdem erstellen (leeres children Array)
  - Partner-Node bekommt Kinder via `setChildren()`
  - Root-Node bekommt Partner via `addPartner()`
- Neue private Methode `createEmptyPartnerNode(int $generation): NodeData`
  - Erstellt neues NodeData-Objekt
  - Ruft `->setId(++$this->nodeId)` auf (kritisch: ID-Vergabe nicht vergessen)
  - Ruft `->setGeneration($generation)` und `->setSex('U')` auf
  - Alle anderen Felder bleiben Default (leere Strings)
  - Gibt NodeData zurueck (wird dann in `new Node(...)` gewrapped)
- In `createTreeStructure()`: nach Vorfahren-Aufbau `buildDescendantStructure()`
  aufrufen wenn `showDescendants=true`

**Hinweis**: `getNodeData()` erhaelt immer positive Generationen (1 fuer Partner,
2 fuer Kinder). Die tatsaechliche negative Generation (-1, -2) wird erst danach
via `->setGeneration()` gesetzt. So bleibt `getNodeData()` semantisch
ancestor-oriented und DateProcessor/PlaceProcessor berechnen korrekte Detailtiefe.

**Test zuerst**: Unit-Tests mit Mock-Individual:
  - Keine Partner -> kein `partners` Key im JSON (Key wird weggelassen, nicht leeres Array)
  - Partner ohne Kinder -> Partner-Node mit leeren `children`
  - Partner unbekannt + Kinder vorhanden -> leerer Partner-Node + Kinder
  - Mehrere Partner -> korrekte Reihenfolge
  - generation-Werte: Partner = -1, Kinder = -2
  - createEmptyPartnerNode: PHP-NodeData ID ist sequentiell (++$this->nodeId,
    intern fuer NodeData). Die JS-seitige synthetische Node-ID ist
    `"desc-empty-" + sanitizedFamilyXref` (fuer D3 data-join Stabilitaet).
    generation = -1, sex = 'U'
  - Hidden spouse + sichtbare Kinder -> `unassignedChildren` im Root-JSON,
    kein `partners` Key fuer diese Familie
  - Hidden spouse + keine sichtbaren Kinder -> weder `partners` noch
    `unassignedChildren` fuer diese Familie

#### Schritt 1.4: Module.php + URL-Parameter

**Dateien**: `src/Module.php`, `src/Facade/DataFacade.php`, `src/Traits/ModuleChartTrait.php`

`showDescendants` aendert die **Datenstruktur** der Server-Response (nicht nur
die Darstellung), daher muss es als URL-Parameter gefuehrt werden (nicht nur
Client-Storage wie showFamilyColors/showImages).

PHP-seitige URL-Pfade:

1. `handle()`: showDescendants aus Request lesen, an View und Redirect durchreichen
2. `getUpdateAction()`: showDescendants aus Request lesen, an `createTreeStructure()` uebergeben
3. `getAjaxRoute()`: showDescendants Parameter in AJAX-URL aufnehmen
4. `DataFacade::getUpdateRoute()`: showDescendants in jede Node-`updateUrl`
   einbauen -- auch fuer Nachkommen-Nodes selbst
5. `ModuleChartTrait::chartUrl()`: showDescendants in Menu-Links aufnehmen

**Test zuerst**: PHPUnit-Tests:
  - updateUrl in JSON-Response enthaelt `showDescendants=1` als URL-Parameter
  - Nachkommen-Node updateUrl enthaelt ebenfalls `showDescendants=1`
  - getAjaxRoute() enthaelt showDescendants Parameter

### Phase 2: JavaScript

#### Schritt 2.1: configuration.js erweitern

**Datei**: `resources/js/modules/custom/configuration.js`

- `showDescendants = false` im Options-Objekt-Destructuring
- `fanDegree` Setter: bei `this._showDescendants === true` auf 180-270 clampen
- Getter/Setter fuer `showDescendants`
- Beim Setzen von `showDescendants = false`: gespeicherten fanDegree-Wert
  wiederherstellen aus `storedFanDegreeRaw` (in Storage persistiert).
  Nie aus dem aktuell sichtbaren Slider-Wert zurueckrechnen (der ist ggf.
  schon geclampt). Autoritaet: Storage > Configuration > Slider DOM.
- **`childScale` Property + Setter**: `setChildScale(scale)` / `get childScale()`
  Wird von `hierarchy.js::initDescendants()` aufgerufen. Da Configuration ein
  Singleton pro Chart ist, erreicht die Scale alle Geometry-Instanzen automatisch.
  Initialwert: `this._childScale = null`.

#### Schritt 2.2: hierarchy.js erweitern

**Datei**: `resources/js/modules/custom/hierarchy.js`

- In `init(datum)`: nach Vorfahren-Partition die Nachkommen-Nodes erstellen
- **Hinweis**: DOM-Cleanup von desc-Nodes vor dem data-join wird in
  **update.js** (Schritt 2.7) durchgefuehrt, nicht hier in hierarchy.js.
  hierarchy.js ist nur fuer die Nodes-Array-Erstellung zustaendig.
- Neue private Methode `initDescendants(datum)`:
  - Liest `datum.partners` Array und `datum.unassignedChildren` (Privacy-Fall)
  - Berechnet Winkelbereich als lokale Variablen:
    `startChildPi`, `endChildPi`, 10deg Offset, lineare Skalierung
  - **Winkel-Aufteilung -- zwei verschiedene Gewichtungsformeln**:
    - **Partner-Familien**: `weight = max(1, childCount)` pro Familie.
      Partner ohne Kinder erhalten weight=1 als Mindest-Anteil.
    - **unassignedChildren** (Privacy-Fall): eigener Winkelblock NACH allen
      Partner-Familien. `weight = childCount` (NICHT max(1,...) --
      mindestens 1 Kind ist garantiert da sonst kein unassignedChildren-
      Eintrag existiert).
    - Formel fuer beide: `angle = totalAngle * weight / sum(alleWeights)`
    Ziel-Mindestbreite 20deg pro Partner-Arc: wenn proportionale Aufteilung
    < 20deg ergibt, Gleichverteilung verwenden. Falls auch Gleichverteilung
    < 20deg (zu viele Partner fuer verfuegbaren Platz), Breite akzeptieren
    und Text kuerzen -- 20deg ist Richtwert, kein harter Floor.
    Kinder innerhalb eines Partner-Arcs gleichmaessig aufgeteilt.
  - Erstellt synthetische Nodes mit vollstaendiger Property-Struktur:
    D3-Properties: `id`, `depth`, `x0`, `x1`, `parent: null`,
    `children: null`, `height: 0`, `value: 1`, `data`
    Synthetische Metadaten: `descendantType`, `familyXref`,
    `partnerXref`, `rootXref`, `syntheticParentId`
  - Depth im ID-Prefix verhindert Kollision bei Dual-Role-Personen
    (z.B. Person ist gleichzeitig Kind UND Partner)
  - Partner-IDs: `"desc--1-" + sanitizedXref`
  - Kinder-IDs: `"desc--2-" + sanitizedXref`
  - Xref-Sanitisierung: `xref.replace(/[^a-zA-Z0-9_-]/g, '_')` fuer
    CSS-Selector-Kompatibilitaet (GEDCOM xrefs koennen `@` enthalten)
  - Fuer leere Partner: id = `"desc-empty-" + sanitizedFamilyXref`
    (Family xref, NICHT familyIndex -- Index waere instabil bei
    Sortierungs-Aenderungen von spouseFamilies())
  - x0/x1 werden im normalisierten [0,1] Bereich gespeichert (wie
    D3-Partition-Nodes), nicht als Radians
  - Partner: `depth = -1`
  - Kinder: `depth = -2`, gleichmaessig unter dem jeweiligen Partner-Arc verteilt
  - Haengt Nodes an `this._nodes` an
- Vorfahren-Nodes behalten Integer-IDs (von hierarchy.js::init() via forEach vergeben)
- `createEmptyNode()` erweitern fuer negative Generationen

#### Schritt 2.3: geometry.js erweitern

**Datei**: `resources/js/modules/custom/svg/geometry.js`

- `innerRadius(depth)`: `if (depth < 0)` Fallunterscheidung --
  Radien wachsen nach aussen im Nachkommen-Bereich
- `outerRadius(depth)`: analog
- `startAngle(depth, x0)`: bei `depth < 0` eigene Winkel-Berechnung
  (basierend auf x0/x1 die in hierarchy.js bereits korrekt gesetzt wurden)
- `endAngle(depth, x1)`: analog
- **RTL-Fix -- `isPositionFlipped()`**: Compound-Condition statt einfachem
  Ersetzen:
  ```javascript
  if (depth === 0) return false;           // Center: nie flippen
  if (depth < 0) {
      if (!this._configuration.childScale) return false;  // null-guard
      const midAngle = this._configuration.childScale((x0 + x1) / 2);
      return (midAngle > (90 * MATH_DEG2RAD))
          && (midAngle < (270 * MATH_DEG2RAD));
  }
  // WICHTIG: fanDegree <= 270 Guard ERHALTEN fuer depth >= 1!
  if (this._configuration.fanDegree <= 270) return false;
  // depth >= 1: bestehende midAngle-Pruefung UNVERAENDERT
  ```
  Wichtig: Das VERHALTEN fuer depth=1 Vorfahren in 360°-Charts darf sich
  nicht aendern. Die neue Compound-Condition ersetzt `depth < 1` durch
  `depth === 0` + `depth < 0` Branches. Fuer depth=1 aendert sich nichts:
  es faellt wie bisher in die bestehende midAngle-Pruefung (depth >= 1 Pfad).
- **Child-Scale Zugriff**: Geometry liest `this._configuration.childScale`.
  Die Scale wird von `hierarchy.js::initDescendants()` via
  `configuration.setChildScale(scale)` gesetzt (siehe Schritt 2.1).
  Da alle Geometry-Instanzen (person.js, text.js, label-renderer.js,
  marriage.js, chart.js) dasselbe Configuration-Objekt teilen, erreicht
  die Scale automatisch alle Instanzen.
  **Null-Guard**: Alle Geometry-Methoden die childScale nutzen
  (`startAngle`, `endAngle`, `isPositionFlipped` bei `depth < 0`)
  muessen pruefen: `if (!this._configuration.childScale) return 0`
  (bzw. `return false`).

#### Schritt 2.4: text.js erweitern

**Datei**: `resources/js/modules/custom/svg/text.js`

- `isInnerLabel(datum)`: Condition erweitern:
  `(depth > 0 && depth <= numberOfInnerCircles) || (depth === -1)`
  Partner depth=-1 = inner label, Kinder depth=-2 = outer label
- `getAvailableWidth(datum, index)`: expliziter `else if (depth < 0)` Branch
  der die Breite basierend auf dem Nachkommen-Arc-Chord berechnet. Ohne diesen
  Branch fallen negative Depths in den Center-Circle-Width-Pfad (zu breit).
  **Achtung Sequenzierung**: Dieser Branch ruft `geometry.innerRadius()`/
  `outerRadius()` fuer negative Depths auf. Schritt 2.3 (geometry.js) muss
  daher vor Schritt 2.4 abgeschlossen sein.
- `createPathDefinition()`: negative Depths fuer Arc-Pfade
- `transformOuterText()`: Rotation fuer negative Depths anpassen.
  **Zwei Fixes noetig**:
  (a) Der direkte `this._geometry.scale()` Aufruf (ca. Zeile 882) nutzt die
  Vorfahren-Skala -- muss fuer depth < 0 durch `startAngle()/endAngle()` ersetzt
  werden (dispatchen via childScale).
  (b) Die Rotationsrichtungs-Logik `if (angle > 0)` (Zeile ~885) ist fuer
  Vorfahren-Geometrie designed. Fuer depth < 0: dieselbe Formel wie
  `isPositionFlipped()` verwenden -- `childScale((x0+x1)/2)` berechnen,
  gegen `[90*MATH_DEG2RAD, 270*MATH_DEG2RAD]` pruefen. Das `flipped`-Ergebnis
  bestimmt die Rotationsrichtung statt `angle > 0`.
  Ebenso: `calculateOuterSlotPositions()` rechnet `(x1 - x0) * 360` -- das
  funktioniert korrekt weil x0/x1 fuer Nachkommen in [0,1] normalisiert sind
  (gleiche Domaene wie D3-Partition-Nodes).

(`isPositionFlipped` wird in geometry.js gefixt, nicht hier -- text.js
delegiert an geometry.)

#### Schritt 2.5: person.js erweitern

**Datei**: `resources/js/modules/custom/svg/person.js`

- `addArcToPerson()`: padRadius bei negativen Depths anpassen
- `getFontSize()`: **Achtung: lebt in geometry.js, nicht person.js!** person.js
  ruft `this._geometry.getFontSize(datum)` auf. Fix in **geometry.js** (Schritt 2.3):
  `Math.abs(depth)` in der Formel verwenden. Outer-Arc-Cap muss auch fuer
  depth < 0 Kinder-Arcs greifen. Bestehende Condition `depth >= numberOfInnerCircles + 1`
  ist false fuer negative Depths. Neuer Branch:
  `if (depth < 0 && Math.abs(depth) >= 2)` analog zum Outer-Cap.
- `addColorGroup()`: negative Depths unterstuetzen (vorerst nur M/F-Farben)
- **hideEmptySegments-Guard**: Fuer Nachkommen-Nodes (`depth < 0`)
  `hideEmptySegments` ignorieren -- leere Partner-Arcs muessen sichtbar bleiben
  (strukturell notwendig fuer Kinder-Zuordnung). **Sekundaerer** Guard -- die
  primaere Blockade ist in chart.js (Schritt 2.6).

#### Schritt 2.6: chart.js erweitern

**Datei**: `resources/js/modules/custom/chart.js`

- `personClick()`: bei negativen Depths gleichen AJAX-Update-Mechanismus nutzen
  (updateUrl, NICHT Page-Reload wie im Fork).
  **Guard**: Wenn `datum.data.data.updateUrl === ''` (leerer Partner-Node),
  NICHT `update('')` aufrufen (wuerde `d3.json('')` crashen). Stattdessen:
  Klick ignorieren (`return` ohne Aktion). Leere Partner-Nodes sind
  Platzhalter ohne eigene Daten -- ein Redirect waere sinnlos.
- `draw()`: Nachkommen-Nodes in personGroup-Binding einschliessen.
  **Wichtig**: Der D3-`.filter()` in draw() (Zeile ~184) eliminiert Nodes mit
  `xref=""` wenn `hideEmptySegments=true` BEVOR g.person erstellt wird. Fuer
  `depth < 0` Nodes muss dieser Filter uebersprungen werden:
  `(datum.data.data.xref !== "") || !hideEmptySegments || (datum.depth < 0)`
  Ohne diesen Fix werden leere Partner-Nodes (unknown spouse) nie im DOM erstellt
  und der person.js Guard (Schritt 2.5) laeuft nie.
- **Guards fuer bestehende Features**:
  - `drawFamilySeparators()`: bestehende Schleife `for (depth = 1; ...)`
    filtert negative Depths bereits -- kein zusaetzlicher Guard noetig
  - `drawMarriageArcs()`: bestehender Filter `datum.children && ...`
    filtert synthetische Nodes (children=null) bereits -- kein Guard noetig
  - **FamilyColor Guard** (in `family-color.js`, nicht chart.js):
    `getColor()` braucht `if (datum.depth < 0) return null` als erste Zeile
    BEVOR refMidpoint berechnet wird. Dieser Guard verhindert die Vorfahren-
    basierte refMidpoint-Logik fuer Nachkommen. Nachkommen-Family-Colors
    (F8, jetzt v3.3.0) verwenden separate Farb-Logik pro Partner-Familie.

#### Schritt 2.7: update.js erweitern

**Datei**: `resources/js/modules/custom/update.js`

- **Vor** dem data-join: alle `g.person` Elemente deren DOM-ID mit "person-desc-"
  beginnt (DOM-ID = `"person-" + datum.id`, also Selector: `[id^="person-desc-"]`)
  erst `.interrupt()` aufrufen (stoppt laufende Transitions und deren
  Callbacks), dann `.remove()`. Das verhindert DOM-Orphan-Akkumulation.
  **Unconditional**: Cleanup muss IMMER laufen, unabhaengig von
  `hideEmptySegments`. Bei `hideEmptySegments=false` werden 'remove'-
  klassifizierte Nodes nur grau gefaerbt, NICHT aus dem DOM entfernt.
  Ohne expliziten pre-join Cleanup bleiben alte Descendant-Arcs als
  graue Geister-Elemente im DOM.
  **Hinweis**: Beim Checkbox-Toggle laeuft ein vollstaendiger AJAX-Block-Reload
  via `webtrees.load()` der das DOM komplett ersetzt -- update.js Cleanup
  ist dann nicht noetig (DOM ist schon weg).
- `update()`: Nachkommen-Nodes in Klassifizierung (new/update/remove) einbeziehen
- Crossfade-Transitions auch fuer negative-depth Elemente
- `updateDone()`: Cleanup auch fuer Nachkommen-Elemente

#### Schritt 2.8: index.js erweitern

**Datei**: `resources/js/modules/index.js`

- `showDescendants` aus Options an Configuration durchreichen

### Phase 3: UI und Views

#### Schritt 3.1: Form-Controls

**Dateien**:
- `resources/views/modules/fan-chart/form/layout.phtml` -- Checkbox "Show descendants"
  mit `<small class="form-text text-muted">` Beschreibung:
  "Partners and children are shown as arcs below the ancestor section.
  The fan size is limited to 180-270 degrees when enabled.
  Images for descendants will be added in a future release."
  **onChange**: Muss AJAX-Reload ausloesen (nicht nur Client-Redraw), weil
  `showDescendants` die Server-Response-Struktur aendert.
  **Achtung**: Kein bestehendes Checkbox-Pattern in page.phtml loest AJAX-
  Reloads aus -- alle anderen Checkboxes schreiben nur in Storage und wirken
  erst beim naechsten POST. Fuer showDescendants braucht es NEUEN Code:
  ```javascript
  // container muss ein RAW DOM Element sein, keine D3-Selection!
  // webtrees.load() ruft element.innerHTML direkt auf.
  // AJAX-Container ist #fan-chart-url, NICHT das Chart-Element
const container = document.getElementById("fan-chart-url");
  checkbox.addEventListener("change", () => {
      storage.write("showDescendants", checkbox.checked ? "1" : "0");
      const url = getUrl(/* alle Parameter inkl. showDescendants */);
      container.setAttribute("data-wt-ajax-url", url);
      webtrees.load(container, url);  // ZWEI Argumente: element + url
  });
  ```
  Ein clientseitiges `draw()` waere falsch weil es den update.js Cleanup-Pfad
  fuer desc-Elemente nicht durchlaeuft und stattdessen den DOM komplett neu
  aufbaut (ohne die saubere new/update/remove Klassifizierung). Zoom/Pan-State
  geht bei beiden Ansaetzen (draw() und webtrees.load()) verloren -- das ist
  nicht der Unterscheidungsgrund.
  **Idempotenz-Strategie**: Der showDescendants Checkbox-Handler liegt in
  page.phtml (AUSSERHALB des AJAX-Blocks). Die Checkbox selbst liegt in
  layout.phtml (Teil des Form-Bereichs, ebenfalls ausserhalb des AJAX-Blocks).
  Da weder Handler noch Checkbox vom AJAX-Reload betroffen sind, gibt es kein
  Double-Binding-Problem. Der Handler muss nur einmal registriert werden und
  bleibt stabil ueber Reloads hinweg.
  **Implementierungs-Hinweis**: Bei der Implementierung pruefen ob
  `webtrees.load(element, url)` das DOM komplett ersetzt oder nur den
  AJAX-Block neulaed. Falls komplett ersetzt: der update.js Cleanup-Pfad
  (interrupt+remove desc-Nodes) wird ggf. nicht durchlaufen, weil das DOM
  schon weg ist. Falls nur AJAX-Block: Cleanup laeuft normal. Das Verhalten
  muss bei der Implementierung empirisch getestet werden.
- `resources/views/modules/fan-chart/form/fan-size.phtml` -- Slider min/max
  conditional auf 180/270 wenn showDescendants aktiv. JS Event-Handler
  auf showDescendants-Checkbox der:
  (a) Slider min/max HTML-Attribute im DOM aktualisiert
  (b) `input.value` explizit auf `Math.min(270, Math.max(180, input.value))` clampt
  (c) `oninput` Event manuell feuert oder Output-Label direkt aktualisiert
  (Browser clampt value NICHT automatisch bei min/max-Aenderung und das
  Output-Label aktualisiert sich nur via oninput-Event)
- `resources/views/modules/fan-chart/page.phtml` -- `storage.register("showDescendants")`,
  `storage.register("fanDegreeRaw")` (ungeclampter User-Wert fuer Restore),
  JS-Variable, `getUrl()` um showDescendants erweitern.
  **Initial-Write** (muss als ERSTE Operation in page.phtml laufen, VOR
  Event-Handler-Registrierung): Beim Laden `fanDegreeRaw` mit dem ungeclampten
  Wert initialisieren falls nicht vorhanden. **Achtung**: `getFanDegree()`
  gibt ggf. den geclampten Wert zurueck wenn showDescendants=true.
  Fuer fanDegreeRaw brauchen wir den UNGECLAMPTEN Wert. Loesung:
  `$configuration->getFanDegreeUnclamped()` -- neue Methode in Configuration.php
  die den isBetween+integer()-Wert OHNE Descendant-Clamp zurueckgibt.
  `storage.read("fanDegreeRaw") ?? <?= json_encode($configuration->getFanDegreeUnclamped()) ?>`
  (Hinweis: `$module` steht in page.phtml nicht zur Verfuegung, daher
  getPreference() direkt aufrufen ist keine Option.)
- `resources/views/modules/fan-chart/chart.phtml` -- `showDescendants` Getter
  im Options-Objekt (gleicher `typeof !== "undefined"` Pattern wie bestehende Optionen)

#### Schritt 3.2: Admin-Config

**Datei**: `resources/views/modules/fan-chart/config.phtml`

- Default-Wert fuer `showDescendants`
- `ModuleConfigTrait`: `default_showDescendants` Preference registrieren
- `ModuleConfigTrait::postAdminAction()`: `setPreference('default_showDescendants', ...)`
  hinzufuegen (analog zu bestehenden Preferences). Ohne diesen Aufruf wird
  der Admin-Default nie gespeichert.

#### Schritt 3.3: Translations

**Dateien**: `resources/lang/*/messages.po` (alle 24 Sprachen)

- "Show descendants" / "Nachkommen anzeigen"
- Beschreibungstext fuer Checkbox
- MO-Dateien kompilieren

### Phase 4: Integrationsverifikation

Phase 4 enthaelt End-to-End-Tests, visuelle Tests und die Winkelverteilungs-
Unit-Tests (die reine Mathematik testen und keinen Browser brauchen).

#### Schritt 4.0: Unit-Tests fuer Winkelverteilung (vor Playwright)

**Datei**: Jest-Test fuer `initDescendants()` Extraktionsfunktion

Die Winkelverteilungs-Logik (Gewichtung, Minimum-Arc, Gleichverteilungs-Fallback)
wird als reine Funktion extrahiert und per Jest getestet (kein Browser noetig):

- 1 Partner, 0 Kinder -> partnerAngle = totalAngle
- 2 Partner, 0/0 Kinder -> gleichmaessig
- 3 Partner, 5/0/1 Kinder -> gewichtet [5,1,1]
- 5 Partner bei kleinem Winkel -> Gleichverteilungs-Fallback
- Unknown Partner mit Kindern -> Gewicht basierend auf Kinderzahl
- childScale = null -> graceful return
- Xref-Sanitisierung: `I@123` sanitisiert zu `I_123`, Standard-Xrefs
  bleiben unveraendert. (Kollisions-Suffix wird NICHT in v3.3.0
  implementiert -- Standard-webtrees-Xrefs kollidieren nicht nach
  Sanitisierung. Der Test verifiziert nur die Sanitisierungsfunktion.)

#### Schritt 4.1: Playwright Integrationstests

- Chart mit showDescendants=true rendern, Arcs visuell pruefen
- Klick auf Nachkommen-Person -> AJAX-Update (kein Page-Reload)
- Klick auf Nachkommen -> Re-Center -> Klick auf weiteren Nachkommen
  (DOM-Orphan-Test: keine akkumulierenden g.person Elemente)
- fanDegree 210 und 270 mit Nachkommen
- fanDegree Slider zeigt min=180, max=270 wenn showDescendants aktiv
- **Export frueh testen** (nicht erst am Ende): SVG-Export mit Nachkommen-Arcs
  pruefen sobald Rendering steht (vor AJAX/Update-Tests). Export-Probleme
  (TextPath-Refs, sanitisierte IDs, clipPath-Verweise) sind spaet teuer.
  - Export SVG: Nachkommen-Arcs im Export vorhanden (F9 Verifikation)
  - Export SVG: TextPath-Referenzen fuer Nachkommen-Labels korrekt aufgeloest
  - Export PNG: analog
- Person ohne Partner + showDescendants=true -> keine Fehler
- Person mit leerem Partner + hideEmptySegments=true -> Partner-Arc sichtbar
- Privacy-Fall: Root mit unassignedChildren (hidden spouse) ->
  Kinder-Arcs ohne Partner-Arc darueber, klickbar, kein Platzhalter-Arc
- Privacy-Fall: Hidden spouse + keine sichtbaren Kinder ->
  keine Arcs fuer diese Familie
- showFamilyColors=true + showDescendants=true -> Nachkommen-Arcs zeigen
  Family Colors pro Partner-Familie (F8), Vorfahren-Guard verhindert
  refMidpoint-basierte Fehlfarben
- showDescendants an -> fanDegree gecappt -> showDescendants aus ->
  fanDegree wiederhergestellt
- RTL-Modus: Nachkommen-Text nicht kopfueber
- AJAX-Update Performance < 2s (NF2): Timing-Messung bei Person mit
  3+ Partnern und 10+ Kindern -- Ladezeit unter 2 Sekunden
- Fan-Degree Clamp visueller Hinweis: Wenn showDescendants aktiviert wird
  und fanDegree geclampt wird, zeigt Slider den neuen Wert korrekt an
- URL-Paritaet: showDescendants ist in der AJAX-URL (getUrl JS-Seite) UND
  in der Node-updateUrl (getUpdateRoute PHP-Seite) vorhanden -- beide Wege
  muessen den Parameter fuehren, sonst verschwindet das Feature bei Navigation
- **Race-Condition-Tests**:
  - Schnelles Ein/Aus der showDescendants Checkbox (3x innerhalb 1s)
  - Klick auf Descendant waehrend laufendem AJAX-Update
  - Re-Center direkt nach Checkbox-Toggle
  - Export unmittelbar nach AJAX-Reload (bekannte Limitierung:
    `webtrees.load()` gibt kein Promise zurueck -- es gibt keinen
    programmatischen Weg zu wissen wann der Reload fertig ist.
    Export-Button koennte waehrend Reload auf stale DOM feuern.
    Mitigation: Export-Button disablen waehrend Reload falls moeglich)
  - fanDegree aendern -> showDescendants an -> showDescendants aus -> fanDegree pruefen

#### Schritt 4.2: Build und Release

- `make build` -- JS-Bundle
- Playwright-Verifizierung im Browser
- **Merge-Kriterien pruefen** (siehe Design-Dokument):
  1. Kein Privacy-Leak bei hidden Spouse
  2. Kein Full Page Reload bei Descendant-Klick
  3. Keine DOM-Orphans nach wiederholtem Re-Center
  4. Export funktioniert mit Descendant-TextPaths
  5. RTL zeigt Descendant-Text korrekt
- Release als 3.3.0

#### Schritt 4.3: Kommunikation

Release Notes und Issue-Kommentar muessen klar machen, dass v3.3.0 das
Fundament ist und weitere Features folgen.

**Release Notes 3.3.0** (Entwurf):

```
New: Show descendants (partners and children) in the fan chart.
Enable via the "Show descendants" checkbox. Partners are displayed
as arcs in the lower section, children grouped below each partner.

Note: enabling descendants limits the fan size to 180-270 degrees
to reserve space for the descendant section.

Descendant arcs show names, birth/death dates, marriage arcs between
central person and partners, family colors per partner family, and
places when arc width allows. Upcoming releases will add:
- Configurable descendant depth (grandchildren, great-grandchildren)
- Images/silhouettes in descendant arcs
```

**Issue #95 Kommentar** (nach Release, Issue bleibt offen):

```
v3.3.0 adds descendant support: partners and their children are shown
as arcs below the ancestor fan. Includes marriage arcs for partners,
family colors per partner family, and places (when arc width allows).
Click navigation (AJAX) and export (SVG/PNG) work for descendants too.

Planned for upcoming releases:
- Configurable descendant depth (grandchildren, great-grandchildren)
- Images/silhouettes in descendant arcs

Feedback on the current implementation is welcome.

Keeping this issue open until the full feature set is delivered.
```

## Reihenfolge und Abhaengigkeiten

```
Phase 1 (PHP) ────> Phase 2 (JS) ──┬──> Phase 4 (Integration)
                                   │
                    Phase 3 (UI) ──┘
                    (3.3 Translations: jederzeit unabhaengig)
```

Phase 1 muss abgeschlossen sein bevor Phase 2 beginnt (JS braucht die
JSON-Struktur). Ausnahme: Schritt 2.1 (configuration.js) hat keine
PHP-Abhaengigkeit und kann parallel zu Phase 1 begonnen werden.

Phase 3 UI-Templates (3.1, 3.2) koennen parallel zu Phase 2 begonnen
werden sobald Phase 1 steht. Translations (3.3) koennen jederzeit parallel.

Phase 4 ist reine Integrationsverifikation nach Abschluss von Phase 2 und 3.

Tests laufen phasenbegleitend: PHPUnit in Phase 1, Playwright ab Phase 2.

## v3.4.0 (Erweiterung)

Wird nach v3.3.0 Release separat geplant. Voraussichtlicher Umfang:

- **F4**: Konfigurierbarer Depth-Slider (1-3 Generationen)
  - Ob direkte Berechnung oder zweite `d3.hierarchy()` besser ist, wird
    nach v3.3.0-Erfahrungen entschieden
  - `getDescendantGenerations()` in Configuration
  - Range-Slider in `form/descendant-generations.phtml`
  - Rekursives `buildDescendantStructure()` mit Tiefenbegrenzung
- **F7**: Images/Silhouettes in Nachkommen-Arcs
- ~~**F6**: Places und Images in Nachkommen-Arcs~~ (Places teilweise in v3.3.0 umgesetzt, Images bleiben hier)
- ~~**F8**: Family Colors pro Partner-Familie~~ (in v3.3.0 umgesetzt)
- ~~**F10**: Marriage-Arc zwischen Zentralperson und Partner~~ (in v3.3.0 umgesetzt)
- **Proportionale Winkel-Aufteilung** evaluieren: Verbesserung der
  Kinderzahl-proportionalen Aufteilung basierend auf v3.3.0 Feedback
- **Zoom/Pan-Restore** beim showDescendants-Toggle: Zoom-State vor Reload
  in Storage/URL serialisieren und nach Reload wiederherstellen
