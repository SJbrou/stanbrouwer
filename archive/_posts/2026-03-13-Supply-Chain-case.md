---
layout: post
title: "Retail supply chain"
description: "Building a model to determine optimal logistics for scale-up retailers"
date: 2026-03-13 00:00:00
tags: ["Projects"]
---

Online dashboard can be found [here](https://sjbrou.shinyapps.io/upfront/), code can be found [here](https://github.com/SJbrou/upfront) 

<img 
  src="https://github.com/SJbrou/upfront/blob/main/pics/dashboard_import_schedule.png"
  style="max-width:100%; height:auto;border-radius: 8px;"
/>


Being intrested in a scale-up's mission to open 100+ stores in the Netherlands, I was curious how to approach an optimal supply chain for a scale-up retailer like them, so I built a quick online-available model to explore different scenarios and assumptions.

Features
- interactive map to visualize store and warehouse locations, automatically calculates optimal transport routes
- products scraped from the retail foodstore website, demand modeling per product, with seasonal and random terms
- inventory management and spill calculations based on expiration dates
- transport cost calculations based on store and warehouse locations, transport modes and distances
- transportation vehicle fleet management, with different capacities and costs for different modes of transport
- profit margin calculations to prioritize high-margin items in case of capacity constraints

the linear solver tries to minimize operating costs from transportation and missed revenue from being out of stock, while trying to stay at the 99% (variable by user) service level target. 

Everything is fully customizable, so you can edit the demand, product mix, store locations, transport costs and more to see how it affects the overall supply chain performance.

## Technical implementation
I wanted to make the model interactive and online available. Javascript or a pure HTML + CSS + Javascript framework misses the data science packages that Python and R have. While I have more experience with python, the fact that I could freely host the model on [shinyapps.io](https://www.shinyapps.io/) made R the better choice for this project.


## Products
Retails current available products are listed at [https://upfront.nl/collections/foodstore](https://upfront.nl/collections/foodstore), which we can quickly scrape:

<details>
<summary>Foodstore scraper code</summary>

{% highlight python %}
import time
import csv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

URL = "https://upfront.nl/collections/foodstore?sort_by=price-ascending"

# Setup headless browser
options = Options()
options.add_argument("--headless=new")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(options=options)
driver.get(URL)

time.sleep(3)

# Scroll until all products load
last_height = driver.execute_script("return document.body.scrollHeight")

while True:
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)

    new_height = driver.execute_script("return document.body.scrollHeight")
    if new_height == last_height:
        break
    last_height = new_height

# Find all product cards
products = driver.find_elements(By.CSS_SELECTOR, "xo-product-card")

data = []

for p in products:
    try:
        name = p.find_element(By.CSS_SELECTOR, "h3").text.strip()
    except:
        name = None

    try:
        price = p.find_element(By.CSS_SELECTOR, ".xo-price__item").text.strip()
    except:
        price = None

    try:
        link = p.find_element(By.CSS_SELECTOR, "a.xo-product-card__heading").get_attribute("href")
    except:
        link = None

    try:
        img = p.find_element(By.CSS_SELECTOR, "img").get_attribute("src")
    except:
        img = None

    # attributes stored directly on the tag
    product_id = p.get_attribute("xo-product-id")
    handle = p.get_attribute("xo-product-handle")
    vendor = p.get_attribute("xo-product-vendor")

    data.append({
        "name": name,
        "price": price,
        "link": link,
        "image_url": img,
        "vendor": vendor,
        "handle": handle,
        "product_id": product_id
    })

driver.quit()

# Save CSV
keys = data[0].keys()

with open("upfront_products.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=keys, delimiter=';')
    writer.writeheader()
    writer.writerows(data)

print(f"Saved {len(data)} products to upfront_products.csv")
{% endhighlight %}
</details>

<table>
  <thead>
    <tr>
      <th>Product</th>
      <th>Price</th>
      <th>Image</th>
      <th>Handle</th>
      <th>Product ID</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://upfront.nl/products/banaan">Banaan</a></td>
      <td>€0,30</td>
      <td><img src="https://cdn.shopify.com/s/files/1/0706/3034/2703/files/SWebsite_Banana_CP_Still_v1.jpg?v=1771511353&width=750" width="80"></td>
      <td>banaan</td>
      <td>15577000542591</td>
    </tr>
    <tr>
      <td><a href="https://upfront.nl/products/gele-ui">Gele ui</a></td>
      <td>€0,30</td>
      <td><img src="https://cdn.shopify.com/s/files/1/0706/3034/2703/files/SWebsite_Onion_CP_Still_v1.jpg?v=1771408074&width=750" width="80"></td>
      <td>gele-ui</td>
      <td>15576999952767</td>
    </tr>
    <tr>
      <td><a href="https://upfront.nl/products/mandarijn">Mandarijn</a></td>
      <td>€0,30</td>
      <td><img src="https://cdn.shopify.com/s/files/1/0706/3034/2703/files/SWebsite_Mandarine_CP_Still_v1.jpg?v=1771408081&width=750" width="80"></td>
      <td>mandarijn</td>
      <td>15576998904191</td>
    </tr>
    <tr>
      <td><a href="https://upfront.nl/products/pruimen">Pruimen</a></td>
      <td>€0,30</td>
      <td><img src="https://cdn.shopify.com/s/files/1/0706/3034/2703/files/SWebsite_Plum_CP_Still_v1.jpg?v=1771408066&width=750" width="80"></td>
      <td>pruimen</td>
      <td>15576999625087</td>
    </tr>
    <tr>
      <td><a href="https://upfront.nl/products/rode-ui">Rode Ui</a></td>
      <td>€0,30</td>
      <td><img src="https://cdn.shopify.com/s/files/1/0706/3034/2703/files/SWebsite_RedOnion_CP_Still_v1.jpg?v=1771408045&width=750" width="80"></td>
      <td>rode-ui</td>
      <td>15576996577663</td>
    </tr>
  </tbody>
</table>

<style>
  table {
  border-collapse: collapse;
  width: 100%;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
}

th {
  text-align: left;
  background: #f5f5f5;
}

tr:nth-child(even) {
  background: #fafafa;
}

img {
  border-radius: 6px;
}
</style>

### Assumptions

We know that the retail chain is likely going to have 5 stores in the near future. Lets assume they will be in 
- Rotterdam
- Amsterdam
- Utrecht
- Den Haag
- Leiden
- Adittionally, there will be a central warehouse. Lets put it centrally in Vianen. 

(by the way, I would use location of current delivery adresses to determine the optimal locations for new stores :)

### Demand
It is public knowledge that the retail chain's current store does about €20.000,- of revenue per day. Their average product price is €3,44, which means they sell about 5.797 items per day. per store. <br><br>
As we currently use 50 items in the model, with an average price of 4,51, we are likely to sell 87 units per item per day. For now we assume a linear distribution, while it does more likely follow a long tail distribution. Individual demand can be modified in the editor. <br><br>

### Needs more writing here. 

#### Products
Per product we need to know:
- expiration date (inventory management and spill calculations)
- storage type (should it be refrigerated / frozen)
- storage space (how many items fit in a standardized measure of storage, eg one square meter)
- profit margin (to prioritize high-margin items)

### Transport & Logistics
- assuming each truck can drive for 12 hours per day
- loading/unloading times are neglected. 
- location of stores & warehouse (to calculate transport distances)
- storage capacity per location
- transport cost per km (if we want to do cost calculations)
- modes of transport (e.g. can frozen and non-frozen food be transported together, how much capacity per mode of transport, etc)

### Shiny code
the shiny app code is 2k LOC. It can be found on my github.  


### Indeling foodstore:


**Context**<br>
De Foodstore is visueel rustig doordat producten per "verpakkingstype" gesorteerd staan.<br><br>
Er is een middenpad met groente, fruit en diepvries. De rest staat tegen de muren. 

<img 
  src="https://www.frankhanswijk.nl/media/images/upfront-samplestudio-cfrank-hanswijk-48.jpg"
  style="max-width:100%; height:auto; border-radius: 8px;"
/>

## Uitdaging

*Hoe de Foodstore in te delen dat er zo min mogelijk transport van & naar de winkel nodig zijn?*

Om de winkel netjes te houden gaan we geen potjes tussen de diepvriesartikelen houden. De ordening per "categorie" blijft.

## Conceptueel vereenvoudigen (simpel denken!)
Eigenlijk kan je de foodstore zien als 24m(? 2x 10m diep, 4m breed) aan schap, en willen we weten hoe we de breedte van het schap het beste kunnen indelen met de verschillende producten

- de 5 planken boven elkaar zijn altijd met hetzelfde product gevuld, dus met de 5 planken hoeven we eigenlijk geen rekening te houden.
- Vriesvak, groente en fruit gaan we niet verplaatsen (out of scope). 
- De verhouding koeling:schap valt nog te veranderen
<br>

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
- \(D_i\) = vraag naar product \(i\)  
- \(w_i\) = breedte van product \(i\)  
<br>
Dit geeft aan hoeveel vraag er is per meter schapruimte. Producten met een hoge \(r_i\) zullen sneller door hun voorraad heen gaan en hebben dus relatief meer ruimte nodig.

*Stap 2: Relatieve verdeling van schapruimte*<br>

We normaliseren de rotatie over alle producten:

$$
p_i = \frac{r_i}{\sum_j r_j}
$$

Hiermee bepalen we welk aandeel van de totale schapruimte theoretisch naar product $i$ gaat.

*Stap 3: Initiele breedte per product*<br>
De totale beschikbare schapbreedte noemen we \(S_{tot}\) (in dit geval 24 meter). De breedte per product wordt dan:

$$
S_i = p_i \cdot S_{tot}
$$

*Stap 4: Minimale breedte per product*<br>

Om visuele consistentie te waarborgen hanteren we een minimale breedte per product:

$$
S_i^{min} = 2 \cdot (w_i + M)
$$

Waarbij \(M\) de marge tussen producten is. (ga na: deze houden we aan tussen elke individuele rij producten, en moet hier dus ook twee keer worden meegenomen). 
Indien de berekende breedte kleiner is dan deze ondergrens, verhogen we \(S_i\) naar het minimum:

$$
S_i = \max(S_i, S_i^{min})
$$

*Stap 5: Normalisatie naar totale schapruimte*<br>
Ervanuitgaande dat de minimale breedtes passen, hoeven we alleen de *vraag-gecorrigeerde breedtes proportioneel te schalen* om te voldoen aan \(S_{tot}\):

$$
S_i^{nieuw} = S_i \cdot \frac{S_{tot}}{\sum_i S_i}
$$

Hierbij blijven de minimale breedtes gegarandeerd en wordt de totale ruimte optimaal benut.

- Producten met hoge vraag en kleine breedte krijgen meer ruimte.  
- Brede producten worden automatisch gecorrigeerd.  
- Minimale breedtes zorgen voor een visueel consistente winkel.  
- De frequentie van bijvullen wordt geminimaliseerd, waardoor transportbewegingen afnemen.

<br>
<hr>
<br>
<br>

## Implementatie

Er zijn nog andere zaken om rekening mee te houden
- producten staan per categorie bij elkaar.
- sommige producten vallen op te stapelen (bv. blik. Dan kunnen er dus meer producten per breedte)



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
