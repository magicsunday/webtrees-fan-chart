# Design: Two-Way Fan Chart (Issue #95)

## Ziel

Den Faecher-Chart um Nachkommen (Partner + Kinder) der Zentralperson erweitern.
Vorfahren werden weiterhin im oberen/aeusseren Bereich dargestellt, Partner und
deren Kinder im unteren/inneren Bereich -- ein "2-Wege-Faecher".

## Versionsplanung

| Version | Umfang |
|---------|--------|
| **v3.3.0 (MVP)** | Checkbox, Partner-Arcs, Kinder-Arcs, feste Tiefe=1, AJAX-Update, Export, RTL, visuelle Trennung, Cap bei 270deg / Floor bei 180deg wenn showDescendants aktiv |
| **v3.4.0** | Konfigurierbarer Depth-Slider (1-3), Marriage-Arc fuer Partner, Places und Images in Nachkommen-Arcs, Family Colors pro Partner-Familie |

Issue #95 bleibt offen bis v3.4.0 Features geliefert sind. v3.3.0 kommentiert
den Fortschritt, schliesst das Issue aber nicht.

## Anforderungen

### Funktionale Anforderungen

| ID | Anforderung | Prioritaet | Version |
|----|-------------|------------|---------|
| F1 | Checkbox "Show descendants" aktiviert die Nachkommen-Darstellung | Must | 3.3.0 |
| F2 | Partner der Zentralperson werden als eigene Arcs dargestellt | Must | 3.3.0 |
| F3 | Kinder eines Partners werden unter dem jeweiligen Partner-Arc gezeigt | Must | 3.3.0 |
| F4 | Konfigurierbare Nachkommen-Tiefe (1-3 Generationen) als Slider | Should | 3.4.0 |
| F5 | Klick auf Nachkommen-Person loest AJAX-Update aus (kein Page-Reload) | Must | 3.3.0 |
| F6 | Places und Images in Nachkommen-Arcs wie bei Vorfahren | Should | 3.4.0 |
| F7 | Images/Silhouettes in Nachkommen-Arcs | Could | 3.4.0 |
| F8 | Family Colors pro Partner-Familie (HSL-Rotation bei 3+ Partnern) | Could | 3.4.0 |
| F9 | Export (PNG/SVG) enthaelt Nachkommen | Must | 3.3.0 |
| F10 | Marriage-Arc zwischen Zentralperson und Partner (wenn showParentMarriageDates=true) | Should | 3.4.0 |
| F11 | Visuelle Trennung (fester Gap) zwischen Vorfahren- und Nachkommen-Bereich | Must | 3.3.0 |

### Nicht-funktionale Anforderungen

| ID | Anforderung | Version |
|----|-------------|---------|
| NF1 | Keine Regression der bestehenden Vorfahren-Darstellung | 3.3.0 |
| NF2 | AJAX-Update-Performance bleibt < 2s | 3.3.0 |
| NF3 | Korrekte RTL-Darstellung auch fuer Nachkommen (isPositionFlipped-Fix) | 3.3.0 |
| NF4 | Kein Page-Reload noetig bei Klick auf Nachkommen | 3.3.0 |

## Architektur-Entscheidungen

### 1. Negative Depth fuer Nachkommen

**Entscheidung**: Nachkommen-Knoten erhalten negative `depth`-Werte.

- Zentralperson: `depth = 0`
- Vorfahren: `depth = 1, 2, 3, ...` (wie bisher)
- Partner: `depth = -1`
- Kinder: `depth = -2`
- Enkel: `depth = -3` (ab v3.4.0)

**Begruendung**: Die Geometrie kann via `Math.abs(depth)` bestehende Logik
wiederverwenden, waehrend das Vorzeichen die Richtung (Vorfahren vs. Nachkommen)
bestimmt.

**Wichtig**: D3 `partition()` setzt `depth` als read-only Property (immer >= 0).
Die Nachkommen-Nodes werden daher NICHT ueber `d3.partition()` berechnet, sondern
erhalten synthetische Properties (`depth`, `x0`, `x1`) die manuell berechnet
werden. Siehe Abschnitt 3.

### 2. Separate Winkel-Skala fuer Nachkommen

**Entscheidung**: Nachkommen nutzen einen eigenen Winkelbereich.

```
Vorfahren:   startPi ... endPi     (z.B. -105deg ... +105deg bei 210deg)
Luecke:      fester Offset (10deg)
Nachkommen:  endPi+offset ... startPi-offset+360deg  (verbleibender Kreisanteil)
```

**Fan-Degree Begrenzung**: Wenn `showDescendants=true`:
- **Ceiling**: `fanDegree` auf maximal **270deg** begrenzt (80deg fuer Nachkommen)
- **Floor**: `fanDegree` auf mindestens **180deg** begrenzt. Begruendung:
  bei 180deg bleiben 160deg fuer Nachkommen (nach 2x10deg Gap). Das ist ein
  2:1 Verhaeltnis (Vorfahren:Nachkommen). Bei kleineren Werten (z.B. 120deg
  Vorfahren, 220deg Nachkommen) dominieren die Nachkommen visuell, obwohl
  Vorfahren das primaere Feature sind. 180deg ist der kleinste Wert bei dem
  die Vorfahren-Seite mindestens so gross wie die Nachkommen-Seite bleibt.
  Der Floor wird bei konfigurierbarer Tiefe (v3.4.0) reevaluiert.

Durchsetzung:
- Serverseitig: `Configuration::getFanDegree()` -- der bestehende
  `isBetween(180, 360)` Validator gibt den Default-Wert zurueck wenn der
  Input ausserhalb des Bereichs liegt (kein Clamping, sondern Fallback).
  Der nachgelagerte Descendant-Clamp (`min(270, max(180, $value))`) wird
  danach auf das Ergebnis von `integer()` angewendet wenn
  `getShowDescendants()` true ist.
  **Zusaetzlich**: `Configuration::getFanDegreeUnclamped()` -- neue Methode
  die den isBetween+integer()-Wert OHNE Descendant-Clamp zurueckgibt.
  Wird in page.phtml fuer die `fanDegreeRaw` Storage-Initialisierung benoetigt
  (der ungeclampte Wert muss bei Erstbesuch gespeichert werden).
