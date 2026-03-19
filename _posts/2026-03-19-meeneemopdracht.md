---
layout: post
title: "Meeneemopdracht"
description: "analyseopdracht voor Upfront"
date: 2026-03-19 21:00:00
tags: ["Projects"]
---

**Context**<br>
De Foodstore is visueel rustig doordat producten per "verpakkingstype" gesorteerd staan.<br><br>
Er is een middenpad met groente, fruit en diepvries. De rest staat tegen de muren. 

<img 
  src="https://www.frankhanswijk.nl/media/images/upfront-samplestudio-cfrank-hanswijk-48.jpg"
  style="max-width:100%; height:auto; border-radius: 8px;"
/>

## Uitdaging

*Hoe de Foodstore in te delen dat er zo min mogelijk transport van & naar de winkel nodig zijn?*

Om de winkel netjes te houden gaan we geen potjes tussen de diepvriesartikelen houden. De ordening per "categorie blijft".

## Conceptueel vereenvoudigen (simpel denken!)
Eigenlijk kan je de foodstore zien als een enkel heel lang schap, en willen we weten hoe we de breedte van het schap het beste kunnen indelen met verschillende producten.
- de 5 planken boven elkaar zijn altijd met hetzelfde product gevuld, dus met de 5 planken hoeven we eigenlijk geen rekening te houden.
- Vriesvak, groente en fruit gaan we niet verplaatsen (out of scope). 
- De verhouding koeling:schap valt nog te veranderen
<br>
Stel dat de schappen + koeling 24 meter zijn (10m diep, 4m breed). We hoeven alleen te bepalen hoe we de verschillende producten verdelen over deze 24 meter aan schap. 
<br><br>
Omdat we de winkel netjes willen houden, moeten er minstens 2 rijen van hetzelfde product naast elkaar staan. Er is dus een *minimale breedte per product* (of categorie) die we moeten aanhouden. Daarnaast willen we dat de breedte van het schap *proportioneel is aan de vraag naar het product*, zodat we zo min mogelijk hoeven bij te vullen. Hierbij moet ook rekening worden gehouden met de fysieke breedte van elk product.

## Vraagstelling

Hoe verdeel je de producten over 24(?) meter schap zodat:<br>
1. Elk product minstens twee breedt staat
2. Producten met een hogere vraag automatisch meer ruimte krijgen
3. Er rekening wordt gehouden met de fysieke breedte van producten

## Oplossing

*Stap 1: Vraag gecorrigeerd voor breedte*<br>

Voor elk product $i$ definiëren we de **rotatie per meter schap** als:

$$
r_i = \frac{D_i}{w_i}
$$

waarbij:
- $D_i$ = vraag naar product $i$  
- $w_i$ = breedte van product $i$  
<br>
Dit geeft aan hoeveel vraag er is per meter schapruimte. Producten met een hoge $r_i$ zullen sneller door hun voorraad heen gaan en hebben dus relatief meer ruimte nodig.

*Stap 2: Relatieve verdeling van schapruimte*<br>

We normaliseren de rotatie over alle producten:

$$
p_i = \frac{r_i}{\sum_j r_j}
$$

Hiermee bepalen we welk aandeel van de totale schapruimte theoretisch naar product $i$ gaat.

*Stap 3: Initiele breedte per product*<br>
De totale beschikbare schapbreedte noemen we $S_{tot}$ (in dit geval 24 meter). De breedte per product wordt dan:

$$
S_i = p_i \cdot S_{tot}
$$

*Stap 4: Minimale breedte per product*<br>

Om visuele consistentie te waarborgen hanteren we een minimale breedte per product:

$$
S_i^{min} = 2 \cdot (w_i + M)
$$

Waarbij $M$ de marge tussen producten is. (ga na: deze houden we aan tussen elke individuele rij producten, en moet hier dus ook twee keer worden meegenomen). 
Indien de berekende breedte kleiner is dan deze ondergrens, verhogen we $S_i$ naar het minimum:

$$
S_i = \max(S_i, S_i^{min})
$$

*Stap 5: Normalisatie naar totale schapruimte*<br>
Ervanuitgaande dat de minimale breedtes passen, hoeven we alleen de *vraag-gecorrigeerde breedtes proportioneel te schalen* om te voldoen aan $S_{tot}$:

$$
S_i^{nieuw} = S_i \cdot \frac{S_{tot}}{\sum_i S_i}
$$

Hierbij blijven de minimale breedtes gegarandeerd en wordt de totale ruimte optimaal benut.

- Producten met hoge vraag en kleine breedte krijgen meer ruimte.  
- Brede producten worden automatisch gecorrigeerd.  
- Minimale breedtes zorgen voor een visueel consistente winkel.  
- De frequentie van bijvullen wordt geminimaliseerd, waardoor transportbewegingen afnemen.



<hr>
<br>
<br>



Stap 1 is dus om de huidige categorieen te bepalen. Stel voor dat dit zijn:

## Categorieeen

**Middenpad**
- Fruit (per krat)
- Groente (per krat)
- Bevroren producten

**gekoelde producten**
- Gekoelde "emmers" (bv kwark)
- gekoelde "pakken" (bv melk)
- gekoelde "bakken" (bv eiersalade)
- gekoelde "flessen" (bv cranberry sap)
- gekoeld groente (bv bloemkool)
- gekoelde plastic verpakt (bv vlees)

**Muren**
- blik rond (bv bonen)
- blik 'vierkant' (bv koffiebonen)
- fles glas (bv olijfolie)
- kiloverpakking papier (bv bloem)
- kleine glazen potten (bv jam, olijven)
- grote glazen potten (bv ketchup)
- plastic zakken (bv pasta)

Er zijn nog heel wat andere categorieeen (eieren? brood?). Voor een meeneemopdracht lijken deze 16 categorieeen me voldoende.
<br><br>
Daarnaast heeft elk product ook dimensies, kunnen ze stapelbaar zijn, hebben ze een gewicht, houdsbaarheidsdatum, etc. Al mijn aannames staan 
[Hier](https://docs.google.com/spreadsheets/d/1XvqgXeZ9WEhTQ9a_3e4yTI7yGERQDXMbX_NgFn2IbY8/edit?usp=sharing)
<br><br>

## Conceptueel model van de winkel
Laten we aannemen dat de lengte van de schappen & koeling 24m is (10m diep, 4m breed). De verhouding koeling:schap hangt af van de vraag naar producten, en laten we de vriezer, groenten en fruit in het middenpad houden. Voor het vraagstuk kunnen we de winkel versimpelen naar een lang schap van 24 meter (plank & koeling). Omdat we alle 5 de planken altijd met precies hetzelfde product vullen, kunnen we voor nu de winkel naar 1 plank versimpelen. hoe dit in te delen?


## Minimale indeling
Omdat we de winkel netjes houden, blijft de ordening per categorie, en houden we vast aan minstens twee rijen van dezelfde producten naast elkaar. Er is dus een minimale breedte van een categorie (of individueel product) van

$$
W_C = \sum_{i \in C} \big(2 \cdot (w_i + M)\big)
$$

Waarbij $W_C$ de minimale breedte is voor categorie $C$, $w_i$ de breedte van product $i$ is, en $M$ de marge tussen producten;<br><br>
Als aan de vereiste van twee producten naast elkaar is voldaan, wordt de rest van de indeling bepaald door de vraag naar het product. 
