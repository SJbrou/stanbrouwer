---
layout: post
title: "Meeneemopdracht"
description: "analyseopdracht voor Upfront"
date: 2026-03-19 21:00:00
tags: ["Projects"]
---

**Context**<br>
De Foodstore is visueel rustig doordat producten per "verpakkingstype" gesorteerd staan.<br><br>
De bevroren producten, ongekoelde groenten en fruit staan in het middenpad. De overige producten staan tegen de muur. Minstens 2 breed, 5 planken hoog. Ook in de koeling.

<img 
  src="https://www.frankhanswijk.nl/media/images/upfront-samplestudio-cfrank-hanswijk-48.jpg"
  style="max-width:100%; height:auto; border-radius: 8px;"
/>

## Uitdaging

*Hoe de Foodstore in te delen dat er zo min mogelijk transport van & naar de winkel nodig zijn?*

Om de winkel netjes te houden gaan we geen potjes tussen de diepvriesartikelen houden. De ordening per "categorie blijft". 
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
Laten we aannemen dat de lengte van de schappen & koeling 24m is (10m diep, 4m breed). De verhouding koeling:schap hangt af van de vraag naar producten, en laten we de vriezer, groenten en fruit in het middenpad houden. Voor het vraagstuk kunnen we de winkel dan beschouwen als een lang schap/koelschap van 24 meter lang, 5 planken hoog. Hoe dit in te delen?

## Minimale indeling
Omdat we de winkel netjes houden, blijft de ordening per categorie, en houden we vast aan minstens twee rijen van dezelfde producten naast elkaar. De minimale breedte can een categorie wordt dan:

$$
W_C = \sum_{i \in C} \big(2 \cdot (w_i + M)\big)
$$

Waarbij $W_C$ de minimale breedte is voor categorie $C$, $w_i$ de breedte van product $i$ is, en $M$ de marge tussen verschillende producten is;