- Clientseitig: `fanDegree` Setter clampt analog wenn `showDescendants=true`
- UI: `fan-size.phtml` Slider min/max wird conditional auf 180/270 gesetzt.
  Beim Client-Toggle von showDescendants muss auch das HTML `min`/`max`-Attribut
  des Sliders im DOM aktualisiert werden (nicht nur der JS-Wert).
- Wert-Restore: Der ungeclampte User-Wert wird als `fanDegreeRaw` separat
  in Storage persistiert. Der gerenderte `fanDegree` ist stets der "effective value"
  (nach Clamp). Beim Deaktivieren von showDescendants wird `fanDegreeRaw`
  wiederhergestellt. Nie aus dem aktuell sichtbaren Slider-Wert zurueckrechnen --
  der ist ggf. schon geclampt.
  **Update-Semantik fuer fanDegreeRaw**:
  - **Initialisierung** (Page-Load): `fanDegreeRaw = storage.read("fanDegreeRaw") ?? phpDefault`
  - **Slider-Drag bei showDescendants=false**: `fanDegreeRaw` wird MIT aktualisiert
    (gleicher Wert wie fanDegree, da kein Clamp aktiv)
  - **Slider-Drag bei showDescendants=true**: `fanDegreeRaw` wird NICHT aktualisiert
    (der User aendert den geclampten Wert, nicht den Raw-Wert). Beim Disable
    wird der Raw-Wert von vor dem Enable wiederhergestellt.
  - **Disable showDescendants**: Restore `fanDegree = fanDegreeRaw`
  **Autoritaetsreihenfolge**: `fanDegreeRaw` (Storage) > `fanDegree` (Configuration)
  > Slider DOM-Wert.

### 3. Direkte Arc-Berechnung fuer Nachkommen (v3.3.0)

**Entscheidung (v3.3.0)**: Nachkommen-Arcs werden OHNE zweite `d3.hierarchy()`
berechnet. Stattdessen werden synthetische Node-Objekte erstellt und an das
Haupt-Nodes-Array angehaengt.

**Synthetische Node-Struktur**: Muss alle Properties enthalten die der
bestehende Code auf D3-Nodes erwartet:

```javascript
{
    // --- D3-kompatible Properties ---
    id: "desc--1-" + sanitizedXref,  // Depth-Prefix + sanitisierter xref
    depth: -1,                       // negativ = Nachkomme
    x0: computedStart,               // normalisiert [0,1], NICHT Radians
    x1: computedEnd,                 // Umrechnung in Winkel via startAngle()/endAngle()
    parent: null,                    // explizit null (wird in 4 Code-Pfaden gelesen)
    children: null,                  // D3-seitig null (flache Struktur, siehe Hinweis unten)
    height: 0,
    value: 1,
    data: partnerData,               // das Node-Objekt aus dem JSON

    // --- Synthetische Metadaten (nicht von D3 genutzt, fuer v3.4.0 vorbereitet) ---
    descendantType: "partner",       // "partner" | "child"
    familyXref: "F123",             // xref der zugehoerigen Family
    partnerXref: "I456",            // xref des Partners (bei Kindern: des Elternteils)
    rootXref: "I001",               // xref der Zentralperson
    syntheticParentId: null          // bei Kindern: ID des Partner-Nodes ("desc--1-I456")
}
```

**`children: null` ist ein bewusster technischer Kompromiss**: D3-seitig sind
Kinder als separate flache Nodes in `this._nodes` abgelegt, nicht als
`children`-Array auf dem Partner-Node. Die logische Zugehoerigkeit (welche
Kinder gehoeren zu welchem Partner) wird ueber die synthetischen Metadaten
(`familyXref`, `syntheticParentId`) hergestellt, nicht ueber D3-Baumstruktur.
Die Rohdaten (`data.children`) aus dem Server-JSON bleiben unberuehrt und
enthalten die Kinder-Daten -- sie werden nur nicht als D3-Node-Children
verdrahtet.

**ID-Strategie**: Synthetische Nodes verwenden xref-basierte IDs, nicht
sequentielle Integers. Das ist kritisch fuer die D3 data-join Stabilitaet
bei AJAX-Updates: sequentielle IDs aendern sich bei jedem Re-Center (weil
die Vorfahren-Partition eine andere Groesse hat), was zu DOM-Orphan-Akkumulation
fuehrt.

ID-Formate (Depth im Prefix verhindert Kollision bei Dual-Role-Personen,
z.B. Person die gleichzeitig Kind und Partner ist):
- Partner mit bekanntem Spouse: `"desc--1-" + sanitizedXref`
- Kinder: `"desc--2-" + sanitizedXref`
- Leerer Partner (unknown spouse): `"desc-empty-" + sanitizedFamilyXref`
  (`sanitizedFamilyXref` = sanitisierte xref der Family, NICHT familyIndex --
  Index waere instabil wenn sich die Sortierung von spouseFamilies() aendert)

**Xref-Sanitisierung fuer CSS-Selektoren**: GEDCOM xrefs koennen Zeichen
enthalten die in CSS-ID-Selektoren nicht valide sind (z.B. `@`).
`createPathDefinition()` in text.js nutzt `#path-person-{id}` als
CSS-Selector. Daher muessen xrefs in IDs sanitisiert werden:
`xref.replace(/[^a-zA-Z0-9_-]/g, '_')`. Das gilt fuer alle
`"desc-"` prefixed IDs.

