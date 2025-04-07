---
layout: post
title: "Scraping the NWS site"
description: "Accessing aggregate degree days statistics from the National Weather Service (US)"
date: 2025-04-07 19:00:00
tags: ["Projects", "Thesis"]
background: '/assets/img/posts/scraping_nws_output.png'
---

I wanted to collect some historical weather data. Finding good data sources that are not behind paywalls is somewhat tricky, so I decided to scrape the data from the US National Weather Service

They have a database with the Heating Degree Days (HDD) and Cooling Degree Days (CDD) for the US per city and state. This is perfect for my project where I want to predict office energy consumption, as I want to include weather data in the model. 

Unfortunately, no large archive was available, and upon reaching out my request was declined. As I'm not planning to download the data for all the cities and years that I am intrested in (5058 unique cases), I quickly spun up this scraper

The database looks like a simple php file structure, and luckily the URL structure was quite simple. We don't have to travers and collect all the URLs on the site.  (which is why we chose this site over the PD&R site)

URL structure:
https://ftp.cpc.ncep.noaa.gov/htdocs/products/analysis_monitoring/cdus/degree_days/archives/Cooling%20Degree%20Days/monthly%20cooling%20degree%20days%20city/2011/Feb%202011.txt

Manipulating the year and month should do. 

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

