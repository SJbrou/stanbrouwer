---
layout: post
title: "Scraping the NWS site"
description: "Aggregating the degree days statistics from the National Weather Service (US)"
date: 2025-04-07 19:00:00
tags: ["Projects", "Thesis"]
background: '/assets/img/posts/scraping_nws_output.png'
---

# Office energy consumption determinants

By analysing open source data concerning building energy consumption we can determine the factors that influence energy consumption in office buildings. 

All datasets containing the energy usage (either from electric, fuel or both) of buildings were considered. Most datasets additionally contained
- building type
- building location (often on zip code / city level due to  privacy concerns)
- floor area
- construction year
- number of occupants (sometimes)
- energy start rating (sometimes)
- operating hours (sometimes)

One dataset with more information concerning wall types, insulations, windows etc was also considered. However, due to its limited size, those variables are not analyzed. 

The location of the buildings is enriched with public weather data from the (US) National Weather Service, to include the environmental factors. (Link)[https://stanbrouwer.com/2025/04/07/scraping-weather-data.html] for more information on the data collection from the NWS site. 

As weather sources are often behind a paywall, it was unfeasable to collect many different variables per location for the analysis. A case study on what weather variables best predict energy usage will be performed for a dutch office building in a later post (electric building).

{% highlight python %}
import os
import time
import requests
import random

# function to handle month names for the url
def get_month_name(month_number):
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return months[month_number - 1]

os.makedirs("data", exist_ok=True)

# main downloading function
def download_data(url, file_path, year, month, degree_type, location_type):
    try:
        # Send GET request to download the file
        response = requests.get(url)
        
        # If succesfull request, save
        if response.status_code == 200:
            with open(file_path, 'wb') as file:
                file.write(response.content)
            print(f"Successfully downloaded {degree_type} {location_type} {year}-{month}")
            status = "Success"
        else:
            raise Exception(f"Failed to download {degree_type} {location_type} {year}-{month}. HTTP Status: {response.status_code}")
    
    except Exception as e:
        # Log errors to fails.txt
        print(f"Error downloading {degree_type} {location_type} {year}-{month}: {e}")
        status = f"Failed: {e}"

    with open("fails.txt", "a") as fail_file:
        fail_file.write(f"{degree_type} {location_type} {year}-{month}: {status}\n")
    
    # Rate limiting
    time.sleep(random.randint(2, 4) ** 2) # 9.67 seconds delay, ~6 requests per min

# Function to download cooling degree days
def download_cooling_degree_days():
    # handle cities in the date range from 2010-2026
    for year in range(2010, 2026):
        for month in range(1, 13):
            month_name = get_month_name(month)
            url = f"https://ftp.cpc.ncep.noaa.gov/htdocs/products/analysis_monitoring/cdus/degree_days/archives/Cooling%20Degree%20Days/monthly%20cooling%20degree%20days%20city/{year}/{month_name}%20{year}.txt"
            file_path = os.path.join("data", f"city_{year}_{month_name}.txt")
            download_data(url, file_path, year, month, "Cooling Degree Days", "City")

    # handle states
    for year in range(2010, 2026):
        for month in range(1, 13):
            month_name = get_month_name(month)
            url = f"https://ftp.cpc.ncep.noaa.gov/htdocs/products/analysis_monitoring/cdus/degree_days/archives/Cooling%20Degree%20Days/monthly%20cooling%20degree%20days%20state/{year}/{month_name}%20{year}.txt"
            file_path = os.path.join("data", f"state_{year}_{month_name}.txt")
            download_data(url, file_path, year, month, "Cooling Degree Days", "State")

# Function to download heating degree days
def download_heating_degree_days():
    # Handle cities
    for year in range(2010, 2026):
        for month in range(1, 13):
            month_name = get_month_name(month)
            url = f"https://ftp.cpc.ncep.noaa.gov/htdocs/products/analysis_monitoring/cdus/degree_days/archives/Heating%20degree%20Days/Monthly%20City/{year}/{month_name}%20{year}.txt"
            file_path = os.path.join("data", f"city_hdd_{year}_{month_name}.txt")
            download_data(url, file_path, year, month, "Heating Degree Days", "City")

    # Handle states
    for year in range(2009, 2026):
        for month in range(1, 13):
            month_name = get_month_name(month)
            url = f"https://ftp.cpc.ncep.noaa.gov/htdocs/products/analysis_monitoring/cdus/degree_days/archives/Heating%20degree%20Days/monthly%20states/{year}/{month_name}%20{year}.txt"
            file_path = os.path.join("data", f"state_hdd_{year}_{month_name}.txt")
            download_data(url, file_path, year, month, "Heating Degree Days", "State")

# Main 
def main():
    # Download all cooling degree days data for cities and states
    download_cooling_degree_days()

    # Download all heating degree days data for cities and states
    download_heating_degree_days()

if __name__ == "__main__":
    main()

{% endhighlight %}

Collecting 797 text files for the period 2010-2025 took 159 minutes. Now we can continue to processing the text files. 