**Annahme**: Webtrees xrefs bestehen in der Praxis ausschliesslich aus
`[a-zA-Z0-9]` (z.B. `I123`, `X1`). Die Sanitisierung ist eine defensive
Massnahme fuer importierte GEDCOM-Daten aus Fremdsoftware. Bei solchen
Importen koennten theoretisch Kollisionen entstehen (z.B. `I@123` und
`I_123` sanitisieren beide zu `I_123`). Fuer Standard-webtrees-Daten ist das kein Risiko. Der Implementierungsplan
enthaelt einen Jest-Testfall der die Sanitisierungsfunktion verifiziert
(`I@123` -> `I_123`). Ein Kollisions-Suffix wird in v3.3.0 nicht implementiert.

Die Vorfahren-Nodes behalten ihre sequentiellen Integer-IDs (von
`hierarchy.js::init()` via `forEach` vergeben nach dem Partition-Layout).
Nur Nachkommen-Nodes nutzen String-IDs.
D3 data-join funktioniert mit gemischten ID-Typen (`"desc-"` Prefix
ist nicht-numerisch und kollidiert nicht mit stringifizierten Integers).

**Kritisch -- `datum.depth` vs `datum.data.data.generation`**: Der bestehende Code
liest ueberall `datum.depth` (D3-Property). Fuer Vorfahren sind `datum.depth`
und `datum.data.data.generation` identisch. Fuer synthetische Nachkommen-Nodes
muss das auch gelten: `datum.depth = -1` und `datum.data.data.generation = -1`.

Da synthetische Nodes nicht durch `d3.partition()` laufen, kann `depth` direkt
als Property gesetzt werden (kein read-only Problem bei Plain Objects).

**`datum.parent` ist load-bearing in 4 Stellen**:
1. `person.js` padAngle: prueft `datum.parent` -- null ist safe
2. `family-color.js` getColor: berechnet `refMidpoint` aus x0/x1 -- fuer
   Nachkommen-Nodes sind x0/x1 im Descendant-Winkelbereich, nicht [0,1].
   Guard `if (datum.depth < 0) return null` muss **in family-color.js selbst**
   eingefuegt werden (BEVOR refMidpoint berechnet wird), nicht nur in chart.js.
   Begruendung: fuer Nachkommen-Nodes wuerde `isPaternal = refMidpoint < 0.5`
   eine falsche Farb-Zuordnung ergeben, da x0/x1 zwar in [0,1] normalisiert
   sind (wie Vorfahren), aber im Nachkommen-Sektor des Kreises liegen (z.B.
   0.75-0.95) -- ein refMidpoint von 0.85 waere immer "nicht paternal".
3. `gradient.js`: hat `if (datum.depth < 1) return` -- synthetische Nodes
   wuerden die Funktion sofort verlassen. Hinweis: gradient.js ist aktuell
   nicht in der Produktion eingebunden (kein Import in chart.js). Die Analyse
   ist korrekt aber nur fuer den Fall relevant, dass gradient.js spaeter
   wieder aktiviert wird.
4. `chart.js` Separators: vergleicht `current.parent !== next.parent` --
   bestehende Schleife `for (depth = 1; ...)` filtert negative Depths bereits,
   kein zusaetzlicher Guard noetig (siehe auch AD7 Guards-Abschnitt).

**x0/x1 Domaene fuer Nachkommen**: Synthetische Nodes speichern x0/x1 als
**Bruchteile des vollen Kreises [0, 1]** (gleiche Domaene wie D3-Partition-Nodes),
NICHT als Bruchteile des Nachkommen-Bereichs.

Beispiel: Nachkommen-Bereich = 80deg = 80/360 = 0.222 des Kreises. Ein Kind
das die Haelfte des Nachkommen-Bereichs einnimmt hat `x1 - x0 = 0.111`
(nicht 0.5). Damit liefert `(x1 - x0) * 360 = 40deg` korrekte visuelle Grade.

**Wichtig fuer initDescendants()**: Bei der Berechnung von x0/x1 aus der
proportionalen Winkel-Aufteilung muessen die Ergebnisse auf Full-Circle-Fractions
umgerechnet werden: `x0 = startAngle / (2*PI)` normalisiert auf [0,1] bezogen
auf den vollen Kreis. Die childScale mappt dann diese [0,1]-Werte auf die
tatsaechlichen Radians im Nachkommen-Bereich.

Der bestehende Code `(x1 - x0) * 360` in `calculateOuterSlotPositions()`
liefert damit korrekte Ergebnisse.

**Winkel-Berechnung und Child-Scale Propagation**: Fuer v3.3.0 werden
`startChildPi`, `endChildPi` und die lineare Skalierung in
`hierarchy.js::initDescendants()` berechnet. Mehrere Klassen brauchen
Zugriff auf die Child-Scale (person.js, text.js, label-renderer.js,
marriage.js, chart.js erstellen jeweils eigene `new Geometry(configuration)`
Instanzen -- 5 unabhaengige Instanzen).

**Loesung: childScale auf Configuration speichern**, nicht auf Geometry.
`hierarchy.js::initDescendants()` ruft `configuration.setChildScale(scale)`
auf. Alle Geometry-Instanzen lesen `this._configuration.childScale` intern.
So erreicht die Scale automatisch alle 5+ Geometry-Instanzen ohne dass jede
einzeln benachrichtigt werden muss.

**childScale Domain**: Die Domain der childScale ist **NICHT** [0,1] sondern
der tatsaechliche Full-Circle-Fraktionsbereich des Nachkommen-Sektors:
`d3.scaleLinear().domain([descStartFrac, descEndFrac]).range([startChildPi, endChildPi])`
wobei `descStartFrac = startChildPi / (2*PI)` und `descEndFrac = endChildPi / (2*PI)`.
Beispiel: Nachkommen-Sektor 280-360deg -> domain=[0.778, 1.0], range=[4.887, 6.283].
So wird `childScale(0.85)` korrekt auf den Radians-Wert fuer 85% des vollen
Kreises abgebildet (306deg = 5.34 rad), nicht auf 85% des Descendant-Bereichs.

**Initialwert**: `this._childScale = null` im Configuration-Konstruktor.
Alle Geometry-Methoden die `_childScale` nutzen (`startAngle`, `endAngle`,
`isPositionFlipped` bei `depth < 0`) muessen pruefen:
`if (!this._configuration.childScale) return 0` (bzw. `return false`).
Das verhindert TypeError wenn showDescendants=false ist und keine
Child-Scale gesetzt wurde.

**Spaeter (v3.4.0)**: Bei konfigurierbarer Tiefe > 1 koennte eine zweite
`d3.hierarchy()` sinnvoll werden -- das wird nach v3.3.0-Erfahrungen entschieden,
nicht jetzt festgelegt.

### 4. Datenstruktur-Erweiterung

**Node.php** bekommt zwei neue Arrays:

```php
protected array $partners = [];   // Partner-Nodes (depth -1)
protected array $children = [];   // Kinder-Nodes (depth -2)
```

**JSON-Ausgabe (v3.3.0)**:

Nachkommen-Nodes nutzen die bestehende `NodeData`-Klasse (keine Subclass).
Felder die fuer v3.3.0 nicht relevant sind (Places, Images, detaillierte Daten)
bleiben als leere Strings in der Serialisierung. Das vermeidet eine zweite
Klasse und null-Access-Bugs im JS, da alle 25 Felder immer vorhanden sind.

**Invariante fuer getNodeData()**: Die Methode bleibt semantisch
ancestor-oriented -- sie erhaelt immer positive Generationen. Negative
Generationen werden ausschliesslich nachgelagert via `->setGeneration()`
gesetzt. Diese Konvention ist absichtlich: `abs($generation)` wird am
Call-Site angewendet, damit DateProcessor, PlaceProcessor und
ImageProcessor korrekte Detailtiefe berechnen. Jede Aenderung daran
waere breaking fuer die Date/Place/Timespan-Tiefenberechnung.

```json
{
  "data": { ... },
  "parents": [ ... ],
  "partners": [
    {
      "data": { "name": "Partnername", "generation": -1, "sex": "F", ... },
      "children": [
        { "data": { "name": "Kind1", "generation": -2, "sex": "M", ... } }
      ]
    }
  ]
}
```

`partners` und `children` Keys werden nur serialisiert wenn nicht leer.

### 5. Partner- und Kind-Darstellung

Partner werden **immer** als Arc dargestellt wenn eine Familie existiert, auch
wenn es keine Kinder gibt (zeigt die Ehe-Verbindung). Das schliesst annullierte
und geschiedene Familien ein -- webtrees liefert alle Familien unabhaengig vom
Status via `spouseFamilies()`.

**Reihenfolge der Partner**: Bestimmt durch die Reihenfolge von
`$individual->spouseFamilies()`. Code-Analyse zeigt: `spouseFamilies()`
ruft `facts(['FAMS'], false, ...)` auf -- `sort=false` bedeutet GEDCOM-
Record-Reihenfolge, NICHT Heiratsdatum. Fuer die meisten User stimmt die
GEDCOM-Reihenfolge mit der chronologischen ueberein (Dateneingabe-Konvention),
aber fuer importierte GEDCOM-Dateien mit anderer Reihenfolge koennen Partner
nicht-chronologisch erscheinen. Die Reihenfolge wird uebernommen, nicht
ueberschrieben. Tests duerfen sich NICHT auf chronologische Sortierung
verlassen.

Partner werden als Arc dargestellt wenn die Familie im aktuellen
Privacy-Kontext als darstellbar gilt (siehe Privacy-Policy unten).

Wenn ein Partner unbekannt ist (kein GEDCOM-Pointer) aber Kinder existieren,
wird ein **leerer Partner-Node** eingefuegt, damit die Zuordnung
Familie <-> Kinder erhalten bleibt.

**Hinweis**: `Family::spouse($individual)` erfordert ein `Individual`-Argument.
Ein Aufruf ohne Argument wirft `ArgumentCountError`.

**Privacy-Unterscheidung**: `spouse()` gibt null zurueck sowohl wenn kein
Spouse im GEDCOM existiert ALS AUCH wenn der Spouse privacy-hidden ist.

**Privacy-Policy fuer hidden Spouse + sichtbare Kinder**:

| Situation | Verhalten |
|-----------|-----------|
| Spouse sichtbar, Kinder sichtbar | Partner-Arc + Kinder-Arcs normal |
| Spouse sichtbar, keine Kinder | Partner-Arc ohne Kinder |
| Spouse null (kein GEDCOM-Pointer) + Kinder | Leerer Partner-Arc + Kinder |
| Spouse hidden (Privacy) + Kinder sichtbar | KEIN Partner-Arc. Sichtbare Kinder als `unassignedChildren` direkt an Root |
| Spouse hidden + keine sichtbaren Kinder | Familie komplett uebersprungen |

**Datenmodell fuer unzuordenbare Kinder**: Wenn Kinder sichtbar sind aber
ihr Partner privacy-hidden ist, werden sie als `unassignedChildren` auf dem
Root-Node gefuehrt (nicht unter einem Partner-Arc). Das Root-JSON bekommt
dafuer ein optionales Array:

```json
{
  "data": { ... },
  "parents": [ ... ],
  "partners": [ ... ],
  "unassignedChildren": [
    { "data": { "name": "Kind1", "generation": -2, ... } }
  ]
}
```

`unassignedChildren` wird nur serialisiert wenn nicht leer. Im JS werden
diese Kinder als eigene Gruppe im Nachkommen-Bereich gerendert -- ohne
Partner-Arc darueber, ohne familyXref-Zuordnung.

**Geometrie-Regel fuer unassignedChildren**: Die Kinder erhalten einen
eigenen Winkelblock **nach** allen Partner-Familien im Nachkommen-Bereich.
Ihre Gewichtung nutzt `weight = childCount` (OHNE `max(1,...)`, da mindestens
1 Kind garantiert ist -- im Unterschied zu Partner-Familien die
`max(1, childCount)` verwenden weil Partner ohne Kinder vorkommen). Mindestens 1 Kind
vorhanden ist -- sonst gaebe es kein `unassignedChildren`). Sie werden
wie Kinder einer "virtuellen Familie ohne Partner" behandelt: depth=-2,
gleichmaessig im zugewiesenen Block verteilt. Dieselben Mindestbreiten-
und Textregeln gelten.

**Pseudocode fuer buildDescendantStructure**:

```php
$spouse = $family->spouse($individual);
$visibleChildren = $family->children()->filter(/* sichtbar */);

if ($spouse !== null) {
    // Normaler Fall: Partner sichtbar
    $partnerNode = new Node($this->getNodeData(abs(-1), $spouse));
    // ... Kinder zuordnen ...
} else {
    // spouse() ist null -- Unterscheidung: kein Pointer vs. hidden
    // Fact::value() gibt '@I123@' (mit @), xref() gibt 'I123' (ohne @)
    $hasSpousePointer = $family->facts(['HUSB', 'WIFE'])
        ->filter(fn ($fact) => $fact->value() !== '@' . $individual->xref() . '@')
        ->isNotEmpty();

    if ($hasSpousePointer) {
        // Spouse ist privacy-hidden -> KEINEN Partner-Arc erzeugen
        // Sichtbare Kinder als unassignedChildren an Root haengen
        foreach ($visibleChildren as $child) {
            $rootNode->addUnassignedChild(/* ... */);
        }
        // KEIN continue hier -- Kinder werden verarbeitet, nur Partner fehlt
    } elseif ($visibleChildren->isNotEmpty()) {
        // Genuiner "unbekannter Partner" + sichtbare Kinder
        $partnerNode = new Node($this->createEmptyPartnerNode(-1));
        // ... Kinder zuordnen ...
    }
    // Keine Kinder + kein Pointer -> Familie komplett ueberspringen
}
```

**Implementierung leerer Partner-Node**: `getNodeData()` nimmt non-nullable
`Individual`. Fuer unbekannte Partner wird eine separate Factory-Methode
`DataFacade::createEmptyPartnerNode(int $generation): NodeData` verwendet
(private Methode auf DataFacade, da sie `$this->nodeId` fuer die ID-Vergabe
braucht). Gibt ein `NodeData`-Objekt mit `id` (via `++$this->nodeId`),
`generation` und `sex = 'U'` zurueck. Analog zu `Hierarchy::createEmptyNode()`
auf der JS-Seite.

**hideEmptySegments-Interaktion**: Leere Partner-Nodes (xref="") werden bei
`hideEmptySegments=true` an **zwei Stellen** blockiert:

1. **chart.js `.filter()`** (Zeile ~184): D3-Filter in `draw()` entfernt Nodes
   mit `xref=""` BEVOR `g.person` Elemente erstellt werden. Das ist die primaere
   Blockade -- wenn der Node hier ausgefiltert wird, laeuft person.js nie.
   **Fix**: Filter muss fuer `depth < 0` Nodes die hideEmptySegments-Pruefung
   ueberspringen: `(datum.data.data.xref !== "") || !hideEmptySegments || (datum.depth < 0)`
2. **person.js `init()`** (sekundaer): Zeichnet Arcs nur wenn `xref !== ""` oder
   `!hideEmptySegments`. Braucht ebenfalls `depth < 0` Guard als Fallback.

Fuer Nachkommen-Nodes (`depth < 0`) muss `hideEmptySegments` an beiden Stellen
ignoriert werden -- der leere Partner-Arc ist strukturell notwendig fuer die
Zuordnung der Kinder.

### 6. AJAX-Update fuer Nachkommen

Klick auf eine Nachkommen-Person nutzt denselben `updateUrl`-Mechanismus wie
bei Vorfahren. Der Server gibt die komplette Baumstruktur ab der geklickten
Person zurueck (inkl. deren Vorfahren UND Nachkommen).

**Kritisch**: `DataFacade::getUpdateRoute()` muss den Parameter
`showDescendants` in jede Node-URL einbauen. Dies ist noetig weil
`showDescendants` die **Datenstruktur** der Server-Response aendert
(partners/children Arrays), nicht nur die Darstellung. Andere Display-Toggles
(showFamilyColors, showImages, showPlaces etc.) aendern nur die Darstellung
und kommen daher aus Client-Side Storage -- sie sind nicht in `updateUrl`.

**Ausserdem**: Auch `updateUrl` fuer Nachkommen-Nodes selbst muss korrekt
gesetzt werden (`getUpdateRoute()` in DataFacade muss fuer jeden Node
aufgerufen werden, nicht nur fuer Vorfahren).

Der Parameter `showDescendants` muss in allen URL-Pfaden konsistent gefuehrt
werden. Die vollstaendige Liste:

**PHP-seitig (Server)**:
1. `Module::handle()`: POST-to-GET Redirect
2. `Module::getUpdateAction()`: liest showDescendants, uebergibt an createTreeStructure
3. `Module::getAjaxRoute()`: showDescendants in AJAX-URL
4. `DataFacade::getUpdateRoute()`: showDescendants in jede Node-updateUrl
5. `ModuleChartTrait::chartUrl()`: Menu-Links zum Chart

**JS/Template-seitig (Client)**:
6. `page.phtml`: `storage.register("showDescendants")`
7. `page.phtml`: `getUrl()` JavaScript-Funktion (AJAX-URL-Aufbau) --
   showDescendants wird als dynamischer JS-Parameter angehaengt (aus Storage),
   analog zu `generations`, `showPlaces` etc.
8. `chart.phtml`: Options-Objekt fuer FanChart-Konstruktor

**URL-Koordination PHP/JS**: showDescendants fliesst ueber zwei Wege:
- **Page-Load**: `getAjaxRoute()` (PHP) baut die Base-URL mit showDescendants
  aus dem aktuellen Request. Diese URL wird als `data-wt-ajax-url` gerendert.
- **Client-Toggle**: `getUrl()` (JS) baut die Live-URL dynamisch aus Storage-
  Werten. showDescendants kommt hier aus `storage.read("showDescendants")`.
- **Node-Klick**: `updateUrl` in jedem Node enthaelt showDescendants (von
  `getUpdateRoute()` in PHP eingebaut).

**Checkbox-Toggle loest AJAX-Reload aus**: Da showDescendants die Server-
Response-Struktur aendert (nicht nur Darstellung), muss der Checkbox-onChange
einen AJAX-Fetch ausloesen. **Achtung**: Kein bestehendes Checkbox-Pattern
in page.phtml macht das -- alle anderen Checkboxes (showNames, showImages etc.)
schreiben nur in Storage und wirken erst beim naechsten POST/Page-Reload. Fuer
showDescendants braucht es neuen Code:

```javascript
// container muss ein RAW DOM Element sein, keine D3-Selection!
// webtrees.load() ruft element.innerHTML direkt auf.
// AJAX-Container ist #fan-chart-url (die wt-ajax-load div in page.phtml),
// NICHT das Chart-Element (das hat eine dynamische uniqid()-ID).
const container = document.getElementById("fan-chart-url");
checkbox.addEventListener("change", () => {
    storage.write("showDescendants", checkbox.checked ? "1" : "0");
    const url = getUrl(/* ... alle Parameter inkl. showDescendants ... */);
    container.setAttribute("data-wt-ajax-url", url);
    webtrees.load(container, url);  // ZWEI Argumente: element + url
});
```

Dies ist neue Infrastruktur die in keinem bestehenden Checkbox-Handler existiert.

**Kerninvariante**: `showDescendants` ist ein **datenstrukturelles Flag**, kein
reines Rendering-Flag. Jede Navigation, Reload-URL und Node-URL ohne diesen
Parameter ist fehlerhaft. Das unterscheidet es fundamental von showFamilyColors,
showImages etc., die nur die Darstellung aendern.

**AJAX-Reload vs. Update -- Entscheidung (Gate vor Merge)**:

Es gibt zwei moegliche Pfade fuer den Checkbox-Toggle:

1. **Vollstaendiger AJAX-Block-Reload** via `webtrees.load(container, url)`:
   - webtrees ersetzt den gesamten Container-Inhalt
   - Chart-interne Handler (Zoom, Klick, Export) werden automatisch neu
     gebunden (chart.phtml laeuft erneut). Slider und Checkbox in page.phtml
     liegen AUSSERHALB des AJAX-Blocks und ueberleben den Reload.
   - update.js Cleanup-Pfad wird NICHT durchlaufen (DOM ist schon weg)
   - Vorteil: sauber, kein Zustandsleak
   - Nachteil: Zoom/Pan-State geht verloren

2. **Chart-Update** ueber die bestehende `update()` Infrastruktur:
   - Nur die Daten werden neu geladen, DOM wird per Crossfade aktualisiert
   - update.js Cleanup-Pfad (interrupt + remove desc-Nodes) laeuft normal
   - Event-Handler bleiben erhalten
   - Vorteil: Zoom/Pan bleibt, smoothere UX
   - Nachteil: komplexer, muss alle Descendant-Lifecycle-Faelle abdecken

**Entscheidung**: Pfad 1 (vollstaendiger Reload) fuer v3.3.0. Das ist
robuster und vermeidet Race-Conditions bei schnellem Toggle. Der
update.js Cleanup-Pfad ist dann NUR fuer Klick-Navigation auf Personen
relevant, NICHT fuer den Checkbox-Toggle. Zoom/Pan-Verlust ist akzeptabel
beim Feature-Toggle (nicht bei Person-Navigation).

**Event-Rebinding nach Reload**: `webtrees.load()` ersetzt den Inhalt des
AJAX-Containers (`#fan-chart-url`). chart.phtml liegt INNERHALB dieses
Containers -- der FanChart-Konstruktor laeuft erneut, alle chart-internen
Bindings (Zoom, Klick, Export) werden automatisch neu erzeugt.

Die showDescendants-Checkbox und der Fan-Size-Slider liegen in page.phtml
AUSSERHALB des AJAX-Containers. Ihre Event-Handler ueberleben den Reload
und muessen NICHT rebound werden. Da sie nicht zerstoert werden, besteht
auch kein Double-Binding-Risiko.

### 7. Geometrie-Details

**Radien fuer Nachkommen** (wachsen vom Zentrum nach aussen, im
entgegengesetzten Winkelbereich):

```
Partner (depth -1):
  innerRadius = centerCircleRadius + circlePadding
  outerRadius = innerRadius + innerArcHeight

Kinder (depth -2):
  innerRadius = Partner.outerRadius + circlePadding
  outerRadius = innerRadius + outerArcHeight
```

**Text in Nachkommen-Arcs**: Nutzt dieselbe Inner/Outer-Label-Logik.
Partner (depth -1) sind "inner labels" (Text auf Arc-Pfad). Kinder
(depth -2) als "outer labels" (rotierter Text).

**isInnerLabel() Erweiterung**: Die bestehende Condition
`depth > 0 && depth <= numberOfInnerCircles` muss erweitert werden:
```javascript
return (depth > 0 && depth <= numberOfInnerCircles)
    || (depth === -1);  // Partner = inner label
// depth === -2 (Kinder) faellt durch -> outer label
```

**RTL-Fix -- `isPositionFlipped()`**: Der aktuelle Code in `geometry.js`
prueft `if ((fanDegree <= 270) || (depth < 1)) return false`. Das hat
zwei Probleme: (a) negative Depths geben immer `false` zurueck, und
(b) einfaches Aendern auf `depth === 0` wuerde das Verhalten fuer
`depth=1` Vorfahren in 360°-Charts aendern (Regression).

Korrekte Compound-Condition:
```javascript
if (depth === 0) return false;           // Center-Node: nie flippen
if (depth < 0) {
    if (!this._configuration.childScale) return false;  // null-guard
    const midAngle = this._configuration.childScale((x0 + x1) / 2);
    return (midAngle > (90 * MATH_DEG2RAD))
        && (midAngle < (270 * MATH_DEG2RAD));
}
// WICHTIG: fanDegree <= 270 Guard muss ERHALTEN bleiben fuer depth >= 1!
if (this._configuration.fanDegree <= 270) return false;
// depth >= 1: bestehende midAngle-Pruefung unveraendert
```

**`transformOuterText()` -- zwei Fixes noetig**:

1. **Scale-Aufruf** (Zeile ~882): `this._geometry.scale()` ist die Vorfahren-Skala
   und liefert fuer Descendant-x0/x1-Werte falsche Winkel. Muss fuer negative
   Depths durch `startAngle()`/`endAngle()` ersetzt werden, die via childScale
   korrekt dispatchen.

2. **Rotationsrichtungs-Logik** (Zeile ~885-890): `if (angle > 0)` bestimmt ob
   Text nach links oder rechts rotiert wird. Diese Logik ist fuer Vorfahren-Arcs
   designed. Fuer Nachkommen-Arcs ist der Winkel immer positiv (unterer Halbkreis).
   **Fix**: Dieselbe Formel wie bei `isPositionFlipped()` verwenden:
   ```javascript
   if (depth < 0) {
       const midAngle = this._configuration.childScale((x0 + x1) / 2);
       const flipped = (midAngle > (90 * MATH_DEG2RAD))
                    && (midAngle < (270 * MATH_DEG2RAD));
       // flipped bestimmt Rotationsrichtung statt 'angle > 0'
   }
   ```

**Visuelle Trennung**: Ein fester Gap von 10deg zwischen Vorfahren- und
Nachkommen-Bereich. Kein Separator-Element noetig -- die Luecke reicht
als visuelle Abgrenzung.

**Guards fuer bestehende Features bei negativen Depths**:
- `FamilyColor.getColor()` (in family-color.js): Guard `if (datum.depth < 0) return null`
  BEVOR refMidpoint berechnet wird. Explizit `null` zurueckgeben (nicht `undefined`).
  Call-Sites (chart.js draw, update.js forEach) muessen `null` als "keine Farbe"
  behandeln -- der bestehende Code prueft bereits `if (familyColor)` vor Zuweisung.
  x0/x1 sind im Descendant-Winkelbereich -- ohne Guard ergibt die
  `isPaternal = refMidpoint < 0.5` Berechnung falsche Farben.
- `drawFamilySeparators()`: Bestehende Schleife `for (let depth = 1; ...)`
  iteriert nur positive Depths -- kein zusaetzlicher Guard noetig.
- `drawMarriageArcs()`: Bestehender Filter `datum.children && ...` filtert
  synthetische Nodes (children=null) bereits aus -- kein zusaetzlicher Guard noetig.

**showNames-Interaktion mit Nachkommen**: Der bestehende Guard in person.js
(`if (!showNames && depth > numberOfInnerCircles) return`) filtert negative
Depths nicht, da `-1 > numberOfInnerCircles` immer false ist. Das bedeutet:
bei `showNames=false` bleiben Nachkommen-Arcs sichtbar (nur Text wird
unterdrueckt). Dies ist das gewuenschte Verhalten -- Nachkommen-Arcs sollen
als Struktur sichtbar bleiben auch wenn Namen ausgeblendet sind. Der Guard
darf NICHT auf `Math.abs(depth)` geaendert werden.

**getFontSize() fuer Nachkommen** (Methode lebt in **geometry.js**, nicht
person.js -- person.js ruft nur `this._geometry.getFontSize(datum)` auf):
Die Formel `(fontSize - depth) * fontScale` ergibt fuer negative Depths
groessere Werte (z.B. depth=-1: fontSize+1). Das ist NICHT gewuenscht --
Nachkommen-Arcs sollen gleiche Fontgroessen wie ihre Vorfahren-Aequivalente
haben. Daher: `Math.abs(depth)` in der Formel verwenden, so dass depth=-1
wie Generation 1 und depth=-2 wie Generation 2 skaliert.

Zusaetzlich: Die bestehende Outer-Arc-Fontgroessen-Begrenzung in geometry.js
(`depth >= numberOfInnerCircles + 1`) greift NICHT fuer negative Depths.
Fuer v3.3.0 muessen Kinder-Arcs (depth=-2, outer labels) einen eigenen
Font-Cap erhalten: `if (Math.abs(depth) >= 2 && depth < 0)` -- analog zum
Outer-Arc-Cap fuer Vorfahren, basierend auf dem Nachkommen-Arc-Winkel.

**Bekannte v3.3.0 Limitierungen**:
- Bei mehreren gleichgeschlechtlichen Partnern (z.B. zwei Ehemaenner) erhalten
  beide Partner-Arcs dieselbe M/F-CSS-Klasse und sind visuell nicht unterscheidbar.
  Family Colors pro Partner-Familie (v3.4.0, F8) loest das.
- `showFamilyColors=true` faerbt nur Vorfahren-Arcs, nicht Nachkommen-Arcs
  (Guard gibt `null` zurueck fuer depth < 0). Nachkommen zeigen nur M/F-Farben.
- Zoom/Pan-State geht beim showDescendants Checkbox-Toggle verloren (vollstaendiger
  AJAX-Reload). Bei Person-Klick-Navigation bleibt Zoom/Pan erhalten.

**Text-Berechnung fuer negative Depths**:
- `getAvailableWidth()`: Der aktuelle Code hat Branches fuer `depth > numberOfInnerCircles`
  (outer arcs) und `depth >= 1` (inner arcs via arc-chord). Negative Depths
  fallen in keinen dieser Branches und landen im Center-Circle-Width-Pfad.
  Braucht expliziten `else if (depth < 0)` Branch der die Breite basierend
  auf dem Nachkommen-Arc berechnet.

**Winkel-Aufteilung (v3.3.0)**: Proportional nach Kinderzahl pro Familie.
Der verfuegbare Nachkommen-Winkelbereich wird aufgeteilt basierend auf:
`weight = max(1, childCount)` pro Familie. Partner ohne Kinder erhalten
`weight = 1` (Mindest-Anteil). Die Aufteilungsformel:

```
partnerAngle[i] = totalDescendantAngle * weight[i] / sum(weights)
```

Beispiel: 3 Partner, Kinder = [5, 0, 1], totalAngle = 80deg
- Weights: [5, 1, 1], sum = 7
- Partner A: 80 * 5/7 = 57deg, Partner B: 80 * 1/7 = 11deg, Partner C: 80 * 1/7 = 11deg

Kinder innerhalb eines Partner-Arcs werden gleichmaessig aufgeteilt.

**Minimum-Arc-Breite**: Um unleserlich schmale Arcs zu vermeiden (z.B. bei
180deg Fan + 3 Partnern), gilt eine Ziel-Mindestbreite von **20deg** pro
Partner-Arc. Wenn `sum(weights) * 20 > totalDescendantAngle`, werden alle
Partner-Arcs gleichmaessig aufgeteilt. Falls auch die Gleichverteilung < 20deg
ergibt (z.B. 5 Partner bei 80deg = 16deg), wird die tatsaechliche Breite
akzeptiert -- der Text wird entsprechend gekuerzt. Die 20deg sind ein Richtwert,
kein harter Floor.

**Sonderfall Single-Partner-Zero-Children**: 1 Partner ohne Kinder erhaelt
den gesamten Nachkommen-Bereich (z.B. 80deg bei 270deg Fan). Das ist ein
breiter Arc fuer nur einen Namen -- akzeptabel fuer v3.3.0, da der Arc die
Ehe-Verbindung visuell darstellt.

**Text-Lesbarkeit bei schmalen Arcs**: Bei vielen Partnern oder kleinem
Fan-Degree koennen Descendant-Arcs zu schmal fuer lesbaren Text werden.
Akzeptanzkriterium fuer v3.3.0:
- Lesbarkeit ist unterhalb der Mindestbreite KEIN hartes Kriterium
- In schmalen Arcs wird Text automatisch gekuerzt (bestehende Truncation-Logik)
- Wenn auch gekuerzter Text nicht passt: Arc ohne Text, nur als farbige Flaeche
- **Tooltip als Fallback**: Der bestehende Tooltip-Mechanismus (Hover/Context-Menu)
  zeigt Name und Daten fuer ALLE Arcs an, auch fuer unleserlich schmale.
  Das ist der primaere Interaktionsweg fuer schmale Nachkommen-Arcs.

### 8. Family Colors fuer Nachkommen (v3.4.0)

**Entscheidung**: Pro Partner-Familie eine eigene Farbe.

Bei 1-2 Partnern: `paternalColor` und `maternalColor` wiederverwenden.
Ab 3+ Partnern: HSL-Rotation basierend auf Familien-Index
(`hue = 360 / familyCount * index`, Saettigung und Helligkeit konstant).

Partner-Arc und zugehoerige Kinder-Arcs teilen sich die gleiche
Familienfarbe. Das macht die Zugehoerigkeit visuell sofort klar.

**Achtung**: `FamilyColor.getColor()` nimmt aktuell an, dass `x0/x1` im
Bereich `[0,1]` liegt und vaeterlich = links der Mitte ist. Fuer
Nachkommen-Nodes muss eine **separate** Farb-Logik implementiert werden,
nicht die bestehende recyclen.

### 9. Marriage-Arc fuer Partner (v3.4.0)

**Entscheidung**: Zwischen Zentralperson und jedem Partner wird ein
Marriage-Arc angezeigt, analog zum bestehenden Marriage-Arc bei Vorfahren.

- Angezeigt wenn `showParentMarriageDates=true` (gleiche Option).
  Ob v3.4.0 eine eigene Option braucht (um Partner-Marriage unabhaengig
  von Vorfahren-Marriage steuern zu koennen) wird dann entschieden.
- Positioniert im Gap zwischen Center-Circle und Partner-Arc
- Zeigt Heiratsdatum und -ort (soweit vorhanden)

## Merge-Kriterien fuer v3.3.0

v3.3.0 ist merge-ready wenn diese 5 Gates bestanden sind:

1. **Kein Privacy-Leak** bei hidden Spouse (HUSB/WIFE-Check + Kinder-Policy)
2. **Kein Full Page Reload** bei Descendant-Klick (AJAX-Update funktioniert)
3. **Keine DOM-Orphans** nach wiederholtem Re-Center (interrupt+remove Cleanup)
4. **Export funktioniert** mit Descendant-TextPaths (SVG + PNG):
   keine gebrochenen `textPath href`s, sanitisierte IDs zwischen Render
   und Export stabil
5. **RTL zeigt Descendant-Text korrekt** (isPositionFlipped Compound-Condition)

## Pre-Implementierungs-Checks

Vor Beginn der Implementierung:

- **Issue #95 lesen**: Pruefen ob Community "Partner + Kinder" oder "kompletten
  Nachkommen-Baum" erwartet. Abgrenzung ggf. kommunizieren.
- **Repo-weiter Grep nach Generation-Annahmen**: Pruefen ob irgendwo im Backend
  stillschweigend angenommen wird dass Generationen nicht-negativ sind
  (`$generation > 0`, `$generation >= 1`, etc.).
- **spouseFamilies() Sortierung verifizieren**: Im webtrees Core pruefen ob
  `spouseFamilies()` tatsaechlich nach Heiratsdatum sortiert (siehe AD5).

## Abgrenzung

Folgendes ist **nicht** Teil dieses Features:

- Nachkommen von Geschwistern der Zentralperson
- Interaktives Auf-/Zuklappen einzelner Aeste
- Kombination mit dem Pedigree- oder Descendants-Chart
